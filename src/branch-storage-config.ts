/**
 * Branch Storage Configuration Manager
 *
 * Manages the configuration for branch storage strategy.
 * Allows users to choose between multi-db and shared-db modes.
 */

import * as fs from 'fs';
import * as path from 'path';
import { getCodeGraphDir } from './directory';
import { StorageMode, BranchStorageConfig } from './branch-storage-strategy';

/**
 * Configuration file name
 */
const CONFIG_FILE = 'branch-storage.json';

/**
 * Default configuration
 */
const DEFAULT_CONFIG: BranchStorageConfig = {
  mode: StorageMode.MULTI_DB,
  maxBranches: 10,
  lazyIndex: true,
  backgroundIndex: false,
};

/**
 * Get the configuration file path
 */
function getConfigPath(projectRoot: string): string {
  return path.join(getCodeGraphDir(projectRoot), CONFIG_FILE);
}

/**
 * Load configuration from file
 */
export function loadBranchStorageConfig(projectRoot: string): BranchStorageConfig {
  const configPath = getConfigPath(projectRoot);

  try {
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, 'utf-8');
      const config = JSON.parse(content);

      // Validate and merge with defaults
      return {
        ...DEFAULT_CONFIG,
        ...config,
        // Ensure mode is valid
        mode: Object.values(StorageMode).includes(config.mode)
          ? config.mode
          : DEFAULT_CONFIG.mode,
      };
    }
  } catch (err) {
    // Ignore errors, use defaults
  }

  return { ...DEFAULT_CONFIG };
}

/**
 * Save configuration to file
 */
export function saveBranchStorageConfig(
  projectRoot: string,
  config: BranchStorageConfig
): void {
  const configPath = getConfigPath(projectRoot);

  // Ensure directory exists
  const dir = path.dirname(configPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Save configuration
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
}

/**
 * Update configuration
 */
export function updateBranchStorageConfig(
  projectRoot: string,
  updates: Partial<BranchStorageConfig>
): BranchStorageConfig {
  const current = loadBranchStorageConfig(projectRoot);
  const updated = { ...current, ...updates };

  saveBranchStorageConfig(projectRoot, updated);

  return updated;
}

/**
 * Reset configuration to defaults
 */
export function resetBranchStorageConfig(projectRoot: string): BranchStorageConfig {
  saveBranchStorageConfig(projectRoot, DEFAULT_CONFIG);
  return { ...DEFAULT_CONFIG };
}

/**
 * Get storage mode description
 */
export function getStorageModeDescription(mode: StorageMode): string {
  switch (mode) {
    case StorageMode.MULTI_DB:
      return 'Multi-Database: Each branch has its own database file. Traditional approach with full isolation.';
    case StorageMode.SHARED_DB:
      return 'Shared Database: Single database with content-addressable storage. Optimized for disk space and speed.';
    default:
      return 'Unknown storage mode';
  }
}

/**
 * Get storage mode recommendations
 */
export function getStorageModeRecommendation(
  projectSize: 'small' | 'medium' | 'large',
  branchCount: number
): { mode: StorageMode; reason: string } {
  // For small projects with few branches, multi-db is fine
  if (projectSize === 'small' && branchCount <= 5) {
    return {
      mode: StorageMode.MULTI_DB,
      reason: 'Small project with few branches. Multi-db provides full isolation with minimal overhead.',
    };
  }

  // For medium projects or many branches, shared-db is better
  if (projectSize === 'medium' || branchCount > 5) {
    return {
      mode: StorageMode.SHARED_DB,
      reason: 'Medium project or many branches. Shared-db saves disk space and speeds up branch switching.',
    };
  }

  // For large projects, shared-db is strongly recommended
  return {
    mode: StorageMode.SHARED_DB,
    reason: 'Large project. Shared-db significantly reduces disk usage and improves performance.',
  };
}

/**
 * Validate configuration
 */
export function validateBranchStorageConfig(config: BranchStorageConfig): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Validate mode
  if (!Object.values(StorageMode).includes(config.mode)) {
    errors.push(`Invalid storage mode: ${config.mode}`);
  }

  // Validate maxBranches
  if (config.maxBranches !== undefined) {
    if (config.maxBranches < 1 || config.maxBranches > 100) {
      errors.push('maxBranches must be between 1 and 100');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get storage statistics
 */
export function getStorageStats(projectRoot: string): {
  mode: StorageMode;
  configPath: string;
  configExists: boolean;
  configSize: number;
} {
  const configPath = getConfigPath(projectRoot);
  const config = loadBranchStorageConfig(projectRoot);

  let configSize = 0;
  try {
    if (fs.existsSync(configPath)) {
      const stats = fs.statSync(configPath);
      configSize = stats.size;
    }
  } catch {
    // Ignore errors
  }

  return {
    mode: config.mode,
    configPath,
    configExists: fs.existsSync(configPath),
    configSize,
  };
}
