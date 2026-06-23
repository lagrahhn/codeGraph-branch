/**
 * Optimized Branch Manager
 *
 * Manages branch switching with incremental indexing using content-addressable storage.
 * Provides fast branch switching by only re-indexing changed files.
 */

import * as fs from 'fs';
import * as path from 'path';
import { execFileSync } from 'child_process';
import { getCodeGraphDir } from './directory';
import { DatabaseConnection } from './db';
import { SharedStorageQueries } from './db/shared-queries';
import { computeFileHash } from './utils/content-hash';
import { sanitizeBranchName, getCurrentBranch } from './branch';
import {
  Node,
  Edge,
  FileRecord,
  Language,
} from './types';

/**
 * Result of a branch switch operation
 */
export interface BranchSwitchResult {
  /** Whether the switch was successful */
  success: boolean;
  /** Number of files that changed */
  filesChanged: number;
  /** Number of new nodes created */
  nodesCreated: number;
  /** Number of new edges created */
  edgesCreated: number;
  /** Duration in milliseconds */
  durationMs: number;
  /** Any errors that occurred */
  errors: Array<{ message: string; severity: 'error' | 'warning' }>;
}

/**
 * Options for branch operations
 */
export interface BranchOptions {
  /** Whether to index the branch if not already indexed */
  lazyIndex?: boolean;
  /** Whether to run in background */
  background?: boolean;
  /** Progress callback */
  onProgress?: (progress: { phase: string; current: number; total: number }) => void;
}

/**
 * Optimized branch manager with incremental indexing
 */
export class OptimizedBranchManager {
  private projectRoot: string;
  private db: DatabaseConnection;
  private queries: SharedStorageQueries;
  private currentBranch: string | null = null;

  // Cache for recently accessed branches
  private branchCache = new Map<string, {
    nodes: Node[];
    edges: Edge[];
    lastAccessed: number;
  }>();

  private readonly maxCacheSize = 5;
  private readonly cacheTtl = 1000 * 60 * 10; // 10 minutes

  constructor(projectRoot: string, db: DatabaseConnection) {
    this.projectRoot = projectRoot;
    this.db = db;
    this.queries = new SharedStorageQueries(db.getDb());
    this.currentBranch = getCurrentBranch(projectRoot);
  }

  // ===========================================================================
  // Public API
  // ===========================================================================

  /**
   * Switch to a different branch with incremental indexing
   */
  async switchBranch(
    targetBranch: string,
    options: BranchOptions = {}
  ): Promise<BranchSwitchResult> {
    const startTime = Date.now();
    const errors: Array<{ message: string; severity: 'error' | 'warning' }> = [];

    try {
      // Get current branch
      const currentBranch = this.currentBranch;
      if (!currentBranch) {
        return {
          success: false,
          filesChanged: 0,
          nodesCreated: 0,
          edgesCreated: 0,
          durationMs: Date.now() - startTime,
          errors: [{ message: 'Not on a git branch', severity: 'error' }],
        };
      }

      // Check if target branch is already indexed
      const metadata = this.queries.getBranchMetadata(targetBranch);
      if (metadata?.isIndexed && options.lazyIndex !== false) {
        // Already indexed, just switch
        this.currentBranch = targetBranch;
        this.queries.upsertBranchMetadata(targetBranch, { isIndexed: true });

        return {
          success: true,
          filesChanged: 0,
          nodesCreated: 0,
          edgesCreated: 0,
          durationMs: Date.now() - startTime,
          errors,
        };
      }

      // Calculate diff between branches
      const changedFiles = await this.getChangedFiles(currentBranch, targetBranch);

      if (changedFiles.length === 0) {
        // No changes, just update metadata
        this.currentBranch = targetBranch;
        this.queries.upsertBranchMetadata(targetBranch, { isIndexed: true });

        return {
          success: true,
          filesChanged: 0,
          nodesCreated: 0,
          edgesCreated: 0,
          durationMs: Date.now() - startTime,
          errors,
        };
      }

      // Index changed files
      let nodesCreated = 0;
      let edgesCreated = 0;

      for (let i = 0; i < changedFiles.length; i++) {
        const file = changedFiles[i];

        // Report progress
        options.onProgress?.({
          phase: 'indexing',
          current: i + 1,
          total: changedFiles.length,
        });

        try {
          const result = await this.indexFileIncremental(
            file.path,
            targetBranch,
            file.status
          );
          nodesCreated += result.nodesCreated;
          edgesCreated += result.edgesCreated;
        } catch (err) {
          errors.push({
            message: `Failed to index ${file.path}: ${err instanceof Error ? err.message : String(err)}`,
            severity: 'warning',
          });
        }
      }

      // Update branch metadata
      this.queries.refreshBranchMetadata(targetBranch);
      this.currentBranch = targetBranch;

      return {
        success: true,
        filesChanged: changedFiles.length,
        nodesCreated,
        edgesCreated,
        durationMs: Date.now() - startTime,
        errors,
      };
    } catch (err) {
      return {
        success: false,
        filesChanged: 0,
        nodesCreated: 0,
        edgesCreated: 0,
        durationMs: Date.now() - startTime,
        errors: [{
          message: `Branch switch failed: ${err instanceof Error ? err.message : String(err)}`,
          severity: 'error',
        }],
      };
    }
  }

