/**
 * Branch Storage Mode CLI Commands
 *
 * Allows users to choose and configure branch storage strategy.
 */

import { Command } from 'commander';
import * as path from 'path';
import { getCodeGraphDir, isInitialized } from '../directory';
import { StorageMode } from '../branch-storage-strategy';
import {
  loadBranchStorageConfig,
  saveBranchStorageConfig,
  updateBranchStorageConfig,
  resetBranchStorageConfig,
  getStorageModeDescription,
  getStorageModeRecommendation,
  validateBranchStorageConfig,
  getStorageStats,
} from '../branch-storage-config';

// ANSI Color Helpers
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
};

const chalk = {
  bold: (s: string) => `${colors.bold}${s}${colors.reset}`,
  dim: (s: string) => `${colors.dim}${s}${colors.reset}`,
  red: (s: string) => `${colors.red}${s}${colors.reset}`,
  green: (s: string) => `${colors.green}${s}${colors.reset}`,
  yellow: (s: string) => `${colors.yellow}${s}${colors.reset}`,
  blue: (s: string) => `${colors.blue}${s}${colors.reset}`,
  cyan: (s: string) => `${colors.cyan}${s}${colors.reset}`,
  white: (s: string) => `${colors.white}${s}${colors.reset}`,
  gray: (s: string) => `${colors.gray}${s}${colors.reset}`,
};

/**
 * Format bytes to human readable size
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Resolve project path from argument or current directory
 */
function resolveProjectPath(pathArg?: string): string {
  const absolutePath = path.resolve(pathArg || process.cwd());

  if (isInitialized(absolutePath)) {
    return absolutePath;
  }

  let current = absolutePath;
  const root = path.parse(current).root;

  while (current !== root) {
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;

    if (isInitialized(current)) {
      return current;
    }
  }

  return absolutePath;
}

/**
 * Register branch storage mode commands
 */
