/**
 * Tests for Content Hash Utility
 */

import { describe, it, expect } from 'vitest';
import {
  computeFileHash,
  computeFileHashFromBuffer,
  extractPathHash,
  extractContentHash,
  isValidHash,
} from '../src/utils/content-hash';

describe('Content Hash Utility', () => {
  describe('computeFileHash', () => {
    it('should generate consistent hash for same inputs', () => {
      const hash1 = computeFileHash('src/utils.ts', 'const x = 1;');
      const hash2 = computeFileHash('src/utils.ts', 'const x = 1;');

      expect(hash1).toBe(hash2);
    });

    it('should generate different hash for different content', () => {
      const hash1 = computeFileHash('src/utils.ts', 'const x = 1;');
      const hash2 = computeFileHash('src/utils.ts', 'const x = 2;');

      expect(hash1).not.toBe(hash2);
    });

    it('should generate different hash for different paths', () => {
      const hash1 = computeFileHash('src/utils.ts', 'const x = 1;');
      const hash2 = computeFileHash('src/helpers.ts', 'const x = 1;');

      expect(hash1).not.toBe(hash2);
    });

    it('should normalize path separators', () => {
      const hash1 = computeFileHash('src\\utils.ts', 'const x = 1;');
      const hash2 = computeFileHash('src/utils.ts', 'const x = 1;');

      expect(hash1).toBe(hash2);
    });

    it('should generate hash in correct format', () => {
      const hash = computeFileHash('src/utils.ts', 'const x = 1;');

      expect(hash).toMatch(/^[a-f0-9]{8}_[a-f0-9]{16}$/);
    });
  });

  describe('computeFileHashFromBuffer', () => {
    it('should generate consistent hash for same buffer', () => {
      const buffer = Buffer.from('const x = 1;');
      const hash1 = computeFileHashFromBuffer('src/utils.ts', buffer);
      const hash2 = computeFileHashFromBuffer('src/utils.ts', buffer);

      expect(hash1).toBe(hash2);
    });

    it('should generate different hash for different buffers', () => {
      const buffer1 = Buffer.from('const x = 1;');
      const buffer2 = Buffer.from('const x = 2;');
      const hash1 = computeFileHashFromBuffer('src/utils.ts', buffer1);
      const hash2 = computeFileHashFromBuffer('src/utils.ts', buffer2);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('extractPathHash', () => {
    it('should extract path hash from valid hash', () => {
      const hash = computeFileHash('src/utils.ts', 'const x = 1;');
      const pathHash = extractPathHash(hash);

      expect(pathHash).toBeTruthy();
      expect(pathHash).toMatch(/^[a-f0-9]{8}$/);
    });

    it('should return null for invalid hash', () => {
      const pathHash = extractPathHash('invalid-hash');

      expect(pathHash).toBeNull();
    });
  });

  describe('extractContentHash', () => {
    it('should extract content hash from valid hash', () => {
      const hash = computeFileHash('src/utils.ts', 'const x = 1;');
      const contentHash = extractContentHash(hash);

      expect(contentHash).toBeTruthy();
      expect(contentHash).toMatch(/^[a-f0-9]{16}$/);
    });

    it('should return null for invalid hash', () => {
      const contentHash = extractContentHash('invalid-hash');

      expect(contentHash).toBeNull();
    });
  });

  describe('isValidHash', () => {
    it('should return true for valid hash', () => {
      const hash = computeFileHash('src/utils.ts', 'const x = 1;');
      expect(isValidHash(hash)).toBe(true);
    });

    it('should return false for invalid hash', () => {
      expect(isValidHash('invalid')).toBe(false);
      expect(isValidHash('abc_def')).toBe(false);
      expect(isValidHash('abcd1234_abcdefgh12345678')).toBe(false);
    });
  });
});
