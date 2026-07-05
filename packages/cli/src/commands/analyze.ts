import { resolve } from 'node:path';
import type { Command } from 'commander';
import { loadConfig, runPipeline, buildReport } from '@assetopt/core';
import { printReport, printProgress, clearProgress, printConfigSource } from '../utils/format.js';
import { handleCliError, exitOnAssetErrors } from '../utils/error.js';
import { enforceMinSavings } from '../utils/threshold.js';
import { applyCliOverrides, collect } from '../utils/config.js';

interface AnalyzeCommandOptions {
  json?: boolean;
  minSavings?: string;
  cache?: boolean;
  output?: string;
  exclude: string[];
}

export function registerAnalyze(program: Command): void {
  program
    .command('analyze [dir]')
    .description('Analyze assets and report potential savings without modifying files')
    .option(
      '-o, --output <dir>',
      'output directory used for cache lookup (overrides output.dir from config)',
    )
    .option(
      '--exclude <glob>',
      'skip files matching this glob (repeatable, adds to config)',
      collect,
      [],
    )
    .option('--json', 'output report as JSON instead of terminal format')
    .option('--min-savings <percent>', 'fail (exit 1) if total savings are below this percent')
    .option('--no-cache', 'bypass the incremental cache (re-analyze every asset from scratch)')
    .action(async (dir: string = '.', options: AnalyzeCommandOptions) => {
      const cwd = resolve(process.cwd(), dir);

      try {
        const { config, source } = await loadConfig();
        const effectiveConfig = applyCliOverrides(config, options);

        if (!options.json) {
          printConfigSource(source);
          console.log(`Analyzing ${cwd}...`);
        }

        const start = Date.now();
        const assets = await runPipeline(cwd, effectiveConfig, {
          dryRun: true,
          useCache: options.cache !== false,
          onProgress: options.json ? undefined : printProgress,
        });
        clearProgress();
        const report = buildReport(assets, Date.now() - start);

        if (options.json) {
          console.log(JSON.stringify(report, null, 2));
        } else {
          printReport(report, 'analyze');
        }

        exitOnAssetErrors(report);

        if (options.minSavings !== undefined) {
          enforceMinSavings(report, options.minSavings);
        }
      } catch (err) {
        handleCliError(err);
      }
    });
}
