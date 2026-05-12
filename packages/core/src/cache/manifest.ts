import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, sep } from 'node:path';
import { ensureDir } from '../utils/fs.js';

/**
 * Normalize a path to posix-style separators (`/`) for storage in the manifest.
 * `path.resolve` accepts forward slashes on every platform, so a normalized
 * manifest stays valid when the project is moved between Windows and Unix.
 */
export function toPosixPath(p: string): string {
  return sep === '/' ? p : p.split(sep).join('/');
}

/**
 * One cache record per processed asset. The key in the manifest is the
 * sha256 produced by {@link computeCacheKey}; the entry stores enough
 * information to reconstruct an `AssetResult` on a hit without re-running
 * any optimizer.
 *
 * - `outputPath` is **relative to the output directory**, so the manifest
 *   stays portable when the project is moved.
 * - `outputFormat` is only set for images (the resolved format that was
 *   actually written, e.g. `'webp'`).
 */
export interface CacheEntry {
  inputSize: number;
  outputSize: number;
  outputPath: string;
  outputFormat?: string;
  timestamp: number;
}

/** On-disk shape of `.assetopt-cache.json`. */
export type Manifest = Record<string, CacheEntry>;

/** Conventional file name for the on-disk manifest, relative to `output.dir`. */
export const CACHE_FILE = '.assetopt-cache.json';

// Stable JSON serialization: object keys sorted, undefined dropped, functions
// serialized via .toString(). Required so that `{a:1,b:2}` and `{b:2,a:1}` hash
// identically, and so that smart-routing function callbacks in formatMatrix
// invalidate the cache when their body changes.
function stableStringify(value: unknown): string {
  if (typeof value === 'function') {
    return JSON.stringify(value.toString());
  }
  if (value === null || typeof value !== 'object') {
    const serialized = JSON.stringify(value);
    return serialized === undefined ? 'null' : serialized;
  }
  if (Array.isArray(value)) {
    return '[' + value.map(stableStringify).join(',') + ']';
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort();
  const parts = keys.map((k) => JSON.stringify(k) + ':' + stableStringify(obj[k]));
  return '{' + parts.join(',') + '}';
}

/**
 * Deterministic sha256 over `(input bytes, options, assetopt version)`.
 *
 * Properties:
 * - Identical inputs always yield the same key.
 * - Object key order is irrelevant (`{a,b}` and `{b,a}` hash the same).
 * - `undefined` properties are dropped, matching `JSON.stringify` semantics.
 * - Function values are serialized via `Function.prototype.toString`, so a
 *   change in the body of a `formatMatrix` resolver invalidates the cache.
 *
 * The version argument is bumped on every release of `@assetopt/core`,
 * so any change to the optimizer logic invalidates every entry.
 */
export function computeCacheKey(
  buffer: Buffer,
  options: unknown,
  version: string,
): string {
  const hash = createHash('sha256');
  hash.update(buffer);
  hash.update('\x00');
  hash.update(stableStringify(options));
  hash.update('\x00');
  hash.update(version);
  return hash.digest('hex');
}

/**
 * Loads a manifest from disk. Returns an empty manifest if the file does not
 * exist (first run, or cache cleared). Any other I/O or JSON error is thrown
 * — a corrupt manifest is a real problem and should surface, not be silently
 * discarded.
 */
export async function readManifest(path: string): Promise<Manifest> {
  let content: string;
  try {
    content = await readFile(path, 'utf-8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return {};
    throw err;
  }
  return JSON.parse(content) as Manifest;
}

/**
 * Persists a manifest to disk as pretty-printed JSON. The parent directory
 * is created if missing, so callers can write to a fresh `output.dir`
 * without a separate `mkdir` step.
 */
export async function writeManifest(path: string, manifest: Manifest): Promise<void> {
  await ensureDir(dirname(path));
  await writeFile(path, JSON.stringify(manifest, null, 2));
}
