/**
 * Content Hash Utility
 *
 * Provides content-addressable hashing for file deduplication.
 * Uses file path + content to generate unique hashes.
 */

import * as crypto from 'crypto';

/**
 * Compute a content hash for a file.
 *
 * The hash combines file path and content to ensure:
 * - Same content at different paths gets different hashes
 * - Same path with different content gets different hashes
 * - Deterministic: same inputs always produce same hash
 *
 * @param filePath - Path to the file (relative to project root)
 * @param content - File content string
 * @returns Hash string in format: `<pathHash8>_<contentHash16>`
 */
export function computeFileHash(filePath: string, content: string): string {
  // Normalize path separators for cross-platform consistency
  const normalizedPath = filePath.replace(/\\/g, '/');

  // Path hash: 8 chars (first 8 of MD5)
  const pathHash = crypto
    .createHash('md5')
    .update(normalizedPath)
    .digest('hex')
    .slice(0, 8);

  // Content hash: 16 chars (first 16 of MD5)
  const contentHash = crypto
    .createHash('md5')
    .update(content, 'utf-8')
    .digest('hex')
    .slice(0, 16);

  return `${pathHash}_${contentHash}`;
}

/**
 * Compute a content hash from a buffer (for binary files or streams).
 *
 * @param filePath - Path to the file
 * @param buffer - File content as Buffer
 * @returns Hash string
 */
export function computeFileHashFromBuffer(filePath: string, buffer: Buffer): string {
  const normalizedPath = filePath.replace(/\\/g, '/');

  const pathHash = crypto
    .createHash('md5')
    .update(normalizedPath)
    .digest('hex')
    .slice(0, 8);

  const contentHash = crypto
    .createHash('md5')
    .update(buffer)
    .digest('hex')
    .slice(0, 16);

  return `${pathHash}_${contentHash}`;
}

/**
 * Extract path hash component from a full hash.
 *
 * @param hash - Full hash string (format: `<pathHash8>_<contentHash16>`)
 * @returns Path hash portion, or null if invalid format
 */
export function extractPathHash(hash: string): string | null {
  const parts = hash.split('_');
  return parts.length === 2 ? parts[0] : null;
}

/**
 * Extract content hash component from a full hash.
 *
 * @param hash - Full hash string (format: `<pathHash8>_<contentHash16>`)
 * @returns Content hash portion, or null if invalid format
 */
export function extractContentHash(hash: string): string | null {
  const parts = hash.split('_');
  return parts.length === 2 ? parts[1] : null;
}

/**
 * Validate hash format.
 *
 * @param hash - Hash string to validate
 * @returns true if valid format
 */
export function isValidHash(hash: string): boolean {
  return /^[a-f0-9]{8}_[a-f0-9]{16}$/.test(hash);
}
