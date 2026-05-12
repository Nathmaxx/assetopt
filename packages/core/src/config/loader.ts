import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { configSchema, type Config } from './schema.js';
import { PRESETS } from './presets.js';
import { IMAGE_DEFAULTS } from '../optimizers/images.js';
import { CSS_DEFAULTS } from '../optimizers/css.js';
import { JS_DEFAULTS } from '../optimizers/js.js';
import { SVG_DEFAULTS } from '../optimizers/svg.js';

const CONFIG_FILENAMES = ['.assetoptrc', '.assetoptrc.json'];

export const DEFAULTS: Config = {
  images: IMAGE_DEFAULTS,
  css: CSS_DEFAULTS,
  js: JS_DEFAULTS,
  svg: SVG_DEFAULTS,
  output: { dir: './optimized' },
};

/**
 * Result of {@link loadConfig}: the resolved config plus the absolute path of
 * the `.assetoptrc` it came from, or `null` if no config file was found and
 * `DEFAULTS` are being used. Callers (CLI) use `source` to surface a clear
 * indicator about whether the user's config took effect.
 */
export interface LoadedConfig {
  config: Config;
  source: string | null;
}

async function findConfigFile(startDir: string): Promise<string | null> {
  let dir = startDir;
  while (true) {
    for (const filename of CONFIG_FILENAMES) {
      const candidate = resolve(dir, filename);
      try {
        await readFile(candidate, 'utf-8');
        return candidate;
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
      }
    }
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/**
 * Walks up from `cwd` (default `process.cwd()`) looking for `.assetoptrc` or
 * `.assetoptrc.json`. Returns the resolved config plus the absolute path it
 * was loaded from, or `DEFAULTS` with `source: null` if nothing was found.
 */
export async function loadConfig(cwd = process.cwd()): Promise<LoadedConfig> {
  const filePath = await findConfigFile(cwd);
  if (filePath === null) return { config: DEFAULTS, source: null };

  const raw = await readFile(filePath, 'utf-8');
  try {
    const parsed = configSchema.parse(JSON.parse(raw));
    return { config: resolveConfig(parsed), source: filePath };
  } catch (err) {
    throw new Error(
      `Invalid ${filePath}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export function resolveConfig(userConfig: Config): Config {
  const presetConfig = userConfig.preset ? PRESETS[userConfig.preset] : {};
  return mergeConfig(mergeConfig(DEFAULTS, presetConfig), userConfig);
}

export function mergeConfig(base: Config, override: Partial<Config>): Config {
  const baseMatrix = base.images?.formatMatrix;
  const overrideMatrix = override.images?.formatMatrix;
  const mergedMatrix =
    baseMatrix || overrideMatrix ? { ...baseMatrix, ...overrideMatrix } : undefined;

  return {
    ...base,
    ...override,
    images: {
      ...base.images,
      ...override.images,
      quality: { ...base.images?.quality, ...override.images?.quality },
      ...(mergedMatrix && { formatMatrix: mergedMatrix }),
    },
    css: { ...base.css, ...override.css },
    js: { ...base.js, ...override.js },
    svg: { ...base.svg, ...override.svg },
    output: { ...base.output, ...override.output },
  };
}
