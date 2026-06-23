/**
 * Shared Storage Query Builder
 *
 * Provides prepared statements for content-addressable shared storage.
 * Works with the v2 schema (shared_nodes, shared_files, branch_files, branch_edges).
 */

import { SqliteDatabase, SqliteStatement } from './sqlite-adapter';
import {
  Node,
  Edge,
  FileRecord,
  NodeKind,
  EdgeKind,
  Language,
} from '../types';
import { safeJsonParse } from '../utils';

/**
 * Database row types for shared storage
 */
interface SharedNodeRow {
  id: string;
  file_path: string;
  content_hash: string;
  kind: string;
  name: string;
  qualified_name: string;
  language: string;
  start_line: number;
  end_line: number;
  start_column: number;
  end_column: number;
  docstring: string | null;
  signature: string | null;
  visibility: string | null;
  is_exported: number;
  is_async: number;
  is_static: number;
  is_abstract: number;
  decorators: string | null;
  type_parameters: string | null;
  updated_at: number;
}

interface SharedFileRow {
  path: string;
  content_hash: string;
  language: string;
  size: number;
  modified_at: number;
  indexed_at: number;
  node_count: number;
  errors: string | null;
}

interface BranchFileRow {
  branch: string;
  file_path: string;
  content_hash: string;
}

interface BranchEdgeRow {
  id: number;
  branch: string;
  source: string;
  target: string;
  kind: string;
  metadata: string | null;
  line: number | null;
  col: number | null;
  provenance: string | null;
}

interface BranchMetadataRow {
  branch: string;
  created_at: number;
  last_accessed: number;
  file_count: number;
  node_count: number;
  edge_count: number;
  is_indexed: number;
}

/**
 * Convert SharedNodeRow to Node object
 */
function sharedRowToNode(row: SharedNodeRow): Node {
  return {
    id: row.id,
    kind: row.kind as NodeKind,
    name: row.name,
    qualifiedName: row.qualified_name,
    filePath: row.file_path,
    language: row.language as Language,
    startLine: row.start_line,
    endLine: row.end_line,
    startColumn: row.start_column,
    endColumn: row.end_column,
    docstring: row.docstring ?? undefined,
    signature: row.signature ?? undefined,
    visibility: row.visibility as Node['visibility'],
    isExported: row.is_exported === 1,
    isAsync: row.is_async === 1,
    isStatic: row.is_static === 1,
    isAbstract: row.is_abstract === 1,
    decorators: row.decorators ? safeJsonParse(row.decorators, undefined) : undefined,
    typeParameters: row.type_parameters ? safeJsonParse(row.type_parameters, undefined) : undefined,
    updatedAt: row.updated_at,
  };
}

/**
 * Convert BranchEdgeRow to Edge object
 */
function branchEdgeRowToEdge(row: BranchEdgeRow): Edge {
  return {
    source: row.source,
    target: row.target,
    kind: row.kind as EdgeKind,
    metadata: row.metadata ? safeJsonParse(row.metadata, undefined) : undefined,
    line: row.line ?? undefined,
    column: row.col ?? undefined,
    provenance: row.provenance as Edge['provenance'],
  };
}

/**
 * Query builder for shared storage operations
 */
export class SharedStorageQueries {
  private db: SqliteDatabase;

  // Prepared statements (lazily initialized)
  private stmts: {
    // Shared nodes
    insertSharedNode?: SqliteStatement;
    getSharedNodeById?: SqliteStatement;
    getSharedNodesByFileHash?: SqliteStatement;
    deleteSharedNodesByFileHash?: SqliteStatement;

    // Shared files
    insertSharedFile?: SqliteStatement;
    getSharedFileByPathHash?: SqliteStatement;
    deleteSharedFileByPathHash?: SqliteStatement;

    // Branch files
    insertBranchFile?: SqliteStatement;
    getBranchFiles?: SqliteStatement;
    getBranchFileByPath?: SqliteStatement;
    deleteBranchFiles?: SqliteStatement;
    deleteBranchFileByPath?: SqliteStatement;

    // Branch edges
    insertBranchEdge?: SqliteStatement;
    getBranchEdgesBySource?: SqliteStatement;
    getBranchEdgesByTarget?: SqliteStatement;
    getBranchEdgesByKind?: SqliteStatement;
    deleteBranchEdges?: SqliteStatement;

    // Branch metadata
    upsertBranchMetadata?: SqliteStatement;
    getBranchMetadata?: SqliteStatement;
    deleteBranchMetadata?: SqliteStatement;

    // Cross-branch queries
    getNodesByBranch?: SqliteStatement;
    getNodesByBranchAndKind?: SqliteStatement;
    searchNodesByBranch?: SqliteStatement;
  } = {};

