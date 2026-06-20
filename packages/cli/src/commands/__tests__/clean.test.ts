import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Command } from 'commander';

vi.mock('@assetopt/core', () => ({
  loadConfig: vi.fn(),
  CACHE_FILE: '.assetopt-cache.json',
}));

import { loadConfig } from '@assetopt/core';
import { registerClean } from '../clean.js';

const loadConfigMock = loadConfig as unknown as Mock;

let outDir: string;
let cachePath: string;
let assetPath: string;

async function runClean(args: string[]): Promise<void> {
  const program = new Command();
  program.exitOverride();
  registerClean(program);
  await program.parseAsync(['node', 'assetopt', 'clean', ...args]);
}

describe('clean command', () => {
  beforeEach(async () => {
    outDir = await mkdtemp(join(tmpdir(), 'assetopt-clean-'));
    cachePath = join(outDir, '.assetopt-cache.json');
    assetPath = join(outDir, 'photo.webp');
    await writeFile(cachePath, '{}');
    await writeFile(assetPath, 'binary');

    loadConfigMock.mockResolvedValue({ config: { output: { dir: outDir } }, source: null });
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    await rm(outDir, { recursive: true, force: true });
  });

  it('removes only the cache manifest by default', async () => {
    await runClean([]);

    expect(existsSync(cachePath)).toBe(false);
    // The optimized assets and the directory itself are left untouched.
    expect(existsSync(assetPath)).toBe(true);
    expect(existsSync(outDir)).toBe(true);
  });

  it('removes the entire output directory with --all', async () => {
    await runClean(['--all']);

    expect(existsSync(outDir)).toBe(false);
  });

  it('deletes nothing in --dry-run', async () => {
    await runClean(['--dry-run']);

    expect(existsSync(cachePath)).toBe(true);
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Would remove'));
  });

  it('reports gracefully when there is nothing to clean', async () => {
    await rm(cachePath);

    await runClean([]);

    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Nothing to clean'));
  });

  it('targets the -o override instead of config output.dir', async () => {
    const other = await mkdtemp(join(tmpdir(), 'assetopt-clean-o-'));
    await writeFile(join(other, '.assetopt-cache.json'), '{}');

    await runClean(['-o', other]);

    expect(existsSync(join(other, '.assetopt-cache.json'))).toBe(false);
    // The config's output dir cache is left alone.
    expect(existsSync(cachePath)).toBe(true);
    await rm(other, { recursive: true, force: true });
  });

  it('refuses --all when the output dir contains the cwd (exit 1)', async () => {
    loadConfigMock.mockResolvedValue({ config: { output: { dir: process.cwd() } }, source: null });
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);

    await runClean(['--all']);

    expect(exit).toHaveBeenCalledWith(1);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('refusing to remove'));
    // The cwd must still be intact.
    expect(existsSync(join(process.cwd(), 'package.json'))).toBe(true);
  });

  it('routes thrown errors through handleCliError (exit 1)', async () => {
    loadConfigMock.mockRejectedValue(new Error('config boom'));
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);

    await runClean([]);

    expect(exit).toHaveBeenCalledWith(1);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('config boom'));
  });
});
