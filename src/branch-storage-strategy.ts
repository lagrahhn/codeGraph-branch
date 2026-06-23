/**
 * Branch Storage Strategy
 *
 * Defines the interface for different branch storage strategies.
 * Supports two modes:
 * 1. Multi-DB: Each branch has its own database (current approach)
 * 2. Shared-DB: Single database with shared storage (optimized approach)
 */

import { DatabaseConnection } from './db';
import { SharedStorageQueries } from './db/shared-queries';
import {
  Node,
  Edge,
  FileRecord,
  NodeKind,
  EdgeKind,
  Language,
} from './types';

/**
 * Storage mode enum
 */
export enum StorageMode {
  /** Each branch has its own database */
  MULTI_DB = 'multi-db',
  /** Single database with shared storage */
  SHARED_DB = 'shared-db',
}

/**
 * Branch storage configuration
 */
export interface BranchStorageConfig {
  /** Storage mode to use */
  mode: StorageMode;
  /** Maximum number of branches to retain (for LRU eviction) */
  maxBranches?: number;
  /** Enable lazy indexing (index on first query) */
  lazyIndex?: boolean;
  /** Enable background pre-indexing */
  backgroundIndex?: boolean;
}

/**
 * Result of a branch operation
 */
export interface BranchOperationResult {
  /** Whether the operation was successful */
  success: boolean;
  /** Duration in milliseconds */
  durationMs: number;
  /** Any errors that occurred */
  errors: Array<{ message: string; severity: 'error' | 'warning' }>;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Branch statistics
 */
export interface BranchStats {
  /** Branch name */
  branch: string;
  /** Number of files */
  fileCount: number;
  /** Number of nodes */
  nodeCount: number;
  /** Number of edges */
  edgeCount: number;
  /** Storage size in bytes */
  sizeBytes: number;
  /** Whether the branch is indexed */
  isIndexed: boolean;
  /** Last access time */
  lastAccessed: number;
}

/**
 * Interface for branch storage strategies
 */
export interface IBranchStorageStrategy {
  /** Storage mode identifier */
  readonly mode: StorageMode;

  /**
   * Initialize the storage strategy
   */
  initialize(projectRoot: string): Promise<void>;

  /**
   * Switch to a different branch
   */
  switchBranch(
    branch: string,
    options?: {
      lazyIndex?: boolean;
      onProgress?: (progress: { phase: string; current: number; total: number }) => void;
    }
  ): Promise<BranchOperationResult>;

  /**
   * Get nodes for the current branch
   */
  getNodes(): Node[];

  /**
   * Get nodes by kind for the current branch
   */
  getNodesByKind(kind: NodeKind): Node[];

  /**
   * Search nodes by name in the current branch
   */
  searchNodes(query: string, limit?: number): Node[];

  /**
   * Get edges for a node in the current branch
   */
  getEdgesForNode(nodeId: string): Edge[];

  /**
   * Get the current branch name
   */
  getCurrentBranch(): string | null;

  /**
   * Get branch statistics
   */
  getBranchStats(branch?: string): BranchStats;

  /**
   * List all indexed branches
   */
  listBranches(): BranchStats[];

  /**
   * Remove a branch index
   */
  removeBranch(branch: string): Promise<boolean>;

  /**
   * Get storage configuration
   */
  getConfig(): BranchStorageConfig;

  /**
   * Update storage configuration
   */
  updateConfig(config: Partial<BranchStorageConfig>): void;

  /**
   * Close the storage and release resources
   */
  close(): void;
}

/**
 * Factory function to create storage strategy
 */
export function createBranchStorageStrategy(
  config: BranchStorageConfig
): IBranchStorageStrategy {
  switch (config.mode) {
    case StorageMode.MULTI_DB:
      return new MultiDbStorageStrategy(config);
    case StorageMode.SHARED_DB:
      return new SharedDbStorageStrategy(config);
    default:
      throw new Error(`Unknown storage mode: ${config.mode}`);
  }
}

// ============================================================================
// Multi-DB Storage Strategy (Current Implementation)
// ============================================================================

/**
 * Multi-DB storage strategy
 *
 * Each branch has its own database file.
 * This is the current/legacy approach.
 */
class MultiDbStorageStrategy implements IBranchStorageStrategy {
  readonly mode = StorageMode.MULTI_DB;

  private config: BranchStorageConfig;
  private projectRoot: string | null = null;
  private currentBranch: string | null = null;
  private currentDb: DatabaseConnection | null = null;

  constructor(config: BranchStorageConfig) {
    this.config = {
      maxBranches: 10,
      lazyIndex: true,
      backgroundIndex: false,
      ...config,
    };
  }

