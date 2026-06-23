-- CodeGraph Branch Optimization Schema
-- Version 2: Content-Addressable Shared Storage

-- Schema version tracking (increment from v1)
CREATE TABLE IF NOT EXISTS schema_versions (
    version INTEGER PRIMARY KEY,
    applied_at INTEGER NOT NULL,
    description TEXT
);

-- Insert v2 version
INSERT OR IGNORE INTO schema_versions (version, applied_at, description)
VALUES (2, strftime('%s', 'now') * 1000, 'Content-addressable shared storage');

-- =============================================================================
-- Shared Tables (Content-Addressable)
-- =============================================================================

-- Shared nodes: deduplicated by (file_path, content_hash, name, kind, start_line)
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
    decorators TEXT, -- JSON array
    type_parameters TEXT, -- JSON array
    updated_at INTEGER NOT NULL,
    -- Unique constraint for deduplication
    UNIQUE(file_path, content_hash, name, kind, start_line)
);

-- Shared files: track file versions across branches
CREATE TABLE IF NOT EXISTS shared_files (
    path TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    language TEXT NOT NULL,
    size INTEGER NOT NULL,
    modified_at INTEGER NOT NULL,
    indexed_at INTEGER NOT NULL,
    node_count INTEGER DEFAULT 0,
    errors TEXT, -- JSON array
    PRIMARY KEY (path, content_hash)
);

-- =============================================================================
-- Branch-Specific Tables
-- =============================================================================

-- Branch-file mapping: which file version each branch uses
CREATE TABLE IF NOT EXISTS branch_files (
    branch TEXT NOT NULL,
    file_path TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    PRIMARY KEY (branch, file_path)
);

-- Branch-specific edges: call/import/extends relationships
CREATE TABLE IF NOT EXISTS branch_edges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    branch TEXT NOT NULL,
    source TEXT NOT NULL,
    target TEXT NOT NULL,
    kind TEXT NOT NULL,
    metadata TEXT, -- JSON object
    line INTEGER,
    col INTEGER,
    provenance TEXT DEFAULT NULL,
    FOREIGN KEY (source) REFERENCES shared_nodes(id) ON DELETE CASCADE,
    FOREIGN KEY (target) REFERENCES shared_nodes(id) ON DELETE CASCADE
);

-- Branch metadata: tracking and statistics
CREATE TABLE IF NOT EXISTS branch_metadata (
    branch TEXT PRIMARY KEY,
    created_at INTEGER NOT NULL,
    last_accessed INTEGER NOT NULL,
    file_count INTEGER DEFAULT 0,
    node_count INTEGER DEFAULT 0,
    edge_count INTEGER DEFAULT 0,
    is_indexed INTEGER DEFAULT 0
);

-- =============================================================================
-- Indexes for Query Performance
-- =============================================================================

-- Shared nodes indexes
CREATE INDEX IF NOT EXISTS idx_shared_nodes_file_hash
ON shared_nodes(file_path, content_hash);

CREATE INDEX IF NOT EXISTS idx_shared_nodes_kind
ON shared_nodes(kind);

CREATE INDEX IF NOT EXISTS idx_shared_nodes_name
ON shared_nodes(name);

CREATE INDEX IF NOT EXISTS idx_shared_nodes_qualified_name
ON shared_nodes(qualified_name);

CREATE INDEX IF NOT EXISTS idx_shared_nodes_language
ON shared_nodes(language);

CREATE INDEX IF NOT EXISTS idx_shared_nodes_file_line
ON shared_nodes(file_path, start_line);

CREATE INDEX IF NOT EXISTS idx_shared_nodes_lower_name
ON shared_nodes(lower(name));

-- Full-text search on shared nodes
CREATE VIRTUAL TABLE IF NOT EXISTS shared_nodes_fts USING fts5(
    id,
    name,
    qualified_name,
    docstring,
    signature,
    content='shared_nodes',
    content_rowid='rowid'
);

-- Triggers to keep FTS index in sync
CREATE TRIGGER IF NOT EXISTS shared_nodes_ai AFTER INSERT ON shared_nodes BEGIN
    INSERT INTO shared_nodes_fts(rowid, id, name, qualified_name, docstring, signature)
    VALUES (NEW.rowid, NEW.id, NEW.name, NEW.qualified_name, NEW.docstring, NEW.signature);
END;

CREATE TRIGGER IF NOT EXISTS shared_nodes_ad AFTER DELETE ON shared_nodes BEGIN
    INSERT INTO shared_nodes_fts(shared_nodes_fts, rowid, id, name, qualified_name, docstring, signature)
    VALUES ('delete', OLD.rowid, OLD.id, OLD.name, OLD.qualified_name, OLD.docstring, OLD.signature);
END;

CREATE TRIGGER IF NOT EXISTS shared_nodes_au AFTER UPDATE ON shared_nodes BEGIN
    INSERT INTO shared_nodes_fts(shared_nodes_fts, rowid, id, name, qualified_name, docstring, signature)
    VALUES ('delete', OLD.rowid, OLD.id, OLD.name, OLD.qualified_name, OLD.docstring, OLD.signature);
    INSERT INTO shared_nodes_fts(rowid, id, name, qualified_name, docstring, signature)
    VALUES (NEW.rowid, NEW.id, NEW.name, NEW.qualified_name, NEW.docstring, NEW.signature);
END;

-- Shared files indexes
CREATE INDEX IF NOT EXISTS idx_shared_files_language
ON shared_files(language);

CREATE INDEX IF NOT EXISTS idx_shared_files_modified_at
ON shared_files(modified_at);

-- Branch files indexes
CREATE INDEX IF NOT EXISTS idx_branch_files_lookup
ON branch_files(branch, file_path, content_hash);

CREATE INDEX IF NOT EXISTS idx_branch_files_hash
ON branch_files(content_hash);

-- Branch edges indexes
CREATE INDEX IF NOT EXISTS idx_branch_edges_branch
ON branch_edges(branch);

CREATE INDEX IF NOT EXISTS idx_branch_edges_source
ON branch_edges(source);

CREATE INDEX IF NOT EXISTS idx_branch_edges_target
ON branch_edges(target);

CREATE INDEX IF NOT EXISTS idx_branch_edges_kind
ON branch_edges(kind);

CREATE INDEX IF NOT EXISTS idx_branch_edges_branch_kind
ON branch_edges(branch, kind);

CREATE INDEX IF NOT EXISTS idx_branch_edges_provenance
ON branch_edges(provenance);

-- Branch metadata indexes
CREATE INDEX IF NOT EXISTS idx_branch_metadata_last_accessed
ON branch_metadata(last_accessed);

CREATE INDEX IF NOT EXISTS idx_branch_metadata_is_indexed
ON branch_metadata(is_indexed);

-- =============================================================================
-- Migration from v1 to v2
-- =============================================================================

-- This migration is handled by the application code
-- It will:
-- 1. Create new tables (this script)
-- 2. Copy data from old tables to new shared tables
-- 3. Create branch_files mapping from old files table
-- 4. Copy edges to branch_edges with branch context
-- 5. Update branch_metadata
-- 6. Drop old tables (optional, for cleanup)
