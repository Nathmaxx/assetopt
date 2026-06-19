import { resolve } from 'node:path';
import type { Command } from 'commander';
import { loadConfig, runPipeline, buildReport } from '@assetopt/core';
import { printReport, printProgress, clearProgress, printConfigSource } from '../utils/format.js';
import { handleCliError } from '../utils/error.js';
import { enforceMinSavings } from '../utils/threshold.js';

interface AnalyzeCommandOptions {
  minSavings?: string;
  cache?: boolean;
  output?: string;
}

export function registerAnalyze(program: Command): void {
  program
    .command('analyze [dir]')
    .description('Analyze assets and report potential savings without modifying files')
    .option(
      '-o, --output <dir>',
      'output directory used for cache lookup (overrides output.dir from config)',
    )
    .option('--min-savings <percent>', 'fail (exit 1) if total savings are below this percent')
    .option('--no-cache', 'bypass the incremental cache (re-analyze every asset from scratch)')
    .action(async (dir: string = '.', options: AnalyzeCommandOptions) => {
      const cwd = resolve(process.cwd(), dir);

      try {
        const { config, source } = await loadConfig();
        const effectiveConfig = options.output
          ? { ...config, output: { ...config.output, dir: resolve(process.cwd(), options.output) } }
          : config;
        printConfigSource(source);
        console.log(`Analyzing ${cwd}...`);

        const start = Date.now();
        const assets = await runPipeline(cwd, effectiveConfig, {
          dryRun: true,
          useCache: options.cache !== false,
          onProgress: printProgress,
        });
        clearProgress();
        const report = buildReport(assets, Date.now() - start);

        printReport(report, 'analyze');

        if (options.minSavings !== undefined) {
          enforceMinSavings(report, options.minSavings);
        }
      } catch (err) {
        handleCliError(err);
      }
    });
}