export function registerBranchStorageModeCommands(program: Command): void {
  /**
   * codegraph branch-mode
   *
   * Show current storage mode and configuration.
   */
  program
    .command('branch-mode')
    .description('Show branch storage mode and configuration')
    .option('-j, --json', 'Output as JSON')
    .action(async (opts: { json?: boolean }) => {
      const projectPath = resolveProjectPath();

      if (!isInitialized(projectPath)) {
        console.error(chalk.red('Error: CodeGraph not initialized. Run "codegraph init" first.'));
        process.exit(1);
      }

      const config = loadBranchStorageConfig(projectPath);
      const stats = getStorageStats(projectPath);

      if (opts.json) {
        console.log(JSON.stringify({
          mode: config.mode,
          maxBranches: config.maxBranches,
          lazyIndex: config.lazyIndex,
          backgroundIndex: config.backgroundIndex,
          configPath: stats.configPath,
          configExists: stats.configExists,
          configSize: stats.configSize,
        }));
        return;
      }

      console.log(chalk.bold('\nBranch Storage Mode\n'));

      console.log(`  ${chalk.cyan('Current mode:')}      ${chalk.green(config.mode)}`);
      console.log(`  ${chalk.cyan('Description:')}       ${getStorageModeDescription(config.mode)}`);

      console.log(chalk.bold('\n  Configuration:\n'));

      console.log(`  ${chalk.cyan('Max branches:')}      ${config.maxBranches ?? 'default'}`);
      console.log(`  ${chalk.cyan('Lazy indexing:')}     ${config.lazyIndex ? 'enabled' : 'disabled'}`);
      console.log(`  ${chalk.cyan('Background index:')}  ${config.backgroundIndex ? 'enabled' : 'disabled'}`);

      console.log(chalk.bold('\n  Storage Info:\n'));

      console.log(`  ${chalk.cyan('Config path:')}       ${stats.configPath}`);
      console.log(`  ${chalk.cyan('Config exists:')}     ${stats.configExists ? 'yes' : 'no'}`);
      console.log(`  ${chalk.cyan('Config size:')}       ${formatBytes(stats.configSize)}`);

      console.log();
    });

  /**
   * codegraph branch-mode set
   *
   * Set the storage mode.
   */
  program
    .command('branch-mode-set <mode>')
    .description('Set branch storage mode (multi-db or shared-db)')
    .option('-f, --force', 'Skip confirmation')
    .option('-j, --json', 'Output as JSON')
    .action(async (mode: string, opts: { force?: boolean; json?: boolean }) => {
      const projectPath = resolveProjectPath();

      if (!isInitialized(projectPath)) {
        console.error(chalk.red('Error: CodeGraph not initialized. Run "codegraph init" first.'));
        process.exit(1);
      }

      // Validate mode
      const validModes = Object.values(StorageMode);
      if (!validModes.includes(mode as StorageMode)) {
        console.error(chalk.red(`Error: Invalid mode "${mode}". Valid modes: ${validModes.join(', ')}`));
        process.exit(1);
      }

      const newMode = mode as StorageMode;
      const currentConfig = loadBranchStorageConfig(projectPath);

      // Check if already in this mode
      if (currentConfig.mode === newMode) {
        console.log(chalk.green(`\nAlready in ${newMode} mode.\n`));
        return;
      }

      // Show warning for mode change
      if (!opts.force) {
        console.log(chalk.yellow(`\n⚠️  Changing storage mode will affect how branch data is stored.`));
        console.log(chalk.dim('  Existing branch indexes may need to be re-indexed.\n'));

        // TODO: Add confirmation prompt
      }

      // Update configuration
      const newConfig = updateBranchStorageConfig(projectPath, { mode: newMode });

      if (opts.json) {
        console.log(JSON.stringify({
          success: true,
          previousMode: currentConfig.mode,
          newMode: newConfig.mode,
        }));
        return;
      }

      console.log(chalk.green(`\n✓ Storage mode changed to ${newMode}\n`));
      console.log(chalk.dim('  New branches will use the new storage mode.'));
      console.log(chalk.dim('  Existing branches may need to be re-indexed.\n'));
    });

  /**
   * codegraph branch-mode recommend
   *
   * Get storage mode recommendation based on project characteristics.
   */
  program
    .command('branch-mode-recommend')
    .description('Get storage mode recommendation')
    .option('-j, --json', 'Output as JSON')
    .action(async (opts: { json?: boolean }) => {
      const projectPath = resolveProjectPath();

      if (!isInitialized(projectPath)) {
        console.error(chalk.red('Error: CodeGraph not initialized. Run "codegraph init" first.'));
        process.exit(1);
      }

      // Analyze project characteristics
      const { listBranchDbs } = await import('../branch');
      const branches = listBranchDbs(projectPath);

      // Determine project size (simplified)
      let projectSize: 'small' | 'medium' | 'large' = 'small';
      try {
        const fs = await import('fs');
        const files = fs.readdirSync(projectPath);
        if (files.length > 1000) {
          projectSize = 'large';
        } else if (files.length > 100) {
          projectSize = 'medium';
        }
      } catch {
        // Ignore errors
      }

      const recommendation = getStorageModeRecommendation(projectSize, branches.length);

      if (opts.json) {
        console.log(JSON.stringify({
          projectSize,
          branchCount: branches.length,
          recommendedMode: recommendation.mode,
          reason: recommendation.reason,
        }));
        return;
      }

      console.log(chalk.bold('\nStorage Mode Recommendation\n'));

      console.log(`  ${chalk.cyan('Project size:')}      ${projectSize}`);
      console.log(`  ${chalk.cyan('Branch count:')}      ${branches.length}`);

      console.log(chalk.bold('\n  Recommendation:\n'));

      console.log(`  ${chalk.cyan('Mode:')}              ${chalk.green(recommendation.mode)}`);
      console.log(`  ${chalk.cyan('Reason:')}            ${recommendation.reason}`);

      console.log(chalk.bold('\n  Mode Comparison:\n'));

      console.log(`  ${chalk.cyan('Multi-DB:')}`);
      console.log(`    • Each branch has its own database`);
      console.log(`    • Full isolation between branches`);
      console.log(`    • Higher disk usage`);
      console.log(`    • Slower branch switching`);

      console.log(`\n  ${chalk.cyan('Shared-DB:')}`);
      console.log(`    • Single database with shared storage`);
      console.log(`    • Content-addressable deduplication`);
      console.log(`    • Lower disk usage (up to 78% savings)`);
      console.log(`    • Faster branch switching (up to 7.6x)`);

      console.log();
    });

  /**
   * codegraph branch-mode reset
   *
   * Reset storage configuration to defaults.
   */
  program
    .command('branch-mode-reset')
    .description('Reset branch storage configuration to defaults')
    .option('-f, --force', 'Skip confirmation')
    .option('-j, --json', 'Output as JSON')
    .action(async (opts: { force?: boolean; json?: boolean }) => {
      const projectPath = resolveProjectPath();

      if (!isInitialized(projectPath)) {
        console.error(chalk.red('Error: CodeGraph not initialized. Run "codegraph init" first.'));
        process.exit(1);
      }

      const currentConfig = loadBranchStorageConfig(projectPath);

      // Show warning
      if (!opts.force) {
        console.log(chalk.yellow('\n⚠️  This will reset storage configuration to defaults.'));
        console.log(chalk.dim('  Current settings will be lost.\n'));

        // TODO: Add confirmation prompt
      }

      // Reset configuration
      const newConfig = resetBranchStorageConfig(projectPath);

      if (opts.json) {
        console.log(JSON.stringify({
          success: true,
          previousMode: currentConfig.mode,
          newMode: newConfig.mode,
          maxBranches: newConfig.maxBranches,
          lazyIndex: newConfig.lazyIndex,
          backgroundIndex: newConfig.backgroundIndex,
        }));
        return;
      }

      console.log(chalk.green('\n✓ Configuration reset to defaults\n'));

      console.log(`  ${chalk.cyan('Mode:')}              ${newConfig.mode}`);
      console.log(`  ${chalk.cyan('Max branches:')}      ${newConfig.maxBranches}`);
      console.log(`  ${chalk.cyan('Lazy indexing:')}     ${newConfig.lazyIndex ? 'enabled' : 'disabled'}`);
      console.log(`  ${chalk.cyan('Background index:')}  ${newConfig.backgroundIndex ? 'enabled' : 'disabled'}`);

      console.log();
    });

  /**
   * codegraph branch-mode validate
   *
   * Validate storage configuration.
   */
  program
    .command('branch-mode-validate')
    .description('Validate branch storage configuration')
    .option('-j, --json', 'Output as JSON')
    .action(async (opts: { json?: boolean }) => {
      const projectPath = resolveProjectPath();

      if (!isInitialized(projectPath)) {
        console.error(chalk.red('Error: CodeGraph not initialized. Run "codegraph init" first.'));
        process.exit(1);
      }

      const config = loadBranchStorageConfig(projectPath);
      const validation = validateBranchStorageConfig(config);

      if (opts.json) {
        console.log(JSON.stringify({
          valid: validation.valid,
          errors: validation.errors,
          config,
        }));
        return;
      }

      console.log(chalk.bold('\nConfiguration Validation\n'));

      if (validation.valid) {
        console.log(chalk.green('  ✓ Configuration is valid\n'));
      } else {
        console.log(chalk.red('  ✗ Configuration has errors:\n'));

        for (const error of validation.errors) {
          console.log(chalk.red(`    • ${error}`));
        }
      }

      console.log(chalk.bold('  Current Configuration:\n'));

      console.log(`  ${chalk.cyan('Mode:')}              ${config.mode}`);
      console.log(`  ${chalk.cyan('Max branches:')}      ${config.maxBranches}`);
      console.log(`  ${chalk.cyan('Lazy indexing:')}     ${config.lazyIndex ? 'enabled' : 'disabled'}`);
      console.log(`  ${chalk.cyan('Background index:')}  ${config.backgroundIndex ? 'enabled' : 'disabled'}`);

      console.log();
    });
}
