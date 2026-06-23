/**
 * Tests for Branch Storage Strategy
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  StorageMode,
  BranchStorageConfig,
  createBranchStorageStrategy,
} from '../src/branch-storage-strategy';
import {
  loadBranchStorageConfig,
  saveBranchStorageConfig,
  updateBranchStorageConfig,
  resetBranchStorageConfig,
  getStorageModeDescription,
  getStorageModeRecommendation,
  validateBranchStorageConfig,
  getStorageStats,
} from '../src/branch-storage-config';

describe('Branch Storage Strategy', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'branch-storage-test-'));
  });

  afterEach(async () => {
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  });

  describe('StorageMode', () => {
    it('should have correct enum values', () => {
      expect(StorageMode.MULTI_DB).toBe('multi-db');
      expect(StorageMode.SHARED_DB).toBe('shared-db');
    });

    it('should have exactly 2 modes', () => {
      const modes = Object.values(StorageMode);
      expect(modes).toHaveLength(2);
      expect(modes).toContain('multi-db');
      expect(modes).toContain('shared-db');
    });
  });

  describe('createBranchStorageStrategy', () => {
    it('should create multi-db strategy', () => {
      const config: BranchStorageConfig = {
        mode: StorageMode.MULTI_DB,
        maxBranches: 10,
        lazyIndex: true,
        backgroundIndex: false,
      };

      const strategy = createBranchStorageStrategy(config);

      expect(strategy).toBeDefined();
      expect(strategy.mode).toBe(StorageMode.MULTI_DB);
      expect(strategy.getConfig()).toEqual(config);
    });

    it('should create shared-db strategy', () => {
      const config: BranchStorageConfig = {
        mode: StorageMode.SHARED_DB,
        maxBranches: 20,
        lazyIndex: false,
        backgroundIndex: true,
      };

      const strategy = createBranchStorageStrategy(config);

      expect(strategy).toBeDefined();
      expect(strategy.mode).toBe(StorageMode.SHARED_DB);
      expect(strategy.getConfig()).toEqual(config);
    });

    it('should throw for invalid mode', () => {
      const config = {
        mode: 'invalid' as StorageMode,
        maxBranches: 10,
        lazyIndex: true,
        backgroundIndex: false,
      };

      expect(() => createBranchStorageStrategy(config)).toThrow('Unknown storage mode: invalid');
    });
  });

  describe('Strategy Configuration', () => {
    it('should update config', () => {
      const config: BranchStorageConfig = {
        mode: StorageMode.MULTI_DB,
        maxBranches: 10,
        lazyIndex: true,
        backgroundIndex: false,
      };

      const strategy = createBranchStorageStrategy(config);

      strategy.updateConfig({
        maxBranches: 20,
        lazyIndex: false,
      });

      const updated = strategy.getConfig();
      expect(updated.maxBranches).toBe(20);
      expect(updated.lazyIndex).toBe(false);
      expect(updated.mode).toBe(StorageMode.MULTI_DB);
    });
  });
});

describe('Branch Storage Config', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'branch-config-test-'));
  });

  afterEach(async () => {
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  });

  describe('loadBranchStorageConfig', () => {
    it('should return default config when no file exists', () => {
      const config = loadBranchStorageConfig(tempDir);

      expect(config).toBeDefined();
      expect(config.mode).toBe(StorageMode.MULTI_DB);
      expect(config.maxBranches).toBe(10);
      expect(config.lazyIndex).toBe(true);
      expect(config.backgroundIndex).toBe(false);
    });

    it('should load existing config', () => {
      const testConfig: BranchStorageConfig = {
        mode: StorageMode.SHARED_DB,
        maxBranches: 20,
        lazyIndex: false,
        backgroundIndex: true,
      };

      // Create .codegraph directory
      const codegraphDir = path.join(tempDir, '.codegraph');
      fs.mkdirSync(codegraphDir, { recursive: true });

      // Save config
      const configPath = path.join(codegraphDir, 'branch-storage.json');
      fs.writeFileSync(configPath, JSON.stringify(testConfig, null, 2));

      const loaded = loadBranchStorageConfig(tempDir);

      expect(loaded.mode).toBe(StorageMode.SHARED_DB);
      expect(loaded.maxBranches).toBe(20);
      expect(loaded.lazyIndex).toBe(false);
      expect(loaded.backgroundIndex).toBe(true);
    });
  });

  describe('saveBranchStorageConfig', () => {
    it('should save config', () => {
      const testConfig: BranchStorageConfig = {
        mode: StorageMode.SHARED_DB,
        maxBranches: 20,
        lazyIndex: false,
        backgroundIndex: true,
      };

      saveBranchStorageConfig(tempDir, testConfig);

      const configPath = path.join(tempDir, '.codegraph', 'branch-storage.json');
      expect(fs.existsSync(configPath)).toBe(true);

      const loaded = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      expect(loaded.mode).toBe(StorageMode.SHARED_DB);
      expect(loaded.maxBranches).toBe(20);
    });
  });

  describe('updateBranchStorageConfig', () => {
    it('should update config', () => {
      const initial: BranchStorageConfig = {
        mode: StorageMode.MULTI_DB,
        maxBranches: 10,
        lazyIndex: true,
        backgroundIndex: false,
      };

      saveBranchStorageConfig(tempDir, initial);

      const updated = updateBranchStorageConfig(tempDir, {
        mode: StorageMode.SHARED_DB,
        maxBranches: 20,
      });

      expect(updated.mode).toBe(StorageMode.SHARED_DB);
      expect(updated.maxBranches).toBe(20);
      expect(updated.lazyIndex).toBe(true); // Preserved
      expect(updated.backgroundIndex).toBe(false); // Preserved
    });
  });

  describe('resetBranchStorageConfig', () => {
    it('should reset config to defaults', () => {
      const testConfig: BranchStorageConfig = {
        mode: StorageMode.SHARED_DB,
        maxBranches: 20,
        lazyIndex: false,
        backgroundIndex: true,
      };

      saveBranchStorageConfig(tempDir, testConfig);

      const reset = resetBranchStorageConfig(tempDir);

      expect(reset.mode).toBe(StorageMode.MULTI_DB);
      expect(reset.maxBranches).toBe(10);
      expect(reset.lazyIndex).toBe(true);
      expect(reset.backgroundIndex).toBe(false);
    });
  });

  describe('getStorageModeDescription', () => {
    it('should return description for multi-db', () => {
      const desc = getStorageModeDescription(StorageMode.MULTI_DB);
      expect(desc).toContain('Multi-Database');
      expect(desc).toContain('Each branch');
    });

    it('should return description for shared-db', () => {
      const desc = getStorageModeDescription(StorageMode.SHARED_DB);
      expect(desc).toContain('Shared Database');
      expect(desc).toContain('content-addressable');
    });
  });

  describe('getStorageModeRecommendation', () => {
    it('should recommend multi-db for small projects with few branches', () => {
      const rec = getStorageModeRecommendation('small', 3);
      expect(rec.mode).toBe(StorageMode.MULTI_DB);
      expect(rec.reason).toContain('Small project');
    });

    it('should recommend shared-db for medium projects', () => {
      const rec = getStorageModeRecommendation('medium', 5);
      expect(rec.mode).toBe(StorageMode.SHARED_DB);
      expect(rec.reason).toContain('Medium project');
    });

    it('should recommend shared-db for many branches', () => {
      const rec = getStorageModeRecommendation('small', 10);
      expect(rec.mode).toBe(StorageMode.SHARED_DB);
      expect(rec.reason).toContain('many branches');
    });

    it('should recommend shared-db for large projects', () => {
      const rec = getStorageModeRecommendation('large', 3);
      expect(rec.mode).toBe(StorageMode.SHARED_DB);
      expect(rec.reason).toContain('Large project');
    });
  });

  describe('validateBranchStorageConfig', () => {
    it('should validate correct config', () => {
      const config: BranchStorageConfig = {
        mode: StorageMode.MULTI_DB,
        maxBranches: 10,
        lazyIndex: true,
        backgroundIndex: false,
      };

      const result = validateBranchStorageConfig(config);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid mode', () => {
      const config = {
        mode: 'invalid' as StorageMode,
        maxBranches: 10,
        lazyIndex: true,
        backgroundIndex: false,
      };

      const result = validateBranchStorageConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid storage mode: invalid');
    });

    it('should reject invalid maxBranches', () => {
      const config: BranchStorageConfig = {
        mode: StorageMode.MULTI_DB,
        maxBranches: 0,
        lazyIndex: true,
        backgroundIndex: false,
      };

      const result = validateBranchStorageConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('maxBranches must be between 1 and 100');
    });

    it('should accept valid maxBranches', () => {
      const config: BranchStorageConfig = {
        mode: StorageMode.MULTI_DB,
        maxBranches: 50,
        lazyIndex: true,
        backgroundIndex: false,
      };

      const result = validateBranchStorageConfig(config);
      expect(result.valid).toBe(true);
    });
  });

  describe('getStorageStats', () => {
    it('should return stats when config exists', () => {
      const testConfig: BranchStorageConfig = {
        mode: StorageMode.SHARED_DB,
        maxBranches: 20,
        lazyIndex: true,
        backgroundIndex: false,
      };

      saveBranchStorageConfig(tempDir, testConfig);

      const stats = getStorageStats(tempDir);

      expect(stats.mode).toBe(StorageMode.SHARED_DB);
      expect(stats.configExists).toBe(true);
      expect(stats.configSize).toBeGreaterThan(0);
      expect(stats.configPath).toContain('branch-storage.json');
    });

    it('should return stats when config does not exist', () => {
      const stats = getStorageStats(tempDir);

      expect(stats.mode).toBe(StorageMode.MULTI_DB); // Default
      expect(stats.configExists).toBe(false);
      expect(stats.configSize).toBe(0);
    });
  });
});
