import { describe, it, expect, vi, afterEach } from 'vitest';
import { parseThreshold, enforceMinSavings } from '../threshold.js';
import type { OptimizeResult } from '@assetopt/core';

function makeReport(totalSavedPercent: number): OptimizeResult {
  return {
    assets: [],
    totalInputSize: 100,
    totalOutputSize: 100 - totalSavedPercent,
    totalSavedBytes: totalSavedPercent,
    totalSavedPercent,
    durationMs: 1,
    cachedCount: 0,
  };
}

describe('parseThreshold', () => {
  it('parses integers and decimals', () => {
    expect(parseThreshold('10')).toBe(10);
    expect(parseThreshold('50.5')).toBe(50.5);
  });

  it('accepts the boundaries 0 and 100', () => {
    expect(parseThreshold('0')).toBe(0);
    expect(parseThreshold('100')).toBe(100);
  });

  it('rejects non-numeric input', () => {
    expect(() => parseThreshold('abc')).toThrow(/Invalid --min-savings/);
    expect(() => parseThreshold('')).toThrow(/Invalid --min-savings/);
  });

  it('rejects values outside 0–100', () => {
    expect(() => parseThreshold('-1')).toThrow(/between 0 and 100/);
    expect(() => parseThreshold('101')).toThrow(/between 0 and 100/);
  });
});

describe('enforceMinSavings', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does nothing when savings meet or exceed the threshold', () => {
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
    const err = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    enforceMinSavings(makeReport(25), '20');
    enforceMinSavings(makeReport(20), '20'); // exactly at threshold passes

    expect(exit).not.toHaveBeenCalled();
    expect(err).not.toHaveBeenCalled();
  });

  it('reports an error and exits with code 1 when below the threshold', () => {
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
    const err = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    enforceMinSavings(makeReport(5), '20');

    expect(exit).toHaveBeenCalledWith(1);
    expect(err).toHaveBeenCalledOnce();
    expect(err.mock.calls[0][0]).toContain('below threshold');
  });

  it('throws (does not exit) when the threshold value itself is invalid', () => {
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);

    expect(() => enforceMinSavings(makeReport(50), 'nope')).toThrow(/Invalid --min-savings/);
    expect(exit).not.toHaveBeenCalled();
  });
});
