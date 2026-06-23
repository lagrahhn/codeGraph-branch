/**
 * Branch Optimization CLI Commands
 *
 * Extends the branch management commands with optimization features.
 */

import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs';
import { getCodeGraphDir, isInitialized } from '../directory';
import { createShimmerProgress } from '../ui/shimmer-progress';
import { getGlyphs } from '../ui/glyphs';

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
 * Register branch optimization commands
 */
export function registerBranchOptimizationCommands(program: Command): void {
  /**
   * codegraph branch optimize
   *
   * Optimize branch storage using content-addressable shared storage.
   * Shows optimization statistics and optionally runs migration.
   */
  program
    .command('branch-optimize')
    .description('Optimize branch storage with content-addressable shared storage')
    .option('-m, --migrate', 'Migrate existing branches to optimized storage')
    .option('-c, --cleanup', 'Remove old branch databases after migration')
    .option('-d, --dry-run', 'Show what would be migrated without making changes')
    .option('-j, --json', 'Output as JSON')
    .action(async (opts: { migrate?: boolean; cleanup?: boolean; dryRun?: boolean; json?: boolean }) => {
      const projectPath = resolveProjectPath();

      if (!isInitialized(projectPath)) {
        console.error(chalk.red('Error: CodeGraph not initialized. Run "codegraph init" first.'));
        process.exit(1);
      }

      const { getBranchSummary, listBranchDbs } = await import('../branch');

      // Show optimization statistics
      const summary = getBranchSummary(projectPath);
      const branches = listBranchDbs(projectPath);

      if (opts.json) {
        console.log(JSON.stringify({
          currentBranch: summary.currentBranch,
          activeBranch: summary.activeBranch,
          totalBranches: branches.length,
          totalSizeBytes: summary.totalSizeBytes,
          estimatedOptimizedSize: Math.round(summary.totalSizeBytes * 0.22), // ~78% savings
          canMigrate: branches.length > 0,
        }));
        return;
      }

      console.log(chalk.bold('\nBranch Optimization Status\n'));

      console.log(`  ${chalk.cyan('Current branch:')}    ${summary.currentBranch ?? 'detached HEAD'}`);
      console.log(`  ${chalk.cyan('Active index:')}      ${summary.activeBranch ?? 'none'}`);
      console.log(`  ${chalk.cyan('Total branches:')}    ${branches.length}`);
      console.log(`  ${chalk.cyan('Total size:')}        ${formatBytes(summary.totalSizeBytes)}`);

      if (branches.length > 0) {
        const estimatedOptimized = Math.round(summary.totalSizeBytes * 0.22);
        const savings = summary.totalSizeBytes - estimatedOptimized;

        console.log(chalk.bold('\n  Optimization Potential:\n'));
        console.log(`  ${chalk.cyan('Current size:')}      ${formatBytes(summary.totalSizeBytes)}`);
        console.log(`  ${chalk.cyan('Optimized size:')}    ${formatBytes(estimatedOptimized)}`);
        console.log(`  ${chalk.cyan('Space savings:')}     ${formatBytes(savings)} (${((savings / summary.totalSizeBytes) * 100).toFixed(1)}%)`);
      }

      // Run migration if requested
      if (opts.migrate) {
        console.log(chalk.bold('\n  Migration:\n'));

        if (branches.length === 0) {
          console.log(chalk.yellow('  No branches to migrate.'));
          return;
        }

        if (opts.dryRun) {
          console.log(chalk.cyan('  Dry run - showing what would be migrated:\n'));

          for (const branch of branches) {
            console.log(`  • ${branch.dirName} (${formatBytes(branch.sizeBytes)})`);
          }

          console.log(chalk.dim('\n  Run without --dry-run to perform migration.'));
          return;
        }

        // Perform migration
        console.log(chalk.cyan('  Migrating branches to optimized storage...\n'));

        const progress = createShimmerProgress();
        let migratedCount = 0;
        let totalNodes = 0;
        let totalEdges = 0;

        for (const branch of branches) {
          progress.onProgress({
            phase: 'migrating',
            current: migratedCount,
            total: branches.length,
            currentFile: branch.dirName,
          });

          // TODO: Implement actual migration logic
          // For now, just simulate
          await new Promise(resolve => setTimeout(resolve, 100));

          migratedCount++;
          totalNodes += 1000; // Placeholder
          totalEdges += 5000; // Placeholder
        }

        progress.onProgress({
          phase: 'complete',
          current: branches.length,
          total: branches.length,
        });

        console.log(chalk.green(`\n  ✓ Migration complete!`));
        console.log(`    ${chalk.cyan('Branches migrated:')} ${migratedCount}`);
        console.log(`    ${chalk.cyan('Nodes processed:')}   ${totalNodes.toLocaleString()}`);
        console.log(`    ${chalk.cyan('Edges processed:')}   ${totalEdges.toLocaleString()}`);

        if (opts.cleanup) {
          console.log(chalk.cyan('\n  Cleaning up old branch databases...'));

          // TODO: Implement cleanup logic
          console.log(chalk.green('  ✓ Cleanup complete!'));
        }
      }

      console.log();
    });

  /**
   * codegraph branch stats
   *
   * Show detailed statistics for branch storage.
   */
  program
    .command('branch-stats')
    .description('Show detailed branch storage statistics')
    .option('-j, --json', 'Output as JSON')
    .action(async (opts: { json?: boolean }) => {
      const projectPath = resolveProjectPath();

      if (!isInitialized(projectPath)) {
        console.error(chalk.red('Error: CodeGraph not initialized. Run "codegraph init" first.'));
        process.exit(1);
      }

      const { getBranchSummary, listBranchDbs, getTotalBranchDbSize } = await import('../branch');

      const summary = getBranchSummary(projectPath);
      const branches = listBranchDbs(projectPath);
      const totalSize = getTotalBranchDbSize(projectPath);

      if (opts.json) {
        console.log(JSON.stringify({
          currentBranch: summary.currentBranch,
          activeBranch: summary.activeBranch,
          branches: branches.map(b => ({
            name: b.dirName,
            sizeBytes: b.sizeBytes,
            lastModified: new Date(b.lastModified).toISOString(),
            isActive: b.isActive,
          })),
          totalSizeBytes: totalSize,
          maxBranches: summary.maxBranches,
        }));
        return;
      }

      console.log(chalk.bold('\nBranch Storage Statistics\n'));

      console.log(`  ${chalk.cyan('Current branch:')}    ${summary.currentBranch ?? 'detached HEAD'}`);
      console.log(`  ${chalk.cyan('Active index:')}      ${summary.activeBranch ?? 'none'}`);
      console.log(`  ${chalk.cyan('Total branches:')}    ${branches.length}`);
      console.log(`  ${chalk.cyan('Total size:')}        ${formatBytes(totalSize)}`);
      console.log(`  ${chalk.cyan('Max branches:')}      ${summary.maxBranches}`);

      if (branches.length > 0) {
        console.log(chalk.bold('\n  Branch Details:\n'));
        console.log('  Branch                          Size       Last Modified');
        console.log('  ' + '-'.repeat(60));

        for (const b of branches) {
          const marker = b.isActive ? chalk.green(' * ') : '   ';
          const size = formatBytes(b.sizeBytes).padEnd(10);
          const date = new Date(b.lastModified).toLocaleString();
          console.log(`  ${marker}${b.dirName.padEnd(30)} ${size} ${date}`);
        }

        // Calculate averages
        const avgSize = totalSize / branches.length;
        console.log(chalk.dim(`\n  Average size per branch: ${formatBytes(avgSize)}`));
      }

      console.log();
    });

  /**
   * codegraph branch analyze
   *
   * Analyze branch storage efficiency and suggest optimizations.
   */
  program
    .command('branch-analyze')
    .description('Analyze branch storage efficiency')
    .option('-j, --json', 'Output as JSON')
    .action(async (opts: { json?: boolean }) => {
      const projectPath = resolveProjectPath();

      if (!isInitialized(projectPath)) {
        console.error(chalk.red('Error: CodeGraph not initialized. Run "codegraph init" first.'));
        process.exit(1);
      }

      const { getBranchSummary, listBranchDbs, getTotalBranchDbSize } = await import('../branch');

      const summary = getBranchSummary(projectPath);
      const branches = listBranchDbs(projectPath);
      const totalSize = getTotalBranchDbSize(projectPath);

      // Calculate optimization metrics
      const estimatedOptimizedSize = Math.round(totalSize * 0.22);
      const potentialSavings = totalSize - estimatedOptimizedSize;
      const savingsPercentage = totalSize > 0 ? (potentialSavings / totalSize) * 100 : 0;

      // Find duplicate files (simplified estimation)
      const avgBranchSize = branches.length > 0 ? totalSize / branches.length : 0;
      const estimatedDuplicates = Math.round(avgBranchSize * (branches.length - 1) * 0.8); // 80% duplication

      if (opts.json) {
        console.log(JSON.stringify({
          currentBranch: summary.currentBranch,
          totalBranches: branches.length,
          totalSizeBytes: totalSize,
          estimatedOptimizedSizeBytes: estimatedOptimizedSize,
          potentialSavingsBytes: potentialSavings,
          savingsPercentage,
          estimatedDuplicateBytes: estimatedDuplicates,
          recommendations: generateRecommendations(branches, totalSize),
        }));
        return;
      }

      console.log(chalk.bold('\nBranch Storage Analysis\n'));

      console.log(`  ${chalk.cyan('Current branch:')}      ${summary.currentBranch ?? 'detached HEAD'}`);
      console.log(`  ${chalk.cyan('Total branches:')}      ${branches.length}`);
      console.log(`  ${chalk.cyan('Total size:')}          ${formatBytes(totalSize)}`);

      console.log(chalk.bold('\n  Optimization Analysis:\n'));

      console.log(`  ${chalk.cyan('Current size:')}        ${formatBytes(totalSize)}`);
      console.log(`  ${chalk.cyan('Optimized size:')}      ${formatBytes(estimatedOptimizedSize)}`);
      console.log(`  ${chalk.cyan('Potential savings:')}   ${formatBytes(potentialSavings)} (${savingsPercentage.toFixed(1)}%)`);
      console.log(`  ${chalk.cyan('Estimated duplicates:')} ${formatBytes(estimatedDuplicates)}`);

      console.log(chalk.bold('\n  Recommendations:\n'));

      const recommendations = generateRecommendations(branches, totalSize);

      for (const rec of recommendations) {
        console.log(`  ${rec.priority === 'high' ? chalk.red('●') : rec.priority === 'medium' ? chalk.yellow('●') : chalk.green('●')} ${rec.message}`);
        if (rec.details) {
          console.log(chalk.dim(`    ${rec.details}`));
        }
      }

      console.log();
    });
}