  constructor(db: SqliteDatabase) {
    this.db = db;
  }

  // ===========================================================================
  // Shared Nodes Operations
  // ===========================================================================

  /**
   * Insert a shared node
   */
  insertSharedNode(node: Node, filePath: string, contentHash: string): void {
    if (!this.stmts.insertSharedNode) {
      this.stmts.insertSharedNode = this.db.prepare(`
        INSERT OR REPLACE INTO shared_nodes (
          id, file_path, content_hash, kind, name, qualified_name,
          language, start_line, end_line, start_column, end_column,
          docstring, signature, visibility,
          is_exported, is_async, is_static, is_abstract,
          decorators, type_parameters, updated_at
        ) VALUES (
          @id, @filePath, @contentHash, @kind, @name, @qualifiedName,
          @language, @startLine, @endLine, @startColumn, @endColumn,
          @docstring, @signature, @visibility,
          @isExported, @isAsync, @isStatic, @isAbstract,
          @decorators, @typeParameters, @updatedAt
        )
      `);
    }

    this.stmts.insertSharedNode.run({
      id: node.id,
      filePath,
      contentHash,
      kind: node.kind,
      name: node.name,
      qualifiedName: node.qualifiedName ?? node.name,
      language: node.language,
      startLine: node.startLine ?? 0,
      endLine: node.endLine ?? 0,
      startColumn: node.startColumn ?? 0,
      endColumn: node.endColumn ?? 0,
      docstring: node.docstring ?? null,
      signature: node.signature ?? null,
      visibility: node.visibility ?? null,
      isExported: node.isExported ? 1 : 0,
      isAsync: node.isAsync ? 1 : 0,
      isStatic: node.isStatic ? 1 : 0,
      isAbstract: node.isAbstract ? 1 : 0,
      decorators: node.decorators ? JSON.stringify(node.decorators) : null,
      typeParameters: node.typeParameters ? JSON.stringify(node.typeParameters) : null,
      updatedAt: node.updatedAt ?? Date.now(),
    });
  }

  /**
   * Get a shared node by ID
   */
  getSharedNodeById(id: string): Node | null {
    if (!this.stmts.getSharedNodeById) {
      this.stmts.getSharedNodeById = this.db.prepare(
        'SELECT * FROM shared_nodes WHERE id = ?'
      );
    }

    const row = this.stmts.getSharedNodeById.get(id) as SharedNodeRow | undefined;
    return row ? sharedRowToNode(row) : null;
  }

  /**
   * Get all shared nodes for a specific file version
   */
  getSharedNodesByFileHash(filePath: string, contentHash: string): Node[] {
    if (!this.stmts.getSharedNodesByFileHash) {
      this.stmts.getSharedNodesByFileHash = this.db.prepare(
        'SELECT * FROM shared_nodes WHERE file_path = ? AND content_hash = ?'
      );
    }

    const rows = this.stmts.getSharedNodesByFileHash.all(filePath, contentHash) as SharedNodeRow[];
    return rows.map(sharedRowToNode);
  }

  /**
   * Delete shared nodes for a specific file version
   */
  deleteSharedNodesByFileHash(filePath: string, contentHash: string): number {
    if (!this.stmts.deleteSharedNodesByFileHash) {
      this.stmts.deleteSharedNodesByFileHash = this.db.prepare(
        'DELETE FROM shared_nodes WHERE file_path = ? AND content_hash = ?'
      );
    }

    const result = this.stmts.deleteSharedNodesByFileHash.run(filePath, contentHash);
    return result.changes;
  }

  // ===========================================================================
  // Shared Files Operations
  // ===========================================================================

  /**
   * Insert a shared file record
   */
  insertSharedFile(file: FileRecord, contentHash: string): void {
    if (!this.stmts.insertSharedFile) {
      this.stmts.insertSharedFile = this.db.prepare(`
        INSERT OR REPLACE INTO shared_files (
          path, content_hash, language, size, modified_at,
          indexed_at, node_count, errors
        ) VALUES (
          @path, @contentHash, @language, @size, @modifiedAt,
          @indexedAt, @nodeCount, @errors
        )
      `);
    }

    this.stmts.insertSharedFile.run({
      path: file.path,
      contentHash,
      language: file.language,
      size: file.size,
      modifiedAt: file.modifiedAt,
      indexedAt: file.indexedAt,
      nodeCount: file.nodeCount,
      errors: file.errors ? JSON.stringify(file.errors) : null,
    });
  }

