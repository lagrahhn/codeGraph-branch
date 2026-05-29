/**
 * Branch Management
 *
 * Manages per-branch database files for CodeGraph.
 * Each git branch gets its own SQLite database under .codegraph/branches/<sanitized-name>/,
 * allowing instant branch switching without re-indexing.
 */

import * as fs from 'fs';
import * as path from 'path';
import { execFileSync } from 'child_process';
import { getCodeGraphDir } from './directory';
import { DATABASE_FILENAME } from './db';

/**
 * Default maximum number of branch databases to retain.
 * Oldest-used branches are evicted when this limit is exceeded.
 */
export const DEFAULT_MAX_BRANCHES = 10;

/**
 * Subdirectory name for branch databases
 */
export const BRANCHES_DIR = 'branches';

/**
 * Filename that records which branch is currently active
 */
export const ACTIVE_BRANCH_FILE = 'active_branch';

/**
 * Sanitize a branch name for use as a filesystem directory name.
 *
 * Rules:
 * - Replace `/` with `__` (feature/foo -> feature__foo)
 * - Replace other unsafe characters with `_`
 * - Collapse consecutive underscores
 * - Trim leading/trailing underscores
 * - Fallback to 'detached' for empty results
 */
export function sanitizeBranchName(branch: string): string {
  return branch
    .replace(/\//g, '__')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    || 'detached';
}

/**
 * Get the current git branch name for a project.
 *
 * Returns null if:
 * - The project is not a git repository
 * - HEAD is detached (not on any branch)
 * - git is not available
 */
export function getCurrentBranch(projectRoot: string): string | null {
  try {
    const result = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
      cwd: projectRoot,
      encoding: 'utf-8',
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();

    // HEAD means detached HEAD state
    if (result === 'HEAD') {
      return null;
    }

    return result;
  } catch {
    return null;
  }
}

/**
 * Get the directory path for a specific branch's database
 */
export function getBranchDir(projectRoot: string, branch: string): string {
  const sanitized = sanitizeBranchName(branch);
  return path.join(getCodeGraphDir(projectRoot), BRANCHES_DIR, sanitized);
}

/**
 * Get the database path for a specific branch
 */
export function getBranchDbPath(projectRoot: string, branch: string): string {
  return path.join(getBranchDir(projectRoot, branch), DATABASE_FILENAME);
}

/**
 * Check if a branch database exists
 */
export function branchDbExists(projectRoot: string, branch: string): boolean {
  return fs.existsSync(getBranchDbPath(projectRoot, branch));
}

/**
 * Record which branch is currently active
 */
export function setActiveBranch(projectRoot: string, branch: string): void {
  const filePath = path.join(getCodeGraphDir(projectRoot), ACTIVE_BRANCH_FILE);
  fs.writeFileSync(filePath, branch, 'utf-8');
}

/**
 * Get the previously recorded active branch
 */
export function getActiveBranch(projectRoot: string): string | null {
  const filePath = path.join(getCodeGraphDir(projectRoot), ACTIVE_BRANCH_FILE);
  try {
    return fs.readFileSync(filePath, 'utf-8').trim() || null;
  } catch {
    return null;
  }
}

/**
 * Information about a cached branch database
 */
export interface BranchInfo {
  /** The sanitized directory name */
  dirName: string;
  /** Full path to the database file */
  dbPath: string;
  /** Database file size in bytes */
  sizeBytes: number;
  /** Last modification time of the database */
  lastModified: number;
  /** Whether this is the currently active branch */
  isActive: boolean;
}

/**
 * List all cached branch databases, sorted by last-modified time (newest first)
 */
export function listBranchDbs(projectRoot: string): BranchInfo[] {
  const branchesDir = path.join(getCodeGraphDir(projectRoot), BRANCHES_DIR);

  if (!fs.existsSync(branchesDir)) {
    return [];
  }

  const activeBranch = getActiveBranch(projectRoot);
  const entries = fs.readdirSync(branchesDir, { withFileTypes: true });
  const branches: BranchInfo[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const dbPath = path.join(branchesDir, entry.name, DATABASE_FILENAME);
    if (!fs.existsSync(dbPath)) continue;

    try {
      const stats = fs.statSync(dbPath);
      branches.push({
        dirName: entry.name,
        dbPath,
        sizeBytes: stats.size,
        lastModified: stats.mtimeMs,
        isActive: activeBranch !== null && sanitizeBranchName(activeBranch) === entry.name,
      });
    } catch {
      // Skip unstatable entries
    }
  }

  // Sort by last-modified, newest first
  branches.sort((a, b) => b.lastModified - a.lastModified);

  return branches;
}

/**
 * Get total size of all branch databases in bytes
 */
export function getTotalBranchDbSize(projectRoot: string): number {
  const branches = listBranchDbs(projectRoot);
  return branches.reduce((sum, b) => sum + b.sizeBytes, 0);
}

/**
 * Evict oldest branch databases to stay within the max count.
 * Never evicts the currently active branch.
 *
 * @returns Array of evicted branch dir names
 */
export function evictOldBranches(
  projectRoot: string,
  maxBranches: number = DEFAULT_MAX_BRANCHES
): string[] {
  const branches = listBranchDbs(projectRoot);
  const evicted: string[] = [];

  // Already under limit
  if (branches.length <= maxBranches) {
    return evicted;
  }

  // Evict from the end (oldest) of the sorted list, skipping active branch
  const toEvict = branches
    .filter(b => !b.isActive)
    .slice(maxBranches - 1);  // -1 because active branch doesn't count toward limit

  for (const branch of toEvict) {
    try {
      const branchDir = path.dirname(branch.dbPath);
      fs.rmSync(branchDir, { recursive: true, force: true });
      evicted.push(branch.dirName);
    } catch {
      // Best effort — don't fail if eviction fails
    }
  }

  return evicted;
}

/**
 * Migrate an existing root-level codegraph.db into the branches structure.
 *
 * Moves .codegraph/codegraph.db -> .codegraph/branches/<branch>/codegraph.db
 * This handles the upgrade path from single-DB to multi-branch.
 *
 * @returns true if migration was performed, false if not needed
 */
export function migrateRootDbToBranch(projectRoot: string, branch: string): boolean {
  const rootDbPath = path.join(getCodeGraphDir(projectRoot), DATABASE_FILENAME);
  const branchDbPath = getBranchDbPath(projectRoot, branch);
  const branchDir = path.dirname(branchDbPath);

  // No root DB to migrate
  if (!fs.existsSync(rootDbPath)) {
    return false;
  }

  // Branch DB already exists — nothing to do
  if (fs.existsSync(branchDbPath)) {
    return false;
  }

  // Create branch directory and move the DB
  fs.mkdirSync(branchDir, { recursive: true });
  fs.renameSync(rootDbPath, branchDbPath);

  // Also move WAL and SHM files if they exist
  for (const suffix of ['-wal', '-shm']) {
    const src = rootDbPath + suffix;
    const dst = branchDbPath + suffix;
    if (fs.existsSync(src)) {
      fs.renameSync(src, dst);
    }
  }

  return true;
}

/**
 * Ensure the branches directory structure exists
 */
export function ensureBranchesDir(projectRoot: string): void {
  const branchesDir = path.join(getCodeGraphDir(projectRoot), BRANCHES_DIR);
  fs.mkdirSync(branchesDir, { recursive: true });
}

/**
 * Remove a specific branch database
 */
export function removeBranchDb(projectRoot: string, branch: string): boolean {
  const branchDir = getBranchDir(projectRoot, branch);

  if (!fs.existsSync(branchDir)) {
    return false;
  }

  fs.rmSync(branchDir, { recursive: true, force: true });
  return true;
}

/**
 * Get a summary of branch management state for status display
 */
export function getBranchSummary(projectRoot: string): {
  currentBranch: string | null;
  activeBranch: string | null;
  cachedBranches: BranchInfo[];
  totalSizeBytes: number;
  maxBranches: number;
} {
  return {
    currentBranch: getCurrentBranch(projectRoot),
    activeBranch: getActiveBranch(projectRoot),
    cachedBranches: listBranchDbs(projectRoot),
    totalSizeBytes: getTotalBranchDbSize(projectRoot),
    maxBranches: DEFAULT_MAX_BRANCHES,
  };
}
