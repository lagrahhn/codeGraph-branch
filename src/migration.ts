/**
 * Branch Migration Utility
 *
 * Handles migration from v1 (per-branch databases) to v2 (shared storage).
 * Provides both automatic and manual migration paths.
 */

import * as fs from 'fs';
import * as path from 'path';
import { getCodeGraphDir } from './directory';
import { DatabaseConnection } from './db';
import { SharedStorageQueries } from './db/shared-queries';
import { computeFileHash } from './utils/content-hash';
import {
  sanitizeBranchName,
  listBranchDbs,
  BranchInfo,
} from './branch';
import {
  Node,
  Edge,
  FileRecord,
} from './types';

/**
 * Migration result
 */
export interface MigrationResult {
  /** Whether migration was successful */
  success: boolean;
  /** Number of branches migrated */
  branchesMigrated: number;
  /** Number of nodes migrated */
  nodesMigrated: number;
  /** Number of edges migrated */
  edgesMigrated: number;
  /** Number of files migrated */
  filesMigrated: number;
  /** Duration in milliseconds */
  durationMs: number;
  /** Any errors that occurred */
  errors: Array<{ message: string; branch?: string; severity: 'error' | 'warning' }>;
}

/**
 * Migration options
 */
export interface MigrationOptions {
  /** Whether to delete old branch databases after migration */
  deleteOldDbs?: boolean;
  /** Whether to run in dry-run mode (no actual changes) */
  dryRun?: boolean;
  /** Progress callback */
  onProgress?: (progress: {
    phase: string;
    current: number;
    total: number;
    branch?: string;
  }) => void;
}

/**
 * Migrate from v1 (per-branch databases) to v2 (shared storage)
 */
export async function migrateToSharedStorage(
  projectRoot: string,
  targetDb: DatabaseConnection,
  options: MigrationOptions = {}
): Promise<MigrationResult> {
  const startTime = Date.now();
  const errors: Array<{ message: string; branch?: string; severity: 'error' | 'warning' }> = [];
  let branchesMigrated = 0;
  let nodesMigrated = 0;
  let edgesMigrated = 0;
  let filesMigrated = 0;

  try {
    // Get list of old branch databases
    const oldBranches = listBranchDbs(projectRoot);

    if (oldBranches.length === 0) {
      return {
        success: true,
        branchesMigrated: 0,
        nodesMigrated: 0,
        edgesMigrated: 0,
        filesMigrated: 0,
        durationMs: Date.now() - startTime,
        errors: [],
      };
    }

    // Initialize shared storage queries
    const sharedQueries = new SharedStorageQueries(targetDb.getDb());

    // Migrate each branch
    for (let i = 0; i < oldBranches.length; i++) {
      const branchInfo = oldBranches[i];
      if (!branchInfo) continue;

      options.onProgress?.({
        phase: 'migrating',
        current: i + 1,
        total: oldBranches.length,
        branch: branchInfo.dirName,
      });

      try {
        const result = await migrateBranch(
          projectRoot,
          branchInfo,
          sharedQueries,
          options.dryRun ?? false
        );

        branchesMigrated++;
        nodesMigrated += result.nodesMigrated;
        edgesMigrated += result.edgesMigrated;
        filesMigrated += result.filesMigrated;

        // Delete old database if requested
        if (options.deleteOldDbs && !options.dryRun) {
          try {
            fs.rmSync(path.dirname(branchInfo.dbPath), { recursive: true, force: true });
          } catch (err) {
            errors.push({
              message: `Failed to delete old DB: ${err instanceof Error ? err.message : String(err)}`,
              branch: branchInfo.dirName,
              severity: 'warning',
            });
          }
        }
      } catch (err) {
        errors.push({
          message: `Migration failed: ${err instanceof Error ? err.message : String(err)}`,
          branch: branchInfo.dirName,
          severity: 'error',
        });
      }
    }

    return {
      success: errors.filter(e => e.severity === 'error').length === 0,
      branchesMigrated,
      nodesMigrated,
      edgesMigrated,
      filesMigrated,
      durationMs: Date.now() - startTime,
      errors,
    };
  } catch (err) {
    return {
      success: false,
      branchesMigrated,
      nodesMigrated,
      edgesMigrated,
      filesMigrated,
      durationMs: Date.now() - startTime,
      errors: [{
        message: `Migration failed: ${err instanceof Error ? err.message : String(err)}`,
        severity: 'error',
      }],
    };
  }
}

/**
 * Migrate a single branch database
 */
async function migrateBranch(
  _projectRoot: string,
  branchInfo: BranchInfo,
  sharedQueries: SharedStorageQueries,
  dryRun: boolean
): Promise<{
  nodesMigrated: number;
  edgesMigrated: number;
  filesMigrated: number;
}> {
  // Open old branch database
  const oldDb = DatabaseConnection.open(branchInfo.dbPath);

  try {
    const db = oldDb.getDb();
    const nodes = db.prepare('SELECT * FROM nodes').all() as Node[];
    const edges = db.prepare('SELECT * FROM edges').all() as Edge[];
    const files = db.prepare('SELECT * FROM files').all() as FileRecord[];

    if (!dryRun) {
      // Insert nodes into shared storage
      for (const node of nodes) {
        // Find which file this node belongs to
        const file = files.find((f: FileRecord) => f.path === node.filePath);
        if (!file) continue;

        const contentHash = computeFileHash(node.filePath, ''); // TODO: Get actual content
        sharedQueries.insertSharedNode(node, node.filePath, contentHash);
      }

      // Insert files into shared storage
      for (const file of files) {
        const contentHash = computeFileHash(file.path, ''); // TODO: Get actual content
        sharedQueries.insertSharedFile(file, contentHash);

        // Create branch-file mapping
        const branchName = sanitizeBranchName(path.basename(path.dirname(branchInfo.dbPath)));
        sharedQueries.insertBranchFile(branchName, file.path, contentHash);
      }

      // Insert edges into branch-specific storage
      const branchName = sanitizeBranchName(path.basename(path.dirname(branchInfo.dbPath)));
      for (const edge of edges) {
        sharedQueries.insertBranchEdge(branchName, edge);
      }

      // Update branch metadata
      sharedQueries.upsertBranchMetadata(branchName, {
        fileCount: files.length,
        nodeCount: nodes.length,
        edgeCount: edges.length,
        isIndexed: true,
      });
    }

    return {
      nodesMigrated: nodes.length,
      edgesMigrated: edges.length,
      filesMigrated: files.length,
    };
  } finally {
    oldDb.close();
  }
}

/**
 * Check if migration is needed
 */
export function needsMigration(projectRoot: string): boolean {
  const branchesDir = path.join(getCodeGraphDir(projectRoot), 'branches');

  // Check if old branch directories exist
  if (!fs.existsSync(branchesDir)) {
    return false;
  }

  const entries = fs.readdirSync(branchesDir, { withFileTypes: true });
  return entries.some(entry => entry.isDirectory());
}

/**
 * Get migration statistics
 */
export function getMigrationStats(projectRoot: string): {
  oldBranchCount: number;
  totalOldSize: number;
  estimatedNewSize: number;
} {
  const oldBranches = listBranchDbs(projectRoot);
  const totalOldSize = oldBranches.reduce((sum, b) => sum + b.sizeBytes, 0);

  // Estimate new size (typically 10-20% of old size due to deduplication)
  const estimatedNewSize = Math.round(totalOldSize * 0.15);

  return {
    oldBranchCount: oldBranches.length,
    totalOldSize,
    estimatedNewSize,
  };
}
