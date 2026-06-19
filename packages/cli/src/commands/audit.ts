import { resolve } from 'node:path';
import type { Command } from 'commander';
import pc from 'picocolors';
import { loadConfig, scanDirectory, getAssetType, getFileSize, runPipeline } from '@assetopt/core';
import type { AssetType, AssetoptConfig } from '@assetopt/core';
import {
  formatBytes,
  formatDuration,
  formatAuditRow,
  printProgress,
  clearProgress,
  printConfigSource,
} from '../utils/format.js';
import { handleCliError } from '../utils/error.js';

const SIZE_THRESHOLDS: Partial<Record<AssetType, number>> = {
  image: 500 * 1024,
  js: 100 * 1024,
  css: 50 * 1024,
  svg: 50 * 1024,
};

export function registerAudit(program: Command): void {
  program
    .command('audit [dir]')
    .description('Identify problematic assets with optimization recommendations')
    .option('--threshold <percent>', 'minimum savings % to flag a file (requires --savings)', '10')
    .option('--savings', 'compute potential savings for each file (slower)')
    .action(async (dir: string = '.', options: { threshold: string; savings?: boolean }) => {
      const cwd = resolve(process.cwd(), dir);
      const minSavings = parseFloat(options.threshold);

      try {
        const { config, source } = await loadConfig();
        printConfigSource(source);
        console.log(`Auditing ${cwd}...`);
        const start = Date.now();

        if (options.savings) {
          await runFullAudit(cwd, config, minSavings, start);
        } else {
          await runFastAudit(cwd, start);
        }
      } catch (err) {
        handleCliError(err);
      }
    });
}

async function runFastAudit(cwd: string, start: number): Promise<void> {
  const files = await scanDirectory(cwd);

  if (files.length === 0) {
    console.log(pc.yellow('No supported assets found.'));
    return;
  }

  const rows = await Promise.all(
    files.map(async (filePath) => {
      const type = getAssetType(filePath) as AssetType;
      const size = await getFileSize(filePath);
      const threshold = SIZE_THRESHOLDS[type];
      const issues =
        threshold !== undefined && size > threshold
          ? [`oversized (${formatBytes(size)} > ${formatBytes(threshold)})`]
          : [];
      return { filePath, type, size, issues };
    }),
  );

  printAuditResults(rows, start);
}

async function runFullAudit(
  cwd: string,
  config: AssetoptConfig,
  minSavings: number,
  start: number,
): Promise<void> {
  const assets = await runPipeline(cwd, config, {
    dryRun: true,
    onProgress: printProgress,
  });
  clearProgress();

  if (assets.length === 0) {
    console.log(pc.yellow('No supported assets found.'));
    return;
  }

  const rows = assets.map((asset) => {
    const issues: string[] = [];
    const threshold = SIZE_THRESHOLDS[asset.assetType];

    if (threshold !== undefined && asset.inputSize > threshold) {
      issues.push(`oversized (${formatBytes(asset.inputSize)} > ${formatBytes(threshold)})`);
    }
    if (asset.savedPercent >= minSavings) {
      issues.push(
        `would save ${formatBytes(asset.savedBytes)} (-${asset.savedPercent.toFixed(1)}%)`,
      );
    }

    return { filePath: asset.inputPath, type: asset.assetType, size: asset.inputSize, issues };
  });

  printAuditResults(rows, start);
}

function printAuditResults(
  rows: { filePath: string; type: AssetType; size: number; issues: string[] }[],
  start: number,
): void {
  const flagged = rows.filter((r) => r.issues.length > 0).length;
  const clean = rows.length - flagged;
  const duration = Date.now() - start;

  console.log('');
  for (const row of rows) {
    console.log(formatAuditRow(row));
  }
  console.log('');
  printSummary(flagged, clean, duration);

  if (flagged > 0) process.exit(1);
}

function printSummary(flaggedCount: number, clean: number, duration: number): void {
  if (flaggedCount === 0) {
    console.log(
      `  ${pc.green(pc.bold('All good!'))} ${pc.dim(`${clean + flaggedCount} files checked · ${formatDuration(duration)}`)}`,
    );
  } else {
    const issueLabel = pc.red(pc.bold(`${flaggedCount} issue${flaggedCount > 1 ? 's' : ''} found`));
    const cleanLabel = pc.dim(`${clean} file${clean !== 1 ? 's' : ''} clean`);
    console.log(`  ${issueLabel} · ${cleanLabel} · ${pc.dim(formatDuration(duration))}`);
  }
  console.log('');
}
