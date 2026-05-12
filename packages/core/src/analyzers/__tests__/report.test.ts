import { describe, it, expect } from 'vitest';
import { buildReport } from '../report.js';
import type { AssetResult } from '../../types/index.js';

function makeAsset(overrides: Partial<AssetResult> = {}): AssetResult {
  return {
    inputPath: '/src/file.jpg',
    outputPath: '/out/file.jpg',
    inputSize: 1000,
    outputSize: 600,
    savedBytes: 400,
    savedPercent: 40,
    assetType: 'image',
    durationMs: 10,
    cached: false,
    ...overrides,
  };
}

describe('buildReport', () => {
  it('sums totalInputSize', () => {
    const result = buildReport([makeAsset({ inputSize: 1000 }), makeAsset({ inputSize: 2000 })], 0);
    expect(result.totalInputSize).toBe(3000);
  });

  it('sums totalOutputSize', () => {
    const result = buildReport([makeAsset({ outputSize: 600 }), makeAsset({ outputSize: 800 })], 0);
    expect(result.totalOutputSize).toBe(1400);
  });

  it('computes totalSavedBytes', () => {
    const result = buildReport(
      [makeAsset({ inputSize: 1000, outputSize: 600 }), makeAsset({ inputSize: 500, outputSize: 400 })],
      0,
    );
    expect(result.totalSavedBytes).toBe(500);
  });

  it('computes totalSavedPercent with 2 decimal places', () => {
    const result = buildReport([makeAsset({ inputSize: 1000, outputSize: 750 })], 0);
    expect(result.totalSavedPercent).toBe(25);
  });

  it('rounds totalSavedPercent to 2 decimal places', () => {
    const result = buildReport([makeAsset({ inputSize: 3000, outputSize: 2000 })], 0);
    expect(result.totalSavedPercent).toBe(33.33);
  });

  it('returns 0 for totalSavedPercent when input is empty', () => {
    const result = buildReport([], 0);
    expect(result.totalSavedPercent).toBe(0);
  });

  it('passes durationMs through', () => {
    const result = buildReport([], 456);
    expect(result.durationMs).toBe(456);
  });

  it('includes assets array as-is', () => {
    const assets = [makeAsset(), makeAsset()];
    const result = buildReport(assets, 0);
    expect(result.assets).toBe(assets);
  });

  it('returns zeros for all totals on empty input', () => {
    const result = buildReport([], 0);
    expect(result.totalInputSize).toBe(0);
    expect(result.totalOutputSize).toBe(0);
    expect(result.totalSavedBytes).toBe(0);
  });

  it('counts cached assets', () => {
    const result = buildReport(
      [
        makeAsset({ cached: true }),
        makeAsset({ cached: true }),
        makeAsset({ cached: false }),
      ],
      0,
    );
    expect(result.cachedCount).toBe(2);
  });

  it('cachedCount is 0 when no asset is cached', () => {
    const result = buildReport([makeAsset(), makeAsset()], 0);
    expect(result.cachedCount).toBe(0);
  });

  it('cachedCount is 0 on empty input', () => {
    const result = buildReport([], 0);
    expect(result.cachedCount).toBe(0);
  });
});
