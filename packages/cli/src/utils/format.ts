import { basename } from 'node:path';
import pc from 'picocolors';
import type { OptimizeResult, AssetResult, AssetType } from '@assetopt/core';

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export const TYPE_COLOR: Partial<Record<AssetType, (s: string) => string>> = {
  image: pc.cyan,
  css: pc.yellow,
  js: pc.green,
  svg: pc.magenta,
};

export function colorType(type: AssetType, padTo = 5): string {
  return (TYPE_COLOR[type] ?? pc.white)(type.padEnd(padTo));
}

function formatAssetRow(asset: AssetResult): string {
  const name = basename(asset.inputPath).padEnd(30);
  const inputStr = formatBytes(asset.inputSize).padStart(10);
  const outputStr = formatBytes(asset.outputSize).padStart(10);
  const savedStr = `${asset.savedPercent > 0 ? '-' : '+'}${Math.abs(asset.savedPercent).toFixed(1)}%`.padStart(8);

  const colorOutput =
    asset.outputSize < asset.inputSize
      ? pc.green(outputStr)
      : asset.outputSize > asset.inputSize
        ? pc.red(outputStr)
        : outputStr;
  const colorSaved =
    asset.savedPercent > 0
      ? pc.green(savedStr)
      : asset.savedPercent < 0
        ? pc.red(savedStr)
        : pc.dim(savedStr);

  const suffix = asset.cached ? `  ${pc.dim('(cached)')}` : '';
  return `  ${colorType(asset.assetType)}  ${name}  ${pc.dim(inputStr)} → ${colorOutput}  ${colorSaved}${suffix}`;
}

export function printProgress(current: number, total: number, filePath: string): void {
  if (!process.stdout.isTTY) return;
  process.stdout.write(`\r\x1b[K  ${pc.dim(`[${current}/${total}]`)} ${basename(filePath)}`);
}

export function clearProgress(): void {
  if (!process.stdout.isTTY) return;
  process.stdout.write('\r\x1b[K');
}

export function printConfigSource(source: string | null): void {
  if (source === null) {
    console.log(`${pc.yellow('⚠')} ${pc.dim('no .assetoptrc found, using defaults')}`);
  } else {
    console.log(`${pc.green('✓')} ${pc.dim(`config loaded from ${source}`)}`);
  }
}

export interface AuditRow {
  filePath: string;
  type: AssetType;
  size: number;
  issues: string[];
}

export function formatAuditRow(row: AuditRow): string {
  const icon = row.issues.length > 0 ? pc.red('✖') : pc.green('✓');
  const name = basename(row.filePath).padEnd(30);
  const sizeStr = formatBytes(row.size).padStart(10);
  const base = `  ${icon}  ${colorType(row.type)}  ${name}  ${pc.dim(sizeStr)}`;
  return row.issues.length > 0 ? `${base}  ${pc.yellow(row.issues.join(' · '))}` : base;
}

export function printReport(report: OptimizeResult, mode: 'analyze' | 'optimize'): void {
  if (report.assets.length === 0) {
    console.log(pc.yellow('No supported assets found.'));
    return;
  }

  const verb = mode === 'analyze' ? 'Would save' : 'Saved';
  const count = `${report.assets.length} file${report.assets.length > 1 ? 's' : ''}`;
  const savedStr = `${formatBytes(report.totalSavedBytes)} (${report.totalSavedPercent.toFixed(1)}%)`;

  console.log('');
  for (const asset of report.assets) {
    console.log(formatAssetRow(asset));
  }
  console.log('');
  const cachedStr =
    report.cachedCount > 0 ? ` · ${pc.dim(`${report.cachedCount} cached`)}` : '';

  console.log(
    `  ${pc.bold(count)} · ` +
      `${pc.dim(formatBytes(report.totalInputSize))} → ${pc.bold(formatBytes(report.totalOutputSize))} · ` +
      `${verb} ${pc.bold(pc.green(savedStr))}${cachedStr} · ` +
      `${pc.dim(formatDuration(report.durationMs))}`,
  );
  console.log('');
}
