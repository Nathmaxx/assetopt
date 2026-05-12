import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { existsSync } from 'node:fs';
import {
  computeCacheKey,
  readManifest,
  writeManifest,
  toPosixPath,
  type Manifest,
} from '../manifest.js';
import { sep as PATH_SEP } from 'node:path';

describe('computeCacheKey', () => {
  const buf = Buffer.from('hello world');

  it('is deterministic for identical inputs', () => {
    const a = computeCacheKey(buf, { quality: 80 }, '1.0.0');
    const b = computeCacheKey(buf, { quality: 80 }, '1.0.0');
    expect(a).toBe(b);
  });

  it('changes when buffer content changes', () => {
    const a = computeCacheKey(Buffer.from('a'), {}, '1.0.0');
    const b = computeCacheKey(Buffer.from('b'), {}, '1.0.0');
    expect(a).not.toBe(b);
  });

  it('changes when options change', () => {
    const a = computeCacheKey(buf, { quality: 80 }, '1.0.0');
    const b = computeCacheKey(buf, { quality: 90 }, '1.0.0');
    expect(a).not.toBe(b);
  });

  it('changes when version changes', () => {
    const a = computeCacheKey(buf, {}, '1.0.0');
    const b = computeCacheKey(buf, {}, '1.0.1');
    expect(a).not.toBe(b);
  });

  it('is invariant to object key order', () => {
    const a = computeCacheKey(buf, { a: 1, b: 2 }, '1.0.0');
    const b = computeCacheKey(buf, { b: 2, a: 1 }, '1.0.0');
    expect(a).toBe(b);
  });

  it('is invariant to nested key order', () => {
    const a = computeCacheKey(buf, { quality: { jpeg: 80, png: 90 } }, '1.0.0');
    const b = computeCacheKey(buf, { quality: { png: 90, jpeg: 80 } }, '1.0.0');
    expect(a).toBe(b);
  });

  it('drops undefined values like JSON.stringify', () => {
    const a = computeCacheKey(buf, { a: 1, b: undefined }, '1.0.0');
    const b = computeCacheKey(buf, { a: 1 }, '1.0.0');
    expect(a).toBe(b);
  });

  it('serializes function values via .toString()', () => {
    const fn1 = (ctx: { hasAlpha: boolean }) => (ctx.hasAlpha ? 'avif' : 'webp');
    const fn2 = (ctx: { hasAlpha: boolean }) => (ctx.hasAlpha ? 'avif' : 'webp');
    const a = computeCacheKey(buf, { png: fn1 }, '1.0.0');
    const b = computeCacheKey(buf, { png: fn2 }, '1.0.0');
    expect(a).toBe(b);
  });

  it('changes when function body changes', () => {
    const fn1 = (ctx: { hasAlpha: boolean }) => (ctx.hasAlpha ? 'avif' : 'webp');
    const fn2 = (ctx: { hasAlpha: boolean }) => (ctx.hasAlpha ? 'webp' : 'avif');
    const a = computeCacheKey(buf, { png: fn1 }, '1.0.0');
    const b = computeCacheKey(buf, { png: fn2 }, '1.0.0');
    expect(a).not.toBe(b);
  });

  it('returns a 64-char hex sha256 digest', () => {
    const key = computeCacheKey(buf, {}, '1.0.0');
    expect(key).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('manifest I/O', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'assetopt-cache-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('readManifest returns empty object when file does not exist', async () => {
    const result = await readManifest(path.join(dir, 'missing.json'));
    expect(result).toEqual({});
  });

  it('readManifest parses a valid JSON manifest', async () => {
    const manifestPath = path.join(dir, 'manifest.json');
    const data: Manifest = {
      abc123: {
        inputSize: 1000,
        outputSize: 500,
        outputPath: 'photo.webp',
        outputFormat: 'webp',
        timestamp: 1234567890,
      },
    };
    await writeFile(manifestPath, JSON.stringify(data));
    const result = await readManifest(manifestPath);
    expect(result).toEqual(data);
  });

  it('readManifest throws on invalid JSON', async () => {
    const manifestPath = path.join(dir, 'broken.json');
    await writeFile(manifestPath, 'not json {');
    await expect(readManifest(manifestPath)).rejects.toThrow();
  });

  it('writeManifest creates parent directory if missing', async () => {
    const nested = path.join(dir, 'deep', 'nested', 'cache.json');
    await writeManifest(nested, {});
    expect(existsSync(nested)).toBe(true);
  });

  it('round-trips: write then read returns same manifest', async () => {
    const manifestPath = path.join(dir, 'manifest.json');
    const original: Manifest = {
      key1: { inputSize: 100, outputSize: 50, outputPath: 'a.jpg', timestamp: 1 },
      key2: {
        inputSize: 200,
        outputSize: 80,
        outputPath: 'b.webp',
        outputFormat: 'webp',
        timestamp: 2,
      },
    };
    await writeManifest(manifestPath, original);
    const read = await readManifest(manifestPath);
    expect(read).toEqual(original);
  });

  it('writeManifest produces formatted JSON', async () => {
    const manifestPath = path.join(dir, 'manifest.json');
    await writeManifest(manifestPath, {
      key: { inputSize: 1, outputSize: 1, outputPath: 'x', timestamp: 1 },
    });
    const { readFile } = await import('node:fs/promises');
    const content = await readFile(manifestPath, 'utf-8');
    expect(content).toContain('\n');
  });
});

describe('toPosixPath', () => {
  it('replaces native separators with forward slashes', () => {
    const native = ['sub', 'dir', 'photo.jpg'].join(PATH_SEP);
    expect(toPosixPath(native)).toBe('sub/dir/photo.jpg');
  });

  it('is a no-op for paths without separators', () => {
    expect(toPosixPath('photo.jpg')).toBe('photo.jpg');
  });

  it('is idempotent on already-posix paths', () => {
    expect(toPosixPath('sub/dir/photo.jpg')).toBe('sub/dir/photo.jpg');
  });
});