  /**
   * Get a shared file by path and content hash
   */
  getSharedFileByPathHash(filePath: string, contentHash: string): FileRecord | null {
    if (!this.stmts.getSharedFileByPathHash) {
      this.stmts.getSharedFileByPathHash = this.db.prepare(
        'SELECT * FROM shared_files WHERE path = ? AND content_hash = ?'
      );
    }

    const row = this.stmts.getSharedFileByPathHash.get(filePath, contentHash) as SharedFileRow | undefined;
    if (!row) return null;

    return {
      path: row.path,
      contentHash: row.content_hash,
      language: row.language as Language,
      size: row.size,
      modifiedAt: row.modified_at,
      indexedAt: row.indexed_at,
      nodeCount: row.node_count,
      errors: row.errors ? safeJsonParse(row.errors, undefined) : undefined,
    };
  }

  /**
   * Delete a shared file by path and content hash
   */
  deleteSharedFileByPathHash(filePath: string, contentHash: string): number {
    if (!this.stmts.deleteSharedFileByPathHash) {
      this.stmts.deleteSharedFileByPathHash = this.db.prepare(
        'DELETE FROM shared_files WHERE path = ? AND content_hash = ?'
      );
    }

    const result = this.stmts.deleteSharedFileByPathHash.run(filePath, contentHash);
    return result.changes;
  }

  // ===========================================================================
  // Branch Files Operations
  // ===========================================================================

  /**
   * Insert or update a branch file mapping
   */
  insertBranchFile(branch: string, filePath: string, contentHash: string): void {
    if (!this.stmts.insertBranchFile) {
      this.stmts.insertBranchFile = this.db.prepare(`
        INSERT OR REPLACE INTO branch_files (branch, file_path, content_hash)
        VALUES (@branch, @filePath, @contentHash)
      `);
    }

    this.stmts.insertBranchFile.run({ branch, filePath, contentHash });
  }

  /**
   * Get all file mappings for a branch
   */
  getBranchFiles(branch: string): Array<{ filePath: string; contentHash: string }> {
    if (!this.stmts.getBranchFiles) {
      this.stmts.getBranchFiles = this.db.prepare(
        'SELECT file_path, content_hash FROM branch_files WHERE branch = ?'
      );
    }

    const rows = this.stmts.getBranchFiles.all(branch) as BranchFileRow[];
    return rows.map(row => ({
      filePath: row.file_path,
      contentHash: row.content_hash,
    }));
  }

  /**
   * Get content hash for a specific file in a branch
   */
  getBranchFileByPath(branch: string, filePath: string): string | null {
    if (!this.stmts.getBranchFileByPath) {
      this.stmts.getBranchFileByPath = this.db.prepare(
        'SELECT content_hash FROM branch_files WHERE branch = ? AND file_path = ?'
      );
    }

    const row = this.stmts.getBranchFileByPath.get(branch, filePath) as { content_hash: string } | undefined;
    return row?.content_hash ?? null;
  }

  /**
   * Delete all file mappings for a branch
   */
  deleteBranchFiles(branch: string): number {
    if (!this.stmts.deleteBranchFiles) {
      this.stmts.deleteBranchFiles = this.db.prepare(
        'DELETE FROM branch_files WHERE branch = ?'
      );
    }

    const result = this.stmts.deleteBranchFiles.run(branch);
    return result.changes;
  }

  /**
   * Delete a specific file mapping for a branch
   */
  deleteBranchFileByPath(branch: string, filePath: string): number {
    if (!this.stmts.deleteBranchFileByPath) {
      this.stmts.deleteBranchFileByPath = this.db.prepare(
        'DELETE FROM branch_files WHERE branch = ? AND file_path = ?'
      );
    }

    const result = this.stmts.deleteBranchFileByPath.run(branch, filePath);
    return result.changes;
  }

  // ===========================================================================
  // Branch Edges Operations
  // ===========================================================================

