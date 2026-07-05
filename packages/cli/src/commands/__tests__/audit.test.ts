import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { Command } from 'commander';
import type { AssetResult } from '@assetopt/core';

vi.mock('@assetopt/core', () => ({
  loadConfig: vi.fn(),
  scanDirectory: vi.fn(),
  getAssetType: vi.fn(),
  getFileSize: vi.fn(),
  runPipeline: vi.fn(),
}));

import { loadConfig, scanDirectory, getAssetType, getFileSize, runPipeline } from '@assetopt/core';
import { registerAudit } from '../audit.js';

const loadConfigMock = loadConfig as unknown as Mock;
const scanDirectoryMock = scanDirectory as unknown as Mock;
const getAssetTypeMock = getAssetType as unknown as Mock;
const getFileSizeMock = getFileSize as unknown as Mock;
const runPipelineMock = runPipeline as unknown as Mock;

async function runAudit(args: string[]): Promise<void> {
  const program = new Command();
  program.exitOverride();
  registerAudit(program);
  await program.parseAsync(['node', 'assetopt', 'audit', ...args]);
}

describe('audit command', () => {
  beforeEach(() => {
    loadConfigMock.mockResolvedValue({ config: { output: { dir: 'dist' } }, source: null });
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  describe('fast audit (default)', () => {
    it('does not run the pipeline and exits 1 when a file is flagged', async () => {
      scanDirectoryMock.mockResolvedValue(['/proj/big.png', '/proj/small.css']);
      getAssetTypeMock.mockImplementation((p: string) => (p.endsWith('.png') ? 'image' : 'css'));
      getFileSizeMock.mockImplementation((p: string) =>
        Promise.resolve(p.includes('big') ? 600 * 1024 : 2 * 1024),
      );
      const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);

      await runAudit([]);

      expect(runPipelineMock).not.toHaveBeenCalled();
      // big.png (600 KB) exceeds the 500 KB image threshold → 1 issue → exit 1.
      expect(exit).toHaveBeenCalledWith(1);
    });

    it('does not exit when every file is within thresholds', async () => {
      scanDirectoryMock.mockResolvedValue(['/proj/small.css']);
      getAssetTypeMock.mockReturnValue('css');
      getFileSizeMock.mockResolvedValue(2 * 1024);
      const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);

      await runAudit([]);

      expect(exit).not.toHaveBeenCalled();
    });

    it('reports no assets found on an empty directory', async () => {
      scanDirectoryMock.mockResolvedValue([]);
      const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);

      await runAudit([]);

      expect(exit).not.toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('No supported assets found'),
      );
    });
  });

  describe('full audit (--savings)', () => {
    function makeAsset(overrides: Partial<AssetResult> = {}): AssetResult {
      return {
        inputPath: '/proj/photo.png',
        outputPath: '/proj/dist/photo.avif',
        inputSize: 100 * 1024,
        outputSize: 40 * 1024,
        savedBytes: 60 * 1024,
        savedPercent: 60,
        assetType: 'image',
        durationMs: 3,
        cached: false,
        ...overrides,
      };
    }

    it('runs the pipeline in dry-run mode and flags files above the threshold', async () => {
      runPipelineMock.mockResolvedValue([makeAsset()]);
      const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);

      await runAudit(['--savings', '--threshold', '10']);

      expect(runPipelineMock).toHaveBeenCalledOnce();
      expect(runPipelineMock.mock.calls[0][2].dryRun).toBe(true);
      // 60% savings >= 10% threshold → flagged → exit 1.
      expect(exit).toHaveBeenCalledWith(1);
    });

    it('does not flag savings below the --threshold', async () => {
      runPipelineMock.mockResolvedValue([makeAsset({ savedPercent: 3, inputSize: 10 * 1024 })]);
      const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);

      await runAudit(['--savings', '--threshold', '10']);

      expect(exit).not.toHaveBeenCalled();
    });

    it('reports no assets found when the pipeline returns nothing', async () => {
      runPipelineMock.mockResolvedValue([]);
      const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);

      await runAudit(['--savings']);

      expect(exit).not.toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('No supported assets found'),
      );
    });
  });

  it('routes thrown errors through handleCliError (exit 1)', async () => {
    scanDirectoryMock.mockRejectedValue(new Error('disk error'));
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);

    await runAudit([]);

    expect(exit).toHaveBeenCalledWith(1);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('disk error'));
  });

  it('passes merged include/exclude globs to scanDirectory (fast path)', async () => {
    loadConfigMock.mockResolvedValue({
      config: { input: { include: ['**/*.png'], exclude: ['from-rc/**'] } },
      source: null,
    });
    scanDirectoryMock.mockResolvedValue([]);

    await runAudit(['--exclude', 'drafts/**']);

    const scanOptions = scanDirectoryMock.mock.calls[0][1];
    expect(scanOptions.include).toEqual(['**/*.png']);
    expect(scanOptions.exclude).toEqual(['from-rc/**', 'drafts/**']);
  });

  it('passes merged excludes to the pipeline with --savings', async () => {
    loadConfigMock.mockResolvedValue({ config: {}, source: null });
    runPipelineMock.mockResolvedValue([]);

    await runAudit(['--savings', '--exclude', 'drafts/**']);

    const config = runPipelineMock.mock.calls[0][1];
    expect(config.input.exclude).toEqual(['drafts/**']);
  });
});