  async initialize(projectRoot: string): Promise<void> {
    this.projectRoot = projectRoot;

    // Import branch management functions
    const { getCurrentBranch, ensureBranchesDir } = await import('./branch');

    this.currentBranch = getCurrentBranch(projectRoot);
    ensureBranchesDir(projectRoot);
  }

  async switchBranch(
    branch: string,
    options?: {
      lazyIndex?: boolean;
      onProgress?: (progress: { phase: string; current: number; total: number }) => void;
    }
  ): Promise<BranchOperationResult> {
    const startTime = Date.now();

    if (!this.projectRoot) {
      return {
        success: false,
        durationMs: Date.now() - startTime,
        errors: [{ message: 'Storage not initialized', severity: 'error' }],
      };
    }

    try {
      // Import branch management functions
      const {
        getCurrentBranch,
        getBranchDbPath,
        branchDbExists,
        setActiveBranch,
        evictOldBranches,
      } = await import('./branch');

      const { CodeGraph } = await import('./index');

      // Close current database if open
      if (this.currentDb) {
        this.currentDb.close();
        this.currentDb = null;
      }

      // Check if branch DB exists
      const hasExisting = branchDbExists(this.projectRoot, branch);

      // Open or create branch database
      const dbPath = getBranchDbPath(this.projectRoot, branch);
      const cg = await CodeGraph.open(this.projectRoot, {
        branch,
        readOnly: false,
      });

      this.currentDb = cg.getDb();
      this.currentBranch = branch;
      setActiveBranch(this.projectRoot, branch);

      // Evict old branches if needed
      if (this.config.maxBranches) {
        evictOldBranches(this.projectRoot, this.config.maxBranches);
      }

      // Index if needed
      if (!hasExisting && options?.lazyIndex !== false) {
        options?.onProgress?.({
          phase: 'indexing',
          current: 0,
          total: 100,
        });

        const result = await cg.indexAll({
          onProgress: options?.onProgress,
        });

        if (!result.success) {
          return {
            success: false,
            durationMs: Date.now() - startTime,
            errors: result.errors,
          };
        }
      }

      return {
        success: true,
        durationMs: Date.now() - startTime,
        errors: [],
        metadata: { branch, isNew: !hasExisting },
      };
    } catch (err) {
      return {
        success: false,
        durationMs: Date.now() - startTime,
        errors: [{
          message: err instanceof Error ? err.message : String(err),
          severity: 'error',
        }],
      };
    }
  }

  getNodes(): Node[] {
    // TODO: Implement using current database
    return [];
  }

  getNodesByKind(kind: NodeKind): Node[] {
    // TODO: Implement using current database
    return [];
  }

  searchNodes(query: string, limit?: number): Node[] {
    // TODO: Implement using current database
    return [];
  }

  getEdgesForNode(nodeId: string): Edge[] {
    // TODO: Implement using current database
    return [];
  }

  getCurrentBranch(): string | null {
    return this.currentBranch;
  }

  getBranchStats(branch?: string): BranchStats {
    // TODO: Implement using branch management functions
    return {
      branch: branch ?? this.currentBranch ?? '',
      fileCount: 0,
      nodeCount: 0,
      edgeCount: 0,
      sizeBytes: 0,
      isIndexed: false,
      lastAccessed: Date.now(),
    };
  }

  listBranches(): BranchStats[] {
    // TODO: Implement using branch management functions
    return [];
  }

  async removeBranch(branch: string): Promise<boolean> {
    // TODO: Implement using branch management functions
    return false;
  }

  getConfig(): BranchStorageConfig {
    return { ...this.config };
  }

  updateConfig(config: Partial<BranchStorageConfig>): void {
    this.config = { ...this.config, ...config };
  }

  close(): void {
    if (this.currentDb) {
      this.currentDb.close();
      this.currentDb = null;
    }
  }
}

// ============================================================================
// Shared-DB Storage Strategy (Optimized Implementation)
// ============================================================================

/**
 * Shared-DB storage strategy
 *
 * Single database with shared storage using content-addressable hashing.
 * This is the optimized approach.
 */
class SharedDbStorageStrategy implements IBranchStorageStrategy {
  readonly mode = StorageMode.SHARED_DB;

  private config: BranchStorageConfig;
  private projectRoot: string | null = null;
  private currentBranch: string | null = null;
  private db: DatabaseConnection | null = null;
  private queries: SharedStorageQueries | null = null;

  constructor(config: BranchStorageConfig) {
    this.config = {
      maxBranches: 10,
      lazyIndex: true,
      backgroundIndex: false,
      ...config,
    };
  }

