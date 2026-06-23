/**
 * Tests for Shared Storage Queries
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { DatabaseConnection } from '../src/db';
import { SharedStorageQueries } from '../src/db/shared-queries';
import { computeFileHash } from '../src/utils/content-hash';
import { Node, Edge, FileRecord, Language } from '../src/types';

describe('SharedStorageQueries', () => {
  let db: DatabaseConnection;
  let queries: SharedStorageQueries;
  let tempDir: string;

  beforeEach(async () => {
    // Create temp directory
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'codegraph-test-'));

    // Create database using static method
    const dbPath = path.join(tempDir, 'test.db');
    db = DatabaseConnection.initialize(dbPath);

    // Get underlying SQLite database and initialize shared storage schema
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

    queries = new SharedStorageQueries(sqliteDb);
  });

  afterEach(async () => {
    db.close();
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  });

  describe('Shared Nodes', () => {
    it('should insert and retrieve shared node', () => {
      const node: Node = {
        id: 'node1',
        kind: 'function',
        name: 'testFunction',
        qualifiedName: 'src/utils.ts:testFunction',
        filePath: 'src/utils.ts',
        language: 'typescript',
        startLine: 1,
        endLine: 10,
        startColumn: 0,
        endColumn: 50,
        isExported: true,
        isAsync: false,
        isStatic: false,
        isAbstract: false,
        updatedAt: Date.now(),
      };

      const contentHash = computeFileHash('src/utils.ts', 'function testFunction() {}');
      queries.insertSharedNode(node, 'src/utils.ts', contentHash);

      const retrieved = queries.getSharedNodeById('node1');
      expect(retrieved).toBeTruthy();
      expect(retrieved?.name).toBe('testFunction');
      expect(retrieved?.kind).toBe('function');
    });

    it('should get nodes by file hash', () => {
      const contentHash = computeFileHash('src/utils.ts', 'content');

      const node1: Node = {
        id: 'node1',
        kind: 'function',
        name: 'func1',
        qualifiedName: 'src/utils.ts:func1',
        filePath: 'src/utils.ts',
        language: 'typescript',
        startLine: 1,
        endLine: 5,
        startColumn: 0,
        endColumn: 20,
        isExported: false,
        isAsync: false,
        isStatic: false,
        isAbstract: false,
        updatedAt: Date.now(),
      };

      const node2: Node = {
        id: 'node2',
        kind: 'function',
        name: 'func2',
        qualifiedName: 'src/utils.ts:func2',
        filePath: 'src/utils.ts',
        language: 'typescript',
        startLine: 7,
        endLine: 12,
        startColumn: 0,
        endColumn: 20,
        isExported: false,
        isAsync: false,
        isStatic: false,
        isAbstract: false,
        updatedAt: Date.now(),
      };

      queries.insertSharedNode(node1, 'src/utils.ts', contentHash);
      queries.insertSharedNode(node2, 'src/utils.ts', contentHash);

      const nodes = queries.getSharedNodesByFileHash('src/utils.ts', contentHash);
      expect(nodes).toHaveLength(2);
      expect(nodes.map(n => n.id)).toContain('node1');
      expect(nodes.map(n => n.id)).toContain('node2');
    });
  });

  describe('Branch Files', () => {
    it('should insert and retrieve branch file mapping', () => {
      const contentHash = computeFileHash('src/utils.ts', 'content');
      queries.insertBranchFile('main', 'src/utils.ts', contentHash);

      const hash = queries.getBranchFileByPath('main', 'src/utils.ts');
      expect(hash).toBe(contentHash);
    });

    it('should get all files for a branch', () => {
      const hash1 = computeFileHash('src/utils.ts', 'content1');
      const hash2 = computeFileHash('src/helpers.ts', 'content2');

      queries.insertBranchFile('main', 'src/utils.ts', hash1);
      queries.insertBranchFile('main', 'src/helpers.ts', hash2);

      const files = queries.getBranchFiles('main');
      expect(files).toHaveLength(2);
    });
  });

  describe('Branch Edges', () => {
    it('should insert and retrieve branch edge', () => {
      const edge: Edge = {
        source: 'node1',
        target: 'node2',
        kind: 'calls',
        line: 5,
      };

      queries.insertBranchEdge('main', edge);

      const edges = queries.getBranchEdgesBySource('main', 'node1');
      expect(edges).toHaveLength(1);
      expect(edges[0].target).toBe('node2');
      expect(edges[0].kind).toBe('calls');
    });
  });

  describe('Branch Metadata', () => {
    it('should upsert and retrieve branch metadata', () => {
      queries.upsertBranchMetadata('main', {
        fileCount: 10,
        nodeCount: 100,
        edgeCount: 500,
        isIndexed: true,
      });

      const metadata = queries.getBranchMetadata('main');
      expect(metadata).toBeTruthy();
      expect(metadata?.fileCount).toBe(10);
      expect(metadata?.nodeCount).toBe(100);
      expect(metadata?.edgeCount).toBe(500);
      expect(metadata?.isIndexed).toBe(true);
    });

    it('should update existing metadata', () => {
      queries.upsertBranchMetadata('main', {
        fileCount: 10,
        nodeCount: 100,
        edgeCount: 500,
        isIndexed: true,
      });

      queries.upsertBranchMetadata('main', {
        fileCount: 20,
        nodeCount: 200,
        edgeCount: 1000,
        isIndexed: true,
      });

      const metadata = queries.getBranchMetadata('main');
      expect(metadata?.fileCount).toBe(20);
      expect(metadata?.nodeCount).toBe(200);
    });
  });

  describe('Cross-Branch Queries', () => {
    it('should get nodes by branch', () => {
      const contentHash = computeFileHash('src/utils.ts', 'content');

      const node: Node = {
        id: 'node1',
        kind: 'function',
        name: 'testFunc',
        qualifiedName: 'src/utils.ts:testFunc',
        filePath: 'src/utils.ts',
        language: 'typescript',
        startLine: 1,
        endLine: 5,
        startColumn: 0,
        endColumn: 20,
        isExported: false,
        isAsync: false,
        isStatic: false,
        isAbstract: false,
        updatedAt: Date.now(),
      };

      queries.insertSharedNode(node, 'src/utils.ts', contentHash);
      queries.insertBranchFile('main', 'src/utils.ts', contentHash);

      const nodes = queries.getNodesByBranch('main');
      expect(nodes).toHaveLength(1);
      expect(nodes[0].name).toBe('testFunc');
    });

    it('should search nodes by branch', () => {
      const contentHash = computeFileHash('src/utils.ts', 'content');

      const node: Node = {
        id: 'node1',
        kind: 'function',
        name: 'testFunction',
        qualifiedName: 'src/utils.ts:testFunction',
        filePath: 'src/utils.ts',
        language: 'typescript',
        startLine: 1,
        endLine: 5,
        startColumn: 0,
        endColumn: 20,
        isExported: false,
        isAsync: false,
        isStatic: false,
        isAbstract: false,
        updatedAt: Date.now(),
      };

      queries.insertSharedNode(node, 'src/utils.ts', contentHash);
      queries.insertBranchFile('main', 'src/utils.ts', contentHash);

      const nodes = queries.searchNodesByBranch('main', 'testFunction');
      expect(nodes).toHaveLength(1);
      expect(nodes[0].name).toBe('testFunction');
    });
  });

  describe('Utility Methods', () => {
    it('should get branch node count', () => {
      const contentHash = computeFileHash('src/utils.ts', 'content');

      const node: Node = {
        id: 'node1',
        kind: 'function',
        name: 'testFunc',
        qualifiedName: 'src/utils.ts:testFunc',
        filePath: 'src/utils.ts',
        language: 'typescript',
        startLine: 1,
        endLine: 5,
        startColumn: 0,
        endColumn: 20,
        isExported: false,
        isAsync: false,
        isStatic: false,
        isAbstract: false,
        updatedAt: Date.now(),
      };

      queries.insertSharedNode(node, 'src/utils.ts', contentHash);
      queries.insertBranchFile('main', 'src/utils.ts', contentHash);

      const count = queries.getBranchNodeCount('main');
      expect(count).toBe(1);
    });

    it('should refresh branch metadata', () => {
      const contentHash = computeFileHash('src/utils.ts', 'content');

      const node: Node = {
        id: 'node1',
        kind: 'function',
        name: 'testFunc',
        qualifiedName: 'src/utils.ts:testFunc',
        filePath: 'src/utils.ts',
        language: 'typescript',
        startLine: 1,
        endLine: 5,
        startColumn: 0,
        endColumn: 20,
        isExported: false,
        isAsync: false,
        isStatic: false,
        isAbstract: false,
        updatedAt: Date.now(),
      };

      queries.insertSharedNode(node, 'src/utils.ts', contentHash);
      queries.insertBranchFile('main', 'src/utils.ts', contentHash);

      queries.refreshBranchMetadata('main');

      const metadata = queries.getBranchMetadata('main');
      expect(metadata?.fileCount).toBe(1);
      expect(metadata?.nodeCount).toBe(1);
      expect(metadata?.isIndexed).toBe(true);
    });
  });
});
