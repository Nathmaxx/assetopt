import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { resolve } from 'node:path';
import { Command } from 'commander';
import type { OptimizeResult } from '@assetopt/core';

vi.mock('@assetopt/core', () => ({
  loadConfig: vi.fn(),
  runPipeline: vi.fn(),
  buildReport: vi.fn(),
}));

import { loadConfig, runPipeline, buildReport } from '@assetopt/core';
import { registerOptimize } from '../optimize.js';

const loadConfigMock = loadConfig as unknown as Mock;
const runPipelineMock = runPipeline as unknown as Mock;
const buildReportMock = buildReport as unknown as Mock;

function makeReport(overrides: Partial<OptimizeResult> = {}): OptimizeResult {
  return {
    assets: [],
    totalInputSize: 1000,
    totalOutputSize: 700,
    totalSavedBytes: 300,
    totalSavedPercent: 30,
    durationMs: 5,
    cachedCount: 0,
    errorCount: 0,
    ...overrides,
  };
}

async function runOptimize(args: string[]): Promise<void> {
  const program = new Command();
  program.exitOverride();
  registerOptimize(program);
  await program.parseAsync(['node', 'assetopt', 'optimize', ...args]);
}

describe('optimize command', () => {
  beforeEach(() => {
    loadConfigMock.mockResolvedValue({ config: { output: { dir: 'dist' } }, source: null });
    runPipelineMock.mockResolvedValue([]);
    buildReportMock.mockReturnValue(makeReport());
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('uses the cache by default', async () => {
    await runOptimize([]);

    expect(runPipelineMock).toHaveBeenCalledOnce();
    const [cwd, , opts] = runPipelineMock.mock.calls[0];
    expect(cwd).toBe(resolve(process.cwd(), '.'));
    expect(opts.useCache).toBe(true);
  });

  it('bypasses the cache with --no-cache', async () => {
    await runOptimize(['--no-cache']);

    const opts = runPipelineMock.mock.calls[0][2];
    expect(opts.useCache).toBe(false);
  });

  it('resolves the target directory argument', async () => {
    await runOptimize(['assets/img']);

    expect(runPipelineMock.mock.calls[0][0]).toBe(resolve(process.cwd(), 'assets/img'));
  });

  it('overrides output.dir with -o', async () => {
    await runOptimize(['-o', 'build/out']);

    const config = runPipelineMock.mock.calls[0][1];
    expect(config.output.dir).toBe(resolve(process.cwd(), 'build/out'));
  });

  it('keeps the config output.dir when -o is omitted', async () => {
    await runOptimize([]);

    const config = runPipelineMock.mock.calls[0][1];
    expect(config.output.dir).toBe('dist');
  });

  it('prints the report as JSON with --json (and nothing else)', async () => {
    const report = makeReport({ totalSavedPercent: 42 });
    buildReportMock.mockReturnValue(report);

    await runOptimize(['--json']);

    expect(console.log).toHaveBeenCalledOnce();
    expect(console.log).toHaveBeenCalledWith(JSON.stringify(report, null, 2));
    // Progress reporting must be disabled in JSON mode.
    expect(runPipelineMock.mock.calls[0][2].onProgress).toBeUndefined();
  });

  it('exits 1 when savings fall below --min-savings', async () => {
    buildReportMock.mockReturnValue(makeReport({ totalSavedPercent: 5 }));
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);

    await runOptimize(['--min-savings', '20']);

    expect(exit).toHaveBeenCalledWith(1);
  });

  it('exits 1 when the report contains failed assets', async () => {
    buildReportMock.mockReturnValue(makeReport({ errorCount: 2 }));
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);

    await runOptimize([]);

    expect(exit).toHaveBeenCalledWith(1);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('2 assets failed'));
  });

  it('keeps JSON on stdout and the failure message on stderr with --json', async () => {
    const report = makeReport({ errorCount: 1 });
    buildReportMock.mockReturnValue(report);
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);

    await runOptimize(['--json']);

    expect(console.log).toHaveBeenCalledOnce();
    expect(console.log).toHaveBeenCalledWith(JSON.stringify(report, null, 2));
    expect(exit).toHaveBeenCalledWith(1);
  });

  it('routes thrown errors through handleCliError (exit 1)', async () => {
    loadConfigMock.mockRejectedValue(new Error('boom'));
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);

    await runOptimize([]);

    expect(exit).toHaveBeenCalledWith(1);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('boom'));
  });

  it('appends --exclude globs to the config input.exclude', async () => {
    loadConfigMock.mockResolvedValue({
      config: { input: { exclude: ['from-rc/**'] } },
      source: null,
    });

    await runOptimize(['--exclude', 'drafts/**', '--exclude', '**/*.min.js']);

    const config = runPipelineMock.mock.calls[0][1];
    expect(config.input.exclude).toEqual(['from-rc/**', 'drafts/**', '**/*.min.js']);
  });

  it('leaves config.input untouched without --exclude', async () => {
    await runOptimize([]);

    const config = runPipelineMock.mock.calls[0][1];
    expect(config.input).toBeUndefined();
  });

  it('sets output.forceReencode with --force-reencode', async () => {
    await runOptimize(['--force-reencode']);

    const config = runPipelineMock.mock.calls[0][1];
    expect(config.output.forceReencode).toBe(true);
  });

  it('leaves forceReencode unset by default', async () => {
    await runOptimize([]);

    const config = runPipelineMock.mock.calls[0][1];
    expect(config.output.forceReencode).toBeUndefined();
  });
});
