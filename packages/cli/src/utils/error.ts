import pc from 'picocolors';
import type { OptimizeResult } from '@assetopt/core';

export function handleCliError(err: unknown): never {
  console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}

/**
 * Exit 1 when the pipeline reported per-asset failures. The message goes to
 * stderr so `--json` output on stdout stays parseable.
 */
export function exitOnAssetErrors(report: OptimizeResult): void {
  if (report.errorCount > 0) {
    console.error(
      pc.red(`✖ ${report.errorCount} asset${report.errorCount > 1 ? 's' : ''} failed to process`),
    );
    process.exit(1);
  }
}