  /**
   * Get nodes for the current branch
   */
  getNodes(): Node[] {
    if (!this.currentBranch) return [];
    return this.queries.getNodesByBranch(this.currentBranch);
  }

  /**
   * Get nodes by kind for the current branch
   */
  getNodesByKind(kind: string): Node[] {
    if (!this.currentBranch) return [];
    return this.queries.getNodesByBranchAndKind(this.currentBranch, kind as any);
  }

  /**
   * Search nodes by name in the current branch
   */
  searchNodes(query: string, limit?: number): Node[] {
    if (!this.currentBranch) return [];
    return this.queries.searchNodesByBranch(this.currentBranch, query, limit);
  }

  /**
   * Get edges for a node in the current branch
   */
  getEdgesForNode(nodeId: string): Edge[] {
    if (!this.currentBranch) return [];
    return this.queries.getBranchEdgesBySource(this.currentBranch, nodeId);
  }

  /**
   * Get the current branch name
   */
  getCurrentBranch(): string | null {
    return this.currentBranch;
  }

  /**
   * Get branch statistics
   */
  getBranchStats(branch?: string): {
    fileCount: number;
    nodeCount: number;
    edgeCount: number;
    isIndexed: boolean;
  } {
    const targetBranch = branch ?? this.currentBranch;
    if (!targetBranch) {
      return { fileCount: 0, nodeCount: 0, edgeCount: 0, isIndexed: false };
    }

    const metadata = this.queries.getBranchMetadata(targetBranch);
    return {
      fileCount: metadata?.fileCount ?? 0,
      nodeCount: metadata?.nodeCount ?? 0,
      edgeCount: metadata?.edgeCount ?? 0,
      isIndexed: metadata?.isIndexed ?? false,
    };
  }

  // ===========================================================================
  // Private Implementation
  // ===========================================================================

  /**
   * Get changed files between two branches using git diff
   */
  private async getChangedFiles(
    fromBranch: string,
    toBranch: string
  ): Promise<Array<{ path: string; status: 'added' | 'modified' | 'deleted' }>> {
    try {
      // Use git diff to get changed files
      const output = execFileSync(
        'git',
        ['diff', '--name-status', fromBranch, toBranch],
        {
          cwd: this.projectRoot,
          encoding: 'utf-8',
          timeout: 30000,
        }
      );

      const changes: Array<{ path: string; status: 'added' | 'modified' | 'deleted' }> = [];

      for (const line of output.split('\n')) {
        if (!line.trim()) continue;

        const [status, filePath] = line.split('\t');
        if (!status || !filePath) continue;

        let changeStatus: 'added' | 'modified' | 'deleted';
        switch (status[0]) {
          case 'A':
            changeStatus = 'added';
            break;
          case 'M':
            changeStatus = 'modified';
            break;
          case 'D':
            changeStatus = 'deleted';
            break;
          default:
            continue; // Skip unknown statuses
        }

        changes.push({ path: filePath, status: changeStatus });
      }

      return changes;
    } catch (err) {
      // If git diff fails, return empty array (will trigger full re-index)
      return [];
    }
  }