  /**
   * Insert a branch edge
   */
  insertBranchEdge(branch: string, edge: Edge): void {
    if (!this.stmts.insertBranchEdge) {
      this.stmts.insertBranchEdge = this.db.prepare(`
        INSERT INTO branch_edges (branch, source, target, kind, metadata, line, col, provenance)
        VALUES (@branch, @source, @target, @kind, @metadata, @line, @col, @provenance)
      `);
    }

    this.stmts.insertBranchEdge.run({
      branch,
      source: edge.source,
      target: edge.target,
      kind: edge.kind,
      metadata: edge.metadata ? JSON.stringify(edge.metadata) : null,
      line: edge.line ?? null,
      col: edge.column ?? null,
      provenance: edge.provenance ?? null,
    });
  }

  /**
   * Get edges by source node for a branch
   */
  getBranchEdgesBySource(branch: string, sourceId: string): Edge[] {
    if (!this.stmts.getBranchEdgesBySource) {
      this.stmts.getBranchEdgesBySource = this.db.prepare(
        'SELECT * FROM branch_edges WHERE branch = ? AND source = ?'
      );
    }

    const rows = this.stmts.getBranchEdgesBySource.all(branch, sourceId) as BranchEdgeRow[];
    return rows.map(branchEdgeRowToEdge);
  }

  /**
   * Get edges by target node for a branch
   */
  getBranchEdgesByTarget(branch: string, targetId: string): Edge[] {
    if (!this.stmts.getBranchEdgesByTarget) {
      this.stmts.getBranchEdgesByTarget = this.db.prepare(
        'SELECT * FROM branch_edges WHERE branch = ? AND target = ?'
      );
    }

    const rows = this.stmts.getBranchEdgesByTarget.all(branch, targetId) as BranchEdgeRow[];
    return rows.map(branchEdgeRowToEdge);
  }

  /**
   * Get edges by kind for a branch
   */
  getBranchEdgesByKind(branch: string, kind: EdgeKind): Edge[] {
    if (!this.stmts.getBranchEdgesByKind) {
      this.stmts.getBranchEdgesByKind = this.db.prepare(
        'SELECT * FROM branch_edges WHERE branch = ? AND kind = ?'
      );
    }

    const rows = this.stmts.getBranchEdgesByKind.all(branch, kind) as BranchEdgeRow[];
    return rows.map(branchEdgeRowToEdge);
  }

  /**
   * Delete all edges for a branch
   */
  deleteBranchEdges(branch: string): number {
    if (!this.stmts.deleteBranchEdges) {
      this.stmts.deleteBranchEdges = this.db.prepare(
        'DELETE FROM branch_edges WHERE branch = ?'
      );
    }

    const result = this.stmts.deleteBranchEdges.run(branch);
    return result.changes;
  }

  // ===========================================================================
  // Branch Metadata Operations
  // ===========================================================================

  /**
   * Upsert branch metadata
   */
  upsertBranchMetadata(
    branch: string,
    metadata: {
      fileCount?: number;
      nodeCount?: number;
      edgeCount?: number;
      isIndexed?: boolean;
    }
  ): void {
    if (!this.stmts.upsertBranchMetadata) {
      this.stmts.upsertBranchMetadata = this.db.prepare(`
        INSERT INTO branch_metadata (branch, created_at, last_accessed, file_count, node_count, edge_count, is_indexed)
        VALUES (@branch, @createdAt, @lastAccessed, @fileCount, @nodeCount, @edgeCount, @isIndexed)
        ON CONFLICT(branch) DO UPDATE SET
          last_accessed = @lastAccessed,
          file_count = @fileCount,
          node_count = @nodeCount,
          edge_count = @edgeCount,
          is_indexed = @isIndexed
      `);
    }

    const now = Date.now();
    this.stmts.upsertBranchMetadata.run({
      branch,
      createdAt: now,
      lastAccessed: now,
      fileCount: metadata.fileCount ?? 0,
      nodeCount: metadata.nodeCount ?? 0,
      edgeCount: metadata.edgeCount ?? 0,
      isIndexed: metadata.isIndexed ? 1 : 0,
    });
  }

  /**
   * Get branch metadata
   */
  getBranchMetadata(branch: string): {
    createdAt: number;
    lastAccessed: number;
    fileCount: number;
    nodeCount: number;
    edgeCount: number;
    isIndexed: boolean;
  } | null {
    if (!this.stmts.getBranchMetadata) {
      this.stmts.getBranchMetadata = this.db.prepare(
        'SELECT * FROM branch_metadata WHERE branch = ?'
      );
    }

    const row = this.stmts.getBranchMetadata.get(branch) as BranchMetadataRow | undefined;
    if (!row) return null;

    return {
      createdAt: row.created_at,
      lastAccessed: row.last_accessed,
      fileCount: row.file_count,
      nodeCount: row.node_count,
      edgeCount: row.edge_count,
      isIndexed: row.is_indexed === 1,
    };
  }

