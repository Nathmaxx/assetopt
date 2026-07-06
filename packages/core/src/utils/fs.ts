import { readdir, stat, readFile, writeFile, mkdir } from 'node:fs/promises';
import { extname, resolve, dirname, relative, sep } from 'node:path';
import picomatch from 'picomatch';
import type { AssetType, ImageSourceFormat } from '../types/index.js';

const EXTENSION_TO_TYPE: Record<string, AssetType> = {
  '.jpg': 'image',
  '.jpeg': 'image',
  '.png': 'image',
  '.webp': 'image',
  '.avif': 'image',
  '.css': 'css',
  '.js': 'js',
  '.mjs': 'js',
  '.svg': 'svg',
};

const EXTENSION_TO_IMAGE_FORMAT: Record<string, ImageSourceFormat> = {
  '.jpg': 'jpeg',
  '.jpeg': 'jpeg',
  '.png': 'png',
  '.webp': 'webp',
  '.avif': 'avif',
};

export function getAssetType(filePath: string): AssetType | null {
  return EXTENSION_TO_TYPE[extname(filePath).toLowerCase()] ?? null;
}

export function getImageSourceFormat(filePath: string): ImageSourceFormat | null {
  return EXTENSION_TO_IMAGE_FORMAT[extname(filePath).toLowerCase()] ?? null;
}

export interface ScanOptions {
  /** Recurse into subdirectories (default `true`). */
  recursive?: boolean;
  /**
   * Directory paths to skip entirely (resolved to absolute before comparison).
   * The pipeline passes its resolved `output.dir` here so a previous run's
   * output is never re-scanned as a source.
   */
  excludePaths?: string[];
  /**
   * Glob patterns matched against each file's path *relative to the scanned
   * directory* (posix separators, dotfiles matchable). When non-empty, only
   * matching files are kept. Typically `config.input.include`.
   */
  include?: string[];
  /**
   * Glob patterns (same matching rules as `include`); a file matching any
   * pattern is skipped, after `include` is applied. Typically
   * `config.input.exclude` merged with the CLI `--exclude` flags.
   */
  exclude?: string[];
}

// Directories that are never sources of user assets, whatever the project.
const ALWAYS_EXCLUDED_DIRS: ReadonlySet<string> = new Set(['node_modules']);

/**
 * Recursively list supported asset files under `dirPath`.
 *
 * Directories named `node_modules` and dot-directories (`.git`, `.cache`…)
 * are always skipped; `options.excludePaths` skips additional directories
 * (typically the resolved output dir). Filters apply to *children* only, so
 * scanning a hidden directory directly still works.
 */
export async function scanDirectory(dirPath: string, options: ScanOptions = {}): Promise<string[]> {
  const { recursive = true, excludePaths = [], include = [], exclude = [] } = options;
  const excluded = new Set(excludePaths.map((p) => resolve(p)));
  const root = resolve(dirPath);

  // dot: true so `**/*.css` also matches `.hidden.css` — dot-*directories*
  // are pruned during the walk anyway, this only concerns dotfiles.
  const isIncluded = include.length > 0 ? picomatch(include, { dot: true }) : null;
  const isExcluded = exclude.length > 0 ? picomatch(exclude, { dot: true }) : null;
  const keep =
    isIncluded === null && isExcluded === null
      ? null
      : (fullPath: string): boolean => {
          const rel = relative(root, fullPath).split(sep).join('/');
          if (isIncluded !== null && !isIncluded(rel)) return false;
          return isExcluded === null || !isExcluded(rel);
        };

  return scan(root, recursive, excluded, keep);
}

async function scan(
  dirPath: string,
  recursive: boolean,
  excluded: ReadonlySet<string>,
  keep: ((fullPath: string) => boolean) | null,
): Promise<string[]> {
  const entries = await readdir(dirPath, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = resolve(dirPath, entry.name);
    if (entry.isDirectory()) {
      if (!recursive) continue;
      if (entry.name.startsWith('.') || ALWAYS_EXCLUDED_DIRS.has(entry.name)) continue;
      if (excluded.has(fullPath)) continue;
      files.push(...(await scan(fullPath, recursive, excluded, keep)));
    } else if (entry.isFile() && getAssetType(fullPath) !== null) {
      if (keep !== null && !keep(fullPath)) continue;
      files.push(fullPath);
    }
  }

  return files;
}

export async function getFileSize(filePath: string): Promise<number> {
  const stats = await stat(filePath);
  return stats.size;
}

export async function ensureDir(dirPath: string): Promise<void> {
  await mkdir(dirPath, { recursive: true });
}

export async function readBuffer(filePath: string): Promise<Buffer> {
  return readFile(filePath);
}

export async function writeBuffer(filePath: string, data: Buffer): Promise<void> {
  await ensureDir(dirname(filePath));
  await writeFile(filePath, data);
}
