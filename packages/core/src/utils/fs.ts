import { readdir, stat, readFile, writeFile, mkdir } from 'node:fs/promises';
import { extname, resolve, dirname } from 'node:path';
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

export async function scanDirectory(dirPath: string, recursive = true): Promise<string[]> {
  const entries = await readdir(dirPath, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = resolve(dirPath, entry.name);
    if (entry.isDirectory() && recursive) {
      files.push(...(await scanDirectory(fullPath, recursive)));
    } else if (entry.isFile() && getAssetType(fullPath) !== null) {
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
