import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Command } from 'commander';

// Mock the core so the test never needs the built `dist` (CI runs tests
// before build). Only the runtime value `DEFAULTS` is consumed by init.
// `vi.hoisted` lets the const be referenced from the hoisted vi.mock factory.
const { DEFAULTS } = vi.hoisted(() => ({
  DEFAULTS: { output: { dir: 'dist' }, formats: 'web-perf' },
}));
vi.mock('@assetopt/core', () => ({ DEFAULTS }));

import { registerInit } from '../init.js';

async function runInit(args: string[]): Promise<void> {
  const program = new Command();
  program.exitOverride();
  registerInit(program);
  await program.parseAsync(['node', 'assetopt', 'init', ...args]);
}

describe('init command', () => {
  let dir: string;
  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    dir = await mkdtemp(join(tmpdir(), 'assetopt-init-'));
    process.chdir(dir);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await rm(dir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('writes .assetoptrc with the core DEFAULTS when none exists', async () => {
    await runInit([]);

    const content = await readFile(join(dir, '.assetoptrc'), 'utf8');
    expect(JSON.parse(content)).toEqual(DEFAULTS);
    expect(content.endsWith('\n')).toBe(true);
    expect(console.log).toHaveBeenCalledWith('Created .assetoptrc');
  });

  it('reports an error and exits 1 when the file exists without --force', async () => {
    await writeFile(join(dir, '.assetoptrc'), '{"existing":true}');
    // In production `process.exit(1)` terminates the process, so writeFile is
    // never reached. We can't reproduce that here: the exit guard sits inside a
    // try/catch, so any thrown sentinel would be swallowed by that catch. We
    // therefore assert the observable contract — the error message and exit(1).
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);

    await runInit([]);

    expect(exit).toHaveBeenCalledWith(1);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('already exists'));
  });

  it('overwrites an existing file when --force is passed', async () => {
    await writeFile(join(dir, '.assetoptrc'), '{"existing":true}');

    await runInit(['--force']);

    const content = await readFile(join(dir, '.assetoptrc'), 'utf8');
    expect(JSON.parse(content)).toEqual(DEFAULTS);
  });
});
