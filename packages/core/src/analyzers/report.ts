import type { AssetResult, OptimizeResult } from '../types/index.js';
import { computeSavedPercent } from '../utils/savings.js';

export function buildReport(assets: AssetResult[], durationMs: number): OptimizeResult {
  const totalInputSize = assets.reduce((sum, a) => sum + a.inputSize, 0);
  const totalOutputSize = assets.reduce((sum, a) => sum + a.outputSize, 0);
  const totalSavedBytes = totalInputSize - totalOutputSize;
  const cachedCount = assets.reduce((n, a) => n + (a.cached ? 1 : 0), 0);
  const errorCount = assets.reduce((n, a) => n + (a.error !== undefined ? 1 : 0), 0);

  return {
    assets,
    totalInputSize,
    totalOutputSize,
    totalSavedBytes,
    totalSavedPercent: computeSavedPercent(totalSavedBytes, totalInputSize),
    durationMs,
    cachedCount,
    errorCount,
  };
}