  /**
   * Index a file incrementally
   */
  private async indexFileIncremental(
    filePath: string,
    branch: string,
    status: 'added' | 'modified' | 'deleted'
  ): Promise<{ nodesCreated: number; edgesCreated: number }> {
    const fullPath = path.join(this.projectRoot, filePath);

    if (status === 'deleted') {
      // Remove file mapping from branch
      this.queries.deleteBranchFileByPath(branch, filePath);
      return { nodesCreated: 0, edgesCreated: 0 };
    }

    // Read file content
    let content: string;
    try {
      content = await fs.promises.readFile(fullPath, 'utf-8');
    } catch (err) {
      throw new Error(`Cannot read file: ${err}`);
    }

    // Compute content hash
    const contentHash = computeFileHash(filePath, content);

    // Check if this version already exists in shared storage
    const existingNodes = this.queries.getSharedNodesByFileHash(filePath, contentHash);

    if (existingNodes.length > 0) {
      // File version already indexed, just update branch mapping
      this.queries.insertBranchFile(branch, filePath, contentHash);
      return { nodesCreated: 0, edgesCreated: 0 };
    }

    // New file version, need to parse and index
    // TODO: Integrate with actual extraction logic
    // For now, create a placeholder implementation

    const nodes = await this.extractNodesFromFile(filePath, content, contentHash);
    let edgesCreated = 0;

    // Insert nodes into shared storage
    for (const node of nodes) {
      this.queries.insertSharedNode(node, filePath, contentHash);
    }

    // Update branch file mapping
    this.queries.insertBranchFile(branch, filePath, contentHash);

    // Insert shared file record
    const fileRecord: FileRecord = {
      path: filePath,
      contentHash,
      language: this.detectLanguage(filePath),
      size: content.length,
      modifiedAt: Date.now(),
      indexedAt: Date.now(),
      nodeCount: nodes.length,
    };
    this.queries.insertSharedFile(fileRecord, contentHash);

    return { nodesCreated: nodes.length, edgesCreated };
  }

  /**
   * Extract nodes from a file (placeholder implementation)
   *
   * TODO: Integrate with actual tree-sitter extraction
   */
  private async extractNodesFromFile(
    filePath: string,
    content: string,
    contentHash: string
  ): Promise<Node[]> {
    // This is a placeholder implementation
    // In production, this should use the actual ExtractionOrchestrator

    const language = this.detectLanguage(filePath);
    const nodes: Node[] = [];

    // Simple extraction: create a module node for the file
    const moduleId = `module:${filePath}:${contentHash}`;
    nodes.push({
      id: moduleId,
      kind: 'module',
      name: path.basename(filePath, path.extname(filePath)),
      qualifiedName: filePath,
      filePath,
      language,
      startLine: 1,
      endLine: content.split('\n').length,
      startColumn: 0,
      endColumn: 0,
      isExported: false,
      isAsync: false,
      isStatic: false,
      isAbstract: false,
      updatedAt: Date.now(),
    });

    return nodes;
  }

  /**
   * Detect language from file extension
   */
  private detectLanguage(filePath: string): Language {
    const ext = path.extname(filePath).toLowerCase();
    const languageMap: Record<string, Language> = {
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.py': 'python',
      '.go': 'go',
      '.rs': 'rust',
      '.java': 'java',
      '.kt': 'kotlin',
      '.swift': 'swift',
      '.rb': 'ruby',
      '.php': 'php',
      '.cs': 'csharp',
      '.cpp': 'cpp',
      '.c': 'c',
      '.h': 'c',
      '.hpp': 'cpp',
    };
    return languageMap[ext] ?? 'unknown';
  }

  // ===========================================================================
  // Cache Management
  // ===========================================================================

  /**
   * Get cached branch data
   */
  private getCachedBranch(branch: string): { nodes: Node[]; edges: Edge[] } | null {
    const cached = this.branchCache.get(branch);
    if (!cached) return null;

    // Check TTL
    if (Date.now() - cached.lastAccessed > this.cacheTtl) {
      this.branchCache.delete(branch);
      return null;
    }

    // Update last accessed
    cached.lastAccessed = Date.now();
    return cached;
  }

  /**
   * Cache branch data
   */
  private cacheBranch(branch: string, nodes: Node[], edges: Edge[]): void {
    // Implement LRU eviction
    if (this.branchCache.size >= this.maxCacheSize) {
      let oldestBranch: string | null = null;
      let oldestTime = Infinity;

      for (const [b, data] of this.branchCache) {
        if (data.lastAccessed < oldestTime) {
          oldestTime = data.lastAccessed;
          oldestBranch = b;
        }
      }

      if (oldestBranch) {
        this.branchCache.delete(oldestBranch);
      }
    }

    this.branchCache.set(branch, {
      nodes,
      edges,
      lastAccessed: Date.now(),
    });
  }

  /**
   * Clear branch cache
   */
  clearCache(): void {
    this.branchCache.clear();
  }
}

/**
 * Create an optimized branch manager instance
 */
export function createOptimizedBranchManager(
  projectRoot: string,
  db: DatabaseConnection
): OptimizedBranchManager {
  return new OptimizedBranchManager(projectRoot, db);
}
