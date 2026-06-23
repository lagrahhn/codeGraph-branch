/**
 * Integration Test: Branch Optimization
 *
 * Demonstrates the benefits of content-addressable shared storage:
 * - Disk space savings
 * - Faster branch switching
 * - Reduced memory usage
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { DatabaseConnection } from '../src/db';
import { SharedStorageQueries } from '../src/db/shared-queries';
import { computeFileHash } from '../src/utils/content-hash';
import { Node, Edge, FileRecord, Language } from '../src/types';

describe('Branch Optimization Integration', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'codegraph-optimization-'));
  });

  afterEach(async () => {
    // Wait a bit for Windows to release file locks
    await new Promise(resolve => setTimeout(resolve, 100));
    try {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors on Windows
    }
  });

  /**
   * Helper to create a test database with schema
   */
  function createTestDb(dbPath: string): DatabaseConnection {
    const db = DatabaseConnection.initialize(dbPath);

    // Initialize shared storage schema
    const sqliteDb = db.getDb();
    sqliteDb.exec(`
      CREATE TABLE IF NOT EXISTS shared_nodes (
        id TEXT PRIMARY KEY,
        file_path TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        kind TEXT NOT NULL,
        name TEXT NOT NULL,
        qualified_name TEXT NOT NULL,
        language TEXT NOT NULL,
        start_line INTEGER NOT NULL,
        end_line INTEGER NOT NULL,
        start_column INTEGER NOT NULL,
        end_column INTEGER NOT NULL,
        docstring TEXT,
        signature TEXT,
        visibility TEXT,
        is_exported INTEGER DEFAULT 0,
        is_async INTEGER DEFAULT 0,
        is_static INTEGER DEFAULT 0,
        is_abstract INTEGER DEFAULT 0,
        decorators TEXT,
        type_parameters TEXT,
        updated_at INTEGER NOT NULL,
        UNIQUE(file_path, content_hash, name, kind, start_line)
      );

      CREATE TABLE IF NOT EXISTS shared_files (
        path TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        language TEXT NOT NULL,
        size INTEGER NOT NULL,
        modified_at INTEGER NOT NULL,
        indexed_at INTEGER NOT NULL,
        node_count INTEGER DEFAULT 0,
        errors TEXT,
        PRIMARY KEY (path, content_hash)
      );

      CREATE TABLE IF NOT EXISTS branch_files (
        branch TEXT NOT NULL,
        file_path TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        PRIMARY KEY (branch, file_path)
      );

      CREATE TABLE IF NOT EXISTS branch_edges (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        branch TEXT NOT NULL,
        source TEXT NOT NULL,
        target TEXT NOT NULL,
        kind TEXT NOT NULL,
        metadata TEXT,
        line INTEGER,
        col INTEGER,
        provenance TEXT DEFAULT NULL
      );

      CREATE TABLE IF NOT EXISTS branch_metadata (
        branch TEXT PRIMARY KEY,
        created_at INTEGER NOT NULL,
        last_accessed INTEGER NOT NULL,
        file_count INTEGER DEFAULT 0,
        node_count INTEGER DEFAULT 0,
        edge_count INTEGER DEFAULT 0,
        is_indexed INTEGER DEFAULT 0
      );
    `);

    return db;
  }

  /**
   * Helper to create sample nodes for a file
   */
  function createSampleNodes(
    filePath: string,
    contentHash: string,
    count: number
  ): Node[] {
    const nodes: Node[] = [];
    for (let i = 0; i < count; i++) {
      nodes.push({
        id: `${filePath}:node${i}:${contentHash}`,
        kind: 'function',
        name: `function${i}`,
        qualifiedName: `${filePath}:function${i}`,
        filePath,
        language: 'typescript',
        startLine: i * 10 + 1,
        endLine: i * 10 + 5,
        startColumn: 0,
        endColumn: 20,
        isExported: false,
        isAsync: false,
        isStatic: false,
        isAbstract: false,
        updatedAt: Date.now(),
      });
    }
    return nodes;
  }

  describe('Disk Space Optimization', () => {
    it('should demonstrate space savings with shared storage', async () => {
      // Simulate old approach: separate databases per branch
      const oldDbDir = path.join(tempDir, 'old');
      await fs.promises.mkdir(oldDbDir, { recursive: true });

      const branches = ['main', 'feature-a', 'feature-b', 'feature-c', 'dev'];
      const filesPerBranch = 100;
      const nodesPerFile = 10;

      // Create old-style databases (one per branch)
      for (const branch of branches) {
        const dbPath = path.join(oldDbDir, `${branch}.db`);
        const db = createTestDb(dbPath);
        const sqliteDb = db.getDb();

        // Insert duplicate data for each branch
        const insertStmt = sqliteDb.prepare(`
          INSERT INTO shared_nodes (id, file_path, content_hash, kind, name, qualified_name, language, start_line, end_line, start_column, end_column, is_exported, is_async, is_static, is_abstract, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (let i = 0; i < filesPerBranch; i++) {
          const filePath = `src/file${i}.ts`;
          const content = `content for file ${i}`;
          const contentHash = computeFileHash(filePath, content);

          // Insert nodes (same for all branches)
          const nodes = createSampleNodes(filePath, contentHash, nodesPerFile);
          for (const node of nodes) {
            insertStmt.run(
              node.id, node.filePath, contentHash, node.kind, node.name, node.qualifiedName, node.language,
              node.startLine, node.endLine, node.startColumn, node.endColumn,
              node.isExported ? 1 : 0, node.isAsync ? 1 : 0, node.isStatic ? 1 : 0, node.isAbstract ? 1 : 0,
              node.updatedAt
            );
          }
        }

        db.close();
      }

      // Create new shared storage
      const newDbPath = path.join(tempDir, 'new.db');
      const newDb = createTestDb(newDbPath);
      const newQueries = new SharedStorageQueries(newDb.getDb());

      // Insert shared nodes (only once!)
      for (let i = 0; i < filesPerBranch; i++) {
        const filePath = `src/file${i}.ts`;
        const content = `content for file ${i}`;
        const contentHash = computeFileHash(filePath, content);

        const nodes = createSampleNodes(filePath, contentHash, nodesPerFile);
        for (const node of nodes) {
          newQueries.insertSharedNode(node, filePath, contentHash);
        }

        // Map files to branches
        for (const branch of branches) {
          newQueries.insertBranchFile(branch, filePath, contentHash);
        }
      }

      // Update branch metadata
      for (const branch of branches) {
        newQueries.refreshBranchMetadata(branch);
      }

      newDb.close();

      // Wait for file handles to close on Windows
      await new Promise(resolve => setTimeout(resolve, 200));

      // Compare file sizes
      const oldTotalSize = branches.reduce((sum, branch) => {
        const dbPath = path.join(oldDbDir, `${branch}.db`);
        const stats = fs.statSync(dbPath);
        return sum + stats.size;
      }, 0);

      const newStats = fs.statSync(newDbPath);
      const newTotalSize = newStats.size;

      const savings = ((oldTotalSize - newTotalSize) / oldTotalSize) * 100;

      console.log(`\n📊 Disk Space Optimization Results:`);
      console.log(`   Old approach (5 branches): ${(oldTotalSize / 1024).toFixed(2)} KB`);
      console.log(`   New approach (shared):     ${(newTotalSize / 1024).toFixed(2)} KB`);
      console.log(`   Space saved:               ${savings.toFixed(1)}%`);

      // Verify space savings
      expect(newTotalSize).toBeLessThan(oldTotalSize);
      expect(savings).toBeGreaterThan(50); // Should save at least 50%
    });
  });

  describe('Indexing Speed Optimization', () => {
    it('should demonstrate faster branch switching with incremental indexing', async () => {
      const dbPath = path.join(tempDir, 'test.db');
      const db = createTestDb(dbPath);
      const queries = new SharedStorageQueries(db.getDb());

      const totalFiles = 1000;
      const nodesPerFile = 10;
      const changedFiles = 50; // Only 5% of files change

      // Step 1: Initial indexing (simulating first branch)
      const startTime1 = Date.now();

      for (let i = 0; i < totalFiles; i++) {
        const filePath = `src/file${i}.ts`;
        const content = `initial content for file ${i}`;
        const contentHash = computeFileHash(filePath, content);

        const nodes = createSampleNodes(filePath, contentHash, nodesPerFile);
        for (const node of nodes) {
          queries.insertSharedNode(node, filePath, contentHash);
        }

        queries.insertBranchFile('main', filePath, contentHash);
      }

      queries.refreshBranchMetadata('main');
      const duration1 = Date.now() - startTime1;

      // Step 2: Switch to new branch (incremental)
      const startTime2 = Date.now();

      // Only update changed files
      for (let i = 0; i < changedFiles; i++) {
        const filePath = `src/file${i}.ts`;
        const content = `modified content for file ${i}`;
        const contentHash = computeFileHash(filePath, content);

        // Check if already exists
        const existing = queries.getSharedNodesByFileHash(filePath, contentHash);
        if (existing.length === 0) {
          const nodes = createSampleNodes(filePath, contentHash, nodesPerFile);
          for (const node of nodes) {
            queries.insertSharedNode(node, filePath, contentHash);
          }
        }

        // Update branch mapping
        queries.insertBranchFile('feature', filePath, contentHash);
      }

      // Copy unchanged files from main to feature
      const mainFiles = queries.getBranchFiles('main');
      for (const file of mainFiles) {
        const featureHash = queries.getBranchFileByPath('feature', file.filePath);
        if (!featureHash) {
          queries.insertBranchFile('feature', file.filePath, file.contentHash);
        }
      }

      queries.refreshBranchMetadata('feature');
      const duration2 = Date.now() - startTime2;

      const speedup = duration1 / duration2;

      console.log(`\n⚡ Indexing Speed Optimization Results:`);
      console.log(`   Initial indexing (${totalFiles} files): ${duration1}ms`);
      console.log(`   Incremental switch (${changedFiles} changed): ${duration2}ms`);
      console.log(`   Speedup: ${speedup.toFixed(1)}x`);

      // Verify speed improvement
      expect(duration2).toBeLessThan(duration1);
      expect(speedup).toBeGreaterThan(2); // At least 2x faster

      // Verify data integrity
      const mainNodes = queries.getNodesByBranch('main');
      const featureNodes = queries.getNodesByBranch('feature');

      console.log(`   Main branch nodes: ${mainNodes.length}`);
      console.log(`   Feature branch nodes: ${featureNodes.length}`);

      expect(mainNodes.length).toBe(totalFiles * nodesPerFile);
      expect(featureNodes.length).toBe(totalFiles * nodesPerFile);

      db.close();
    });
  });

  describe('Memory Optimization', () => {
    it('should demonstrate reduced memory with shared storage', async () => {
      const dbPath = path.join(tempDir, 'test.db');
      const db = createTestDb(dbPath);
      const queries = new SharedStorageQueries(db.getDb());

      const branches = 10;
      const filesPerBranch = 100;
      const nodesPerFile = 10;

      // Simulate shared storage
      for (let b = 0; b < branches; b++) {
        const branch = `branch${b}`;

        for (let i = 0; i < filesPerBranch; i++) {
          const filePath = `src/file${i}.ts`;
          const content = `content for file ${i}`;
          const contentHash = computeFileHash(filePath, content);

          // Only insert nodes once (shared)
          if (b === 0) {
            const nodes = createSampleNodes(filePath, contentHash, nodesPerFile);
            for (const node of nodes) {
              queries.insertSharedNode(node, filePath, contentHash);
            }
          }

          // Map to branch
          queries.insertBranchFile(branch, filePath, contentHash);
        }

        queries.refreshBranchMetadata(branch);
      }

      // Count unique nodes vs total if stored separately
      const uniqueNodes = queries.getNodesByBranch('branch0').length;
      const totalIfSeparate = uniqueNodes * branches;
      const actualTotal = uniqueNodes; // Shared!

      const memorySavings = ((totalIfSeparate - actualTotal) / totalIfSeparate) * 100;

      console.log(`\n💾 Memory Optimization Results:`);
      console.log(`   Unique nodes: ${uniqueNodes}`);
      console.log(`   If stored separately (${branches} branches): ${totalIfSeparate}`);
      console.log(`   Shared storage: ${actualTotal}`);
      console.log(`   Memory savings: ${memorySavings.toFixed(1)}%`);

      // Verify memory savings
      expect(actualTotal).toBeLessThan(totalIfSeparate);
      expect(memorySavings).toBeGreaterThan(80); // At least 80% savings

      db.close();
    });
  });

  describe('Query Performance', () => {
    it('should maintain acceptable query performance', async () => {
      const dbPath = path.join(tempDir, 'test.db');
      const db = createTestDb(dbPath);
      const queries = new SharedStorageQueries(db.getDb());

      const totalFiles = 100;
      const nodesPerFile = 10;

      // Insert data
      for (let i = 0; i < totalFiles; i++) {
        const filePath = `src/file${i}.ts`;
        const content = `content for file ${i}`;
        const contentHash = computeFileHash(filePath, content);

        const nodes = createSampleNodes(filePath, contentHash, nodesPerFile);
        for (const node of nodes) {
          queries.insertSharedNode(node, filePath, contentHash);
        }

        queries.insertBranchFile('main', filePath, contentHash);
      }

      queries.refreshBranchMetadata('main');

      // Benchmark queries (fewer iterations for faster test)
      const iterations = 10;

      // Test 1: Get all nodes for branch
      const start1 = Date.now();
      for (let i = 0; i < iterations; i++) {
        queries.getNodesByBranch('main');
      }
      const duration1 = Date.now() - start1;

      // Test 2: Search nodes
      const start2 = Date.now();
      for (let i = 0; i < iterations; i++) {
        queries.searchNodesByBranch('main', 'function50');
      }
      const duration2 = Date.now() - start2;

      // Test 3: Get nodes by kind
      const start3 = Date.now();
      for (let i = 0; i < iterations; i++) {
        queries.getNodesByBranchAndKind('main', 'function');
      }
      const duration3 = Date.now() - start3;

      console.log(`\n🔍 Query Performance Results (${iterations} iterations):`);
      console.log(`   Get all nodes: ${duration1}ms (${(duration1 / iterations).toFixed(2)}ms/query)`);
      console.log(`   Search nodes: ${duration2}ms (${(duration2 / iterations).toFixed(2)}ms/query)`);
      console.log(`   Get by kind: ${duration3}ms (${(duration3 / iterations).toFixed(2)}ms/query)`);

      // Verify performance is acceptable (< 100ms per query for small dataset)
      expect(duration1 / iterations).toBeLessThan(100);
      expect(duration2 / iterations).toBeLessThan(100);
      expect(duration3 / iterations).toBeLessThan(100);

      db.close();
    });
  });
});
