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
import { registerAnalyze } from '../analyze.js';

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

async function runAnalyze(args: string[]): Promise<void> {
  const program = new Command();
  program.exitOverride();
  registerAnalyze(program);
  await program.parseAsync(['node', 'assetopt', 'analyze', ...args]);
}

describe('analyze command', () => {
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

  it('always runs the pipeline in dry-run mode', async () => {
    await runAnalyze([]);

    expect(runPipelineMock).toHaveBeenCalledOnce();
    const [cwd, , opts] = runPipelineMock.mock.calls[0];
    expect(cwd).toBe(resolve(process.cwd(), '.'));
    expect(opts.dryRun).toBe(true);
    expect(opts.useCache).toBe(true);
  });

  it('bypasses the cache with --no-cache', async () => {
    await runAnalyze(['--no-cache']);

    const opts = runPipelineMock.mock.calls[0][2];
    expect(opts.dryRun).toBe(true);
    expect(opts.useCache).toBe(false);
  });

  it('overrides output.dir with -o', async () => {
    await runAnalyze(['-o', 'cache/dir']);

    const config = runPipelineMock.mock.calls[0][1];
    expect(config.output.dir).toBe(resolve(process.cwd(), 'cache/dir'));
  });

  it('prints the report as JSON with --json (and nothing else)', async () => {
    const report = makeReport({ totalSavedPercent: 42 });
    buildReportMock.mockReturnValue(report);

    await runAnalyze(['--json']);

    expect(console.log).toHaveBeenCalledOnce();
    expect(console.log).toHaveBeenCalledWith(JSON.stringify(report, null, 2));
    // Progress reporting must be disabled in JSON mode.
    expect(runPipelineMock.mock.calls[0][2].onProgress).toBeUndefined();
  });

  it('exits 1 when savings fall below --min-savings', async () => {
    buildReportMock.mockReturnValue(makeReport({ totalSavedPercent: 2 }));
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);

    await runAnalyze(['--min-savings', '20']);

    expect(exit).toHaveBeenCalledWith(1);
  });

  it('exits 1 when the report contains failed assets', async () => {
    buildReportMock.mockReturnValue(makeReport({ errorCount: 1 }));
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);

    await runAnalyze([]);

    expect(exit).toHaveBeenCalledWith(1);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('1 asset failed'));
  });

  it('routes thrown errors through handleCliError (exit 1)', async () => {
    runPipelineMock.mockRejectedValue(new Error('scan failed'));
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);

    await runAnalyze([]);

    expect(exit).toHaveBeenCalledWith(1);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('scan failed'));
  });

  it('appends --exclude globs to the config input.exclude', async () => {
    loadConfigMock.mockResolvedValue({
      config: { input: { exclude: ['from-rc/**'] } },
      source: null,
    });

    await runAnalyze(['--exclude', 'drafts/**']);

    const config = runPipelineMock.mock.calls[0][1];
    expect(config.input.exclude).toEqual(['from-rc/**', 'drafts/**']);
  });
});