  /**
   * Delete branch metadata
   */
  deleteBranchMetadata(branch: string): number {
    if (!this.stmts.deleteBranchMetadata) {
      this.stmts.deleteBranchMetadata = this.db.prepare(
        'DELETE FROM branch_metadata WHERE branch = ?'
      );
    }

    const result = this.stmts.deleteBranchMetadata.run(branch);
    return result.changes;
  }

  // ===========================================================================
  // Cross-Branch Query Operations
  // ===========================================================================

  /**
   * Get all nodes for a branch (joins shared_nodes with branch_files)
   */
  getNodesByBranch(branch: string): Node[] {
    if (!this.stmts.getNodesByBranch) {
      this.stmts.getNodesByBranch = this.db.prepare(`
        SELECT n.* FROM shared_nodes n
        JOIN branch_files bf ON n.file_path = bf.file_path AND n.content_hash = bf.content_hash
        WHERE bf.branch = ?
      `);
    }

    const rows = this.stmts.getNodesByBranch.all(branch) as SharedNodeRow[];
    return rows.map(sharedRowToNode);
  }

  /**
   * Get nodes by kind for a branch
   */
  getNodesByBranchAndKind(branch: string, kind: NodeKind): Node[] {
    if (!this.stmts.getNodesByBranchAndKind) {
      this.stmts.getNodesByBranchAndKind = this.db.prepare(`
        SELECT n.* FROM shared_nodes n
        JOIN branch_files bf ON n.file_path = bf.file_path AND n.content_hash = bf.content_hash
        WHERE bf.branch = ? AND n.kind = ?
      `);
    }

    const rows = this.stmts.getNodesByBranchAndKind.all(branch, kind) as SharedNodeRow[];
    return rows.map(sharedRowToNode);
  }

  /**
   * Search nodes by name within a branch
   */
  searchNodesByBranch(branch: string, query: string, limit: number = 20): Node[] {
    if (!this.stmts.searchNodesByBranch) {
      this.stmts.searchNodesByBranch = this.db.prepare(`
        SELECT n.* FROM shared_nodes n
        JOIN branch_files bf ON n.file_path = bf.file_path AND n.content_hash = bf.content_hash
        WHERE bf.branch = ? AND (n.name LIKE ? OR n.qualified_name LIKE ?)
        LIMIT ?
      `);
    }

    const pattern = `%${query}%`;
    const rows = this.stmts.searchNodesByBranch.all(branch, pattern, pattern, limit) as SharedNodeRow[];
    return rows.map(sharedRowToNode);
  }

  // ===========================================================================
  // Utility Methods
  // ===========================================================================

  /**
   * Get total node count for a branch
   */
  getBranchNodeCount(branch: string): number {
    const stmt = this.db.prepare(`
      SELECT COUNT(*) as count FROM shared_nodes n
      JOIN branch_files bf ON n.file_path = bf.file_path AND n.content_hash = bf.content_hash
      WHERE bf.branch = ?
    `);

    const row = stmt.get(branch) as { count: number };
    return row.count;
  }

  /**
   * Get total edge count for a branch
   */
  getBranchEdgeCount(branch: string): number {
    const stmt = this.db.prepare(
      'SELECT COUNT(*) as count FROM branch_edges WHERE branch = ?'
    );

    const row = stmt.get(branch) as { count: number };
    return row.count;
  }

  /**
   * Get file count for a branch
   */
  getBranchFileCount(branch: string): number {
    const stmt = this.db.prepare(
      'SELECT COUNT(*) as count FROM branch_files WHERE branch = ?'
    );

    const row = stmt.get(branch) as { count: number };
    return row.count;
  }

  /**
   * Update branch metadata with current counts
   */
  refreshBranchMetadata(branch: string): void {
    const fileCount = this.getBranchFileCount(branch);
    const nodeCount = this.getBranchNodeCount(branch);
    const edgeCount = this.getBranchEdgeCount(branch);

    this.upsertBranchMetadata(branch, {
      fileCount,
      nodeCount,
      edgeCount,
      isIndexed: true,
    });
  }
}
