import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, writeFile, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfig, resolveConfig, mergeConfig, DEFAULTS } from '../loader.js';
import { PRESETS } from '../presets.js';

describe('resolveConfig', () => {
  it('returns DEFAULTS when no preset and no overrides', () => {
    const result = resolveConfig({});
    expect(result.images?.quality?.jpeg).toBe(DEFAULTS.images?.quality?.jpeg);
    expect(result.images?.formatMatrix).toBeUndefined();
  });

  it('injects preset matrix when preset is set', () => {
    const result = resolveConfig({ preset: 'web-perf' });
    expect(result.images?.formatMatrix).toEqual(PRESETS['web-perf'].images?.formatMatrix);
  });

  it('user matrix entries override preset entries (deep merge)', () => {
    const result = resolveConfig({
      preset: 'web-perf',
      images: { formatMatrix: { png: 'webp' } },
    });
    expect(result.images?.formatMatrix?.png).toBe('webp'); // user override
    expect(result.images?.formatMatrix?.jpeg).toBe('webp'); // from preset
    expect(result.images?.formatMatrix?.webp).toBe('keep'); // from preset
  });

  it('user matrix without preset works as-is (no preset injection)', () => {
    const result = resolveConfig({
      images: { formatMatrix: { jpeg: 'avif' } },
    });
    expect(result.images?.formatMatrix).toEqual({ jpeg: 'avif' });
  });

  it('preset preserves DEFAULTS for non-matrix settings', () => {
    const result = resolveConfig({ preset: 'web-perf' });
    expect(result.images?.quality?.jpeg).toBe(DEFAULTS.images?.quality?.jpeg);
    expect(result.images?.stripMetadata).toBe(DEFAULTS.images?.stripMetadata);
    expect(result.css?.minify).toBe(DEFAULTS.css?.minify);
  });

  it('max-compression routes every format to avif at aggressive quality', () => {
    const result = resolveConfig({ preset: 'max-compression' });
    expect(result.images?.formatMatrix).toEqual({
      jpeg: 'avif',
      png: 'avif',
      webp: 'avif',
      avif: 'keep',
    });
    expect(result.images?.quality?.avif).toBe(50);
    expect(result.svg).toEqual({ multipass: true, minifyIds: true });
  });

  it('max-compression keeps non-avif quality from DEFAULTS', () => {
    const result = resolveConfig({ preset: 'max-compression' });
    expect(result.images?.quality?.jpeg).toBe(DEFAULTS.images?.quality?.jpeg);
  });

  it('quality preset keeps formats, raises quality, preserves metadata', () => {
    const result = resolveConfig({ preset: 'quality' });
    expect(result.images?.formatMatrix).toEqual({
      jpeg: 'keep',
      png: 'keep',
      webp: 'keep',
      avif: 'keep',
    });
    expect(result.images?.quality).toEqual({ jpeg: 95, png: 95, webp: 95, avif: 90 });
    expect(result.images?.stripMetadata).toBe(false);
  });

  it('compatibility preset keeps every format and DEFAULTS quality', () => {
    const result = resolveConfig({ preset: 'compatibility' });
    expect(result.images?.formatMatrix).toEqual({
      jpeg: 'keep',
      png: 'keep',
      webp: 'keep',
      avif: 'keep',
    });
    expect(result.images?.quality?.jpeg).toBe(DEFAULTS.images?.quality?.jpeg);
    expect(result.images?.stripMetadata).toBe(DEFAULTS.images?.stripMetadata);
  });

  it('user quality overrides max-compression preset quality (deep merge)', () => {
    const result = resolveConfig({
      preset: 'max-compression',
      images: { quality: { avif: 70 } },
    });
    expect(result.images?.quality?.avif).toBe(70); // user override
    expect(result.images?.formatMatrix?.jpeg).toBe('avif'); // from preset
  });

  it('user quality overrides DEFAULTS quality (existing behavior)', () => {
    const result = resolveConfig({
      images: { quality: { jpeg: 50 } },
    });
    expect(result.images?.quality?.jpeg).toBe(50);
    expect(result.images?.quality?.png).toBe(DEFAULTS.images?.quality?.png);
  });
});

describe('loadConfig', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'assetopt-test-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('returns DEFAULTS with source: null when no .assetoptrc exists', async () => {
    const result = await loadConfig(tmpDir);
    expect(result.config).toEqual(DEFAULTS);
    expect(result.source).toBeNull();
  });

  it('loads and resolves a valid .assetoptrc', async () => {
    const filePath = join(tmpDir, '.assetoptrc');
    await writeFile(filePath, JSON.stringify({ preset: 'web-perf' }));
    const result = await loadConfig(tmpDir);
    expect(result.config.images?.formatMatrix).toBeDefined();
    expect(result.config.images?.formatMatrix?.jpeg).toBe('webp');
    expect(result.source).toBe(filePath);
  });

  it('walks up parent directories to find .assetoptrc', async () => {
    const filePath = join(tmpDir, '.assetoptrc');
    await writeFile(filePath, JSON.stringify({ preset: 'web-perf' }));
    const subDir = join(tmpDir, 'sub', 'deep');
    await mkdir(subDir, { recursive: true });
    const result = await loadConfig(subDir);
    expect(result.source).toBe(filePath);
    expect(result.config.images?.formatMatrix?.jpeg).toBe('webp');
  });

  it('throws on malformed JSON', async () => {
    await writeFile(join(tmpDir, '.assetoptrc'), '{ malformed json');
    await expect(loadConfig(tmpDir)).rejects.toThrow(/Invalid /);
  });

  it('throws on schema violation (out-of-range quality)', async () => {
    await writeFile(
      join(tmpDir, '.assetoptrc'),
      JSON.stringify({ images: { quality: { jpeg: 200 } } }),
    );
    await expect(loadConfig(tmpDir)).rejects.toThrow(/Invalid /);
  });

  it('throws on unknown preset name', async () => {
    await writeFile(join(tmpDir, '.assetoptrc'), JSON.stringify({ preset: 'nonexistent-preset' }));
    await expect(loadConfig(tmpDir)).rejects.toThrow(/Invalid /);
  });
});

describe('mergeConfig — formatMatrix deep merge', () => {
  it('omits formatMatrix when neither base nor override has it', () => {
    const result = mergeConfig({ images: { quality: { jpeg: 80 } } }, {});
    expect(result.images && 'formatMatrix' in result.images).toBe(false);
  });

  it('merges entries from both base and override', () => {
    const result = mergeConfig(
      { images: { formatMatrix: { jpeg: 'webp', png: 'avif' } } },
      { images: { formatMatrix: { jpeg: 'avif', webp: 'keep' } } },
    );
    expect(result.images?.formatMatrix).toEqual({
      jpeg: 'avif', // overridden
      png: 'avif', // from base
      webp: 'keep', // from override
    });
  });
});
