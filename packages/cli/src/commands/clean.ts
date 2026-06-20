import { rm, stat } from 'node:fs/promises';
import { resolve, relative, isAbsolute } from 'node:path';
import type { Command } from 'commander';
import { loadConfig, CACHE_FILE } from '@assetopt/core';
import { formatBytes } from '../utils/format.js';
import { handleCliError } from '../utils/error.js';

interface CleanCommandOptions {
  output?: string;
  all?: boolean;
  dryRun?: boolean;
}

/**
 * Resolve the output directory the same way the pipeline does: relative to the
 * current working directory (matching `path.resolve('./optimized', …)`), with a
 * `-o/--output` override taking precedence over `output.dir` from config.
 */
function resolveOutputDir(configDir: string | undefined, override: string | undefined): string {
  return resolve(process.cwd(), override ?? configDir ?? './optimized');
}

/** True when `cwd` is the target itself or lives inside it — removing it would nuke the project. */
function targetContainsCwd(target: string): boolean {
  const rel = relative(target, process.cwd());
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

export function registerClean(program: Command): void {
  program
    .command('clean')
    .description('Remove the incremental cache (or the whole output directory with --all)')
    .option('-o, --output <dir>', 'output directory to clean (overrides output.dir from config)')
    .option('--all', 'remove the entire output directory, not just the cache manifest')
    .option('--dry-run', 'print what would be removed without deleting anything')
    .action(async (options: CleanCommandOptions) => {
      try {
        const { config } = await loadConfig();
        const outputDir = resolveOutputDir(config.output?.dir, options.output);
        const target = options.all ? outputDir : resolve(outputDir, CACHE_FILE);
        const label = options.all ? `output directory ${target}` : `cache ${target}`;

        // Guard against catastrophic deletes (e.g. output.dir set to '.' or '..').
        if (options.all && targetContainsCwd(target)) {
          throw new Error(
            `refusing to remove ${target} — it is the current directory or a parent of it. ` +
              `Point output.dir (or -o) at a dedicated build folder.`,
          );
        }

        let info: { isFile: boolean; size: number } | null = null;
        try {
          const st = await stat(target);
          info = { isFile: st.isFile(), size: st.size };
        } catch (err) {
          if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
        }

        if (info === null) {
          console.log(`Nothing to clean — ${label} does not exist.`);
          return;
        }

        const freed = info.isFile ? ` (${formatBytes(info.size)})` : '';

        if (options.dryRun) {
          console.log(`Would remove ${label}${freed}.`);
          return;
        }

        await rm(target, { recursive: true, force: true });
        console.log(`Removed ${label}${freed}.`);
      } catch (err) {
        handleCliError(err);
      }
    });
}