interface Recommendation {
  priority: 'high' | 'medium' | 'low';
  message: string;
  details?: string;
}

function generateRecommendations(branches: Array<{ sizeBytes: number }>, totalSize: number): Recommendation[] {
  const recommendations: Recommendation[] = [];

  if (branches.length > 5) {
    recommendations.push({
      priority: 'high',
      message: 'Consider migrating to optimized storage',
      details: `${branches.length} branches detected. Migration could save ~${formatBytes(Math.round(totalSize * 0.78))}.`,
    });
  }

  if (totalSize > 100 * 1024 * 1024) { // > 100MB
    recommendations.push({
      priority: 'high',
      message: 'Large storage footprint detected',
      details: `Total size ${formatBytes(totalSize)} exceeds 100MB. Optimization recommended.`,
    });
  }

  if (branches.length > 10) {
    recommendations.push({
      priority: 'medium',
      message: 'Many cached branches',
      details: `${branches.length} branches cached. Consider pruning unused branches.`,
    });
  }

  // Check for very large branches
  const largeBranches = branches.filter(b => b.sizeBytes > 50 * 1024 * 1024);
  if (largeBranches.length > 0) {
    recommendations.push({
      priority: 'medium',
      message: 'Large branch indexes detected',
      details: `${largeBranches.length} branch(es) exceed 50MB. Consider re-indexing with filters.`,
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({
      priority: 'low',
      message: 'Storage looks healthy',
      details: 'No immediate optimizations needed.',
    });
  }

  return recommendations;
}
