import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  formatBytes,
  formatDuration,
  colorType,
  formatAuditRow,
  printConfigSource,
  printReport,
} from '../format.js';
import type { AssetResult, OptimizeResult } from '@assetopt/core';

// picocolors may or may not emit ANSI depending on the environment (TTY,
// FORCE_COLOR, NO_COLOR). Strip escape codes so assertions test text only.
// eslint-disable-next-line no-control-regex
const stripAnsi = (s: string): string => s.replace(/\x1b\[[0-9;]*m/g, '');

function captureLog(fn: () => void): string {
  const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
  fn();
  const out = log.mock.calls.map((c) => stripAnsi(String(c[0] ?? ''))).join('\n');
  log.mockRestore();
  return out;
}

function makeAsset(overrides: Partial<AssetResult> = {}): AssetResult {
  return {
    inputPath: '/project/assets/photo.jpg',
    outputPath: '/project/optimized/photo.jpg',
    inputSize: 2000,
    outputSize: 1000,
    savedBytes: 1000,
    savedPercent: 50,
    assetType: 'image',
    durationMs: 5,
    cached: false,
    ...overrides,
  };
}

describe('formatBytes', () => {
  it('formats bytes under 1 KB', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1023)).toBe('1023 B');
  });

  it('formats kilobytes', () => {
    expect(formatBytes(1024)).toBe('1.0 KB');
    expect(formatBytes(1536)).toBe('1.5 KB');
  });

  it('formats megabytes', () => {
    expect(formatBytes(1024 * 1024)).toBe('1.0 MB');
    expect(formatBytes(1024 * 1024 * 2.5)).toBe('2.5 MB');
  });
});

describe('formatDuration', () => {
  it('formats milliseconds under a second', () => {
    expect(formatDuration(0)).toBe('0ms');
    expect(formatDuration(999)).toBe('999ms');
  });

  it('formats seconds at or above 1000ms', () => {
    expect(formatDuration(1000)).toBe('1.0s');
    expect(formatDuration(1500)).toBe('1.5s');
  });
});

describe('colorType', () => {
  it('pads the type label to the requested width', () => {
    expect(stripAnsi(colorType('css'))).toBe('css  ');
    expect(stripAnsi(colorType('image'))).toBe('image');
    expect(stripAnsi(colorType('js', 8))).toBe('js      ');
  });
});

describe('formatAuditRow', () => {
  it('marks a clean row with a check and no issue text', () => {
    const out = stripAnsi(
      formatAuditRow({ filePath: '/a/small.css', type: 'css', size: 100, issues: [] }),
    );
    expect(out).toContain('✓');
    expect(out).toContain('small.css');
    expect(out).toContain('100 B');
  });

  it('marks a flagged row with a cross and joins issues with " · "', () => {
    const out = stripAnsi(
      formatAuditRow({
        filePath: '/a/big.jpg',
        type: 'image',
        size: 600 * 1024,
        issues: ['oversized', 'would save 200 KB'],
      }),
    );
    expect(out).toContain('✖');
    expect(out).toContain('oversized · would save 200 KB');
  });
});

describe('printConfigSource', () => {
  afterEach(() => vi.restoreAllMocks());

  it('warns when no config file was found', () => {
    const out = captureLog(() => printConfigSource(null));
    expect(out).toContain('no .assetoptrc found');
  });

  it('reports the path the config was loaded from', () => {
    const out = captureLog(() => printConfigSource('/project/.assetoptrc'));
    expect(out).toContain('config loaded from /project/.assetoptrc');
  });
});

describe('printReport', () => {
  afterEach(() => vi.restoreAllMocks());

  function makeReport(overrides: Partial<OptimizeResult> = {}): OptimizeResult {
    const assets = overrides.assets ?? [makeAsset()];
    return {
      assets,
      totalInputSize: 2000,
      totalOutputSize: 1000,
      totalSavedBytes: 1000,
      totalSavedPercent: 50,
      durationMs: 12,
      cachedCount: 0,
      errorCount: 0,
      ...overrides,
    };
  }

  it('prints a placeholder when there are no assets', () => {
    const out = captureLog(() => printReport(makeReport({ assets: [] }), 'optimize'));
    expect(out).toContain('No supported assets found.');
  });

  it('uses "Saved" wording in optimize mode', () => {
    const out = captureLog(() => printReport(makeReport(), 'optimize'));
    expect(out).toContain('Saved');
    expect(out).toContain('photo.jpg');
    expect(out).toContain('1 file');
  });

  it('uses "Would save" wording in analyze mode', () => {
    const out = captureLog(() => printReport(makeReport(), 'analyze'));
    expect(out).toContain('Would save');
  });

  it('surfaces the cached count and a (cached) marker when present', () => {
    const out = captureLog(() =>
      printReport(
        makeReport({ assets: [makeAsset({ cached: true })], cachedCount: 1 }),
        'optimize',
      ),
    );
    expect(out).toContain('1 cached');
    expect(out).toContain('(cached)');
  });

  it('renders an error row and surfaces the failed count', () => {
    const out = captureLog(() =>
      printReport(
        makeReport({
          assets: [makeAsset(), makeAsset({ inputPath: '/a/broken.jpg', error: 'corrupt image' })],
          errorCount: 1,
        }),
        'optimize',
      ),
    );
    expect(out).toContain('✖ corrupt image');
    expect(out).toContain('1 failed');
  });

  it('pluralizes the file count', () => {
    const out = captureLog(() =>
      printReport(
        makeReport({
          assets: [makeAsset(), makeAsset({ inputPath: '/a/b.css', assetType: 'css' })],
        }),
        'optimize',
      ),
    );
    expect(out).toContain('2 files');
  });
});