  async initialize(projectRoot: string): Promise<void> {
    this.projectRoot = projectRoot;

    // Import required functions
    const { getCurrentBranch } = await import('./branch');
    const { DatabaseConnection } = await import('./db');

    this.currentBranch = getCurrentBranch(projectRoot);

    // Open shared database
    const dbPath = `${projectRoot}/.codegraph/shared.db`;
    this.db = DatabaseConnection.initialize(dbPath);

    // Initialize shared storage schema
    const sqliteDb = this.db.getDb();
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

    this.queries = new SharedStorageQueries(sqliteDb);
  }

  async switchBranch(
    branch: string,
    options?: {
      lazyIndex?: boolean;
      onProgress?: (progress: { phase: string; current: number; total: number }) => void;
    }
  ): Promise<BranchOperationResult> {
    const startTime = Date.now();

    if (!this.projectRoot || !this.queries) {
      return {
        success: false,
        durationMs: Date.now() - startTime,
        errors: [{ message: 'Storage not initialized', severity: 'error' }],
      };
    }

    try {
      // Import required functions
      const { getCurrentBranch } = await import('./branch');
      const { computeFileHash } = await import('./utils/content-hash');

      // Check if branch is already indexed
      const metadata = this.queries.getBranchMetadata(branch);
      const isIndexed = metadata?.isIndexed ?? false;

      if (isIndexed && options?.lazyIndex !== false) {
        // Already indexed, just switch
        this.currentBranch = branch;
        this.queries.upsertBranchMetadata(branch, { isIndexed: true });

        return {
          success: true,
          durationMs: Date.now() - startTime,
          errors: [],
          metadata: { branch, isNew: false },
        };
      }

      // Calculate diff with current branch
      const currentBranch = this.currentBranch;
      if (currentBranch) {
        // TODO: Implement git diff detection
        // For now, simulate incremental indexing
      }

      // Index the branch
      options?.onProgress?.({
        phase: 'indexing',
        current: 0,
        total: 100,
      });

      // TODO: Implement actual indexing logic
      // This would use the ExtractionOrchestrator

      this.currentBranch = branch;
      this.queries.upsertBranchMetadata(branch, { isIndexed: true });

      return {
        success: true,
        durationMs: Date.now() - startTime,
        errors: [],
        metadata: { branch, isNew: true },
      };
    } catch (err) {
      return {
        success: false,
        durationMs: Date.now() - startTime,
        errors: [{
          message: err instanceof Error ? err.message : String(err),
          severity: 'error',
        }],
      };
    }
  }

  getNodes(): Node[] {
    if (!this.currentBranch || !this.queries) return [];
    return this.queries.getNodesByBranch(this.currentBranch);
  }

  getNodesByKind(kind: NodeKind): Node[] {
    if (!this.currentBranch || !this.queries) return [];
    return this.queries.getNodesByBranchAndKind(this.currentBranch, kind);
  }

  searchNodes(query: string, limit?: number): Node[] {
    if (!this.currentBranch || !this.queries) return [];
    return this.queries.searchNodesByBranch(this.currentBranch, query, limit);
  }

  getEdgesForNode(nodeId: string): Edge[] {
    if (!this.currentBranch || !this.queries) return [];
    return this.queries.getBranchEdgesBySource(this.currentBranch, nodeId);
  }

  getCurrentBranch(): string | null {
    return this.currentBranch;
  }

  getBranchStats(branch?: string): BranchStats {
    const targetBranch = branch ?? this.currentBranch;
    if (!targetBranch || !this.queries) {
      return {
        branch: targetBranch ?? '',
        fileCount: 0,
        nodeCount: 0,
        edgeCount: 0,
        sizeBytes: 0,
        isIndexed: false,
        lastAccessed: Date.now(),
      };
    }

    const metadata = this.queries.getBranchMetadata(targetBranch);
    return {
      branch: targetBranch,
      fileCount: metadata?.fileCount ?? 0,
      nodeCount: metadata?.nodeCount ?? 0,
      edgeCount: metadata?.edgeCount ?? 0,
      sizeBytes: 0, // TODO: Calculate actual size
      isIndexed: metadata?.isIndexed ?? false,
      lastAccessed: metadata?.lastAccessed ?? Date.now(),
    };
  }

  listBranches(): BranchStats[] {
    // TODO: Implement listing all branches
    return [];
  }

  async removeBranch(branch: string): Promise<boolean> {
    if (!this.queries) return false;

    try {
      // Remove branch data
      this.queries.deleteBranchFiles(branch);
      this.queries.deleteBranchEdges(branch);
      this.queries.deleteBranchMetadata(branch);

      return true;
    } catch {
      return false;
    }
  }

  getConfig(): BranchStorageConfig {
    return { ...this.config };
  }

  updateConfig(config: Partial<BranchStorageConfig>): void {
    this.config = { ...this.config, ...config };
  }

  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.queries = null;
    }
  }
}
