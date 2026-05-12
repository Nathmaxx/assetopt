import pc from 'picocolors';
import type { OptimizeResult } from '@assetopt/core';

export function parseThreshold(raw: string): number {
  const n = parseFloat(raw);
  if (!Number.isFinite(n) || n < 0 || n > 100) {
    throw new Error(`Invalid --min-savings value: "${raw}" (expected a number between 0 and 100)`);
  }
  return n;
}

export function enforceMinSavings(report: OptimizeResult, raw: string): void {
  const threshold = parseThreshold(raw);
  if (report.totalSavedPercent < threshold) {
    console.error(
      pc.red(
        `✖ Total savings ${report.totalSavedPercent.toFixed(1)}% below threshold of ${threshold}%`,
      ),
    );
    process.exit(1);
  }
}
