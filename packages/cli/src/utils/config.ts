import { resolve } from 'node:path';
import type { AssetoptConfig } from '@assetopt/core';

/** Commander collector for repeatable flags (`--exclude a --exclude b`). */
export function collect(value: string, previous: string[]): string[] {
  return [...previous, value];
}

/**
 * Apply CLI flag overrides on top of the loaded config:
 * - `-o/--output` replaces `output.dir` (resolved from the current cwd);
 * - `--exclude` globs are appended to `input.exclude`, so the config's own
 *   excludes keep applying.
 */
export function applyCliOverrides(
  config: AssetoptConfig,
  flags: { output?: string; exclude?: string[] },
): AssetoptConfig {
  let effective = config;
  if (flags.output !== undefined) {
    effective = {
      ...effective,
      output: { ...effective.output, dir: resolve(process.cwd(), flags.output) },
    };
  }
  if (flags.exclude !== undefined && flags.exclude.length > 0) {
    effective = {
      ...effective,
      input: {
        ...effective.input,
        exclude: [...(effective.input?.exclude ?? []), ...flags.exclude],
      },
    };
  }
  return effective;
}
