import path from 'node:path';
import { availableParallelism } from 'node:os';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  scanDirectory,
  readBuffer,
  writeBuffer,
  getImageSourceFormat,
  getAssetType,
} from '../utils/fs.js';
import { computeSavedPercent } from '../utils/savings.js';
import { mapWithConcurrency } from '../utils/concurrency.js';
import { dispatch } from './dispatch.js';
import {
  computeCacheKey,
  readManifest,
  writeManifest,
  toPosixPath,
  CACHE_FILE,
  type Manifest,
} from '../cache/manifest.js';
import type { AssetoptConfig, AssetResult } from '../types/index.js';

// Walk up from this module looking for the @assetopt/core package.json so the
// version resolves correctly both in dev (src/) and in the bundled dist/.
function findCoreVersion(): string {
  let dir = path.dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 10; i++) {
    const candidate = path.join(dir, 'package.json');
    try {
      const pkg = JSON.parse(readFileSync(candidate, 'utf-8')) as {
        name?: string;
        version?: string;
      };
      if (pkg.name === '@assetopt/core' && pkg.version) return pkg.version;
    } catch {
      // not found at this level, keep walking
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return '0.0.0-unknown';
}

const CORE_VERSION = findCoreVersion();

const FORMAT_TO_EXT: Record<string, string> = {
  jpeg: '.jpg',
  png: '.png',
  webp: '.webp',
  avif: '.avif',
};

function resolveOutputPath(
  inputPath: string,
  inputDir: string,
  outputDir: string,
  newExt?: string,
): string {
  const relative = path.relative(inputDir, inputPath);
  const ext = path.extname(relative);
  const renamed = newExt && newExt !== ext ? relative.slice(0, -ext.length) + newExt : relative;
  return path.resolve(outputDir, renamed);
}

// Cache key is derived from the full config minus output.dir and input
// (include/exclude select *which* files run, not what their optimized bytes
// look like). Everything else (preset, matrix, quality, skip…) influences
// the optimized bytes and must invalidate.
function configForHash(config: AssetoptConfig): unknown {
  const { output: _output, input: _input, ...rest } = config;
  return rest;
}

// Product decision (ROADMAP P1.1): the free tier runs a bounded in-process
// pool capped at 4. Sharp/esbuild/lightningcss do their work off the JS
// thread, so this alone gives a near-linear win on big folders; uncapped
// concurrency (and true worker threads) stays available as a Pro lever.
const FREE_CONCURRENCY_CAP = 4;

function resolveConcurrency(requested?: number): number {
  if (requested === undefined)
    return Math.max(1, Math.min(availableParallelism(), FREE_CONCURRENCY_CAP));
  return Math.max(1, Math.min(Math.floor(requested), FREE_CONCURRENCY_CAP));
}

// Two sources can resolve to the same output path once format conversion
// renames extensions (photo.jpg and photo.png both → photo.webp). Claiming
// throws instead of letting the second write silently clobber the first;
// the per-file error handling turns that into an errored AssetResult.
// Check-and-set is synchronous, so concurrent tasks cannot both win — but
// under concurrency "first" means first to claim, not first in scan order.
function claimOutputPath(
  claimed: Map<string, string>,
  outputPath: string,
  inputPath: string,
): void {
  const existing = claimed.get(outputPath);
  if (existing !== undefined) {
    throw new Error(
      `output path collision: ${outputPath} is already produced by ${existing} — ` +
        `rename one of the sources or adjust the format conversion`,
    );
  }
  claimed.set(outputPath, inputPath);
}

export async function runPipeline(
  inputDir: string,
  config: AssetoptConfig = {},
  options: {
    dryRun?: boolean;
    useCache?: boolean;
    /** Max assets processed at once, clamped to 1–4 (default `min(cores, 4)`). */
    concurrency?: number;
    onProgress?: (current: number, total: number, filePath: string) => void;
  } = {},
): Promise<AssetResult[]> {
  const { dryRun = false, useCache = true, onProgress } = options;
  const concurrency = resolveConcurrency(options.concurrency);
  const outputDir = config.output?.dir ?? './optimized';
  const forceReencode = config.output?.forceReencode ?? false;
  const skip = new Set(config.images?.skip ?? []);
  const manifestPath = path.resolve(outputDir, CACHE_FILE);
  const hashableConfig = configForHash(config);
  const manifest: Manifest = useCache ? await readManifest(manifestPath) : {};

  // Never re-scan our own output as a source (optimize . + output.dir inside
  // the input dir would otherwise re-optimize the previous run's results).
  const allFiles = await scanDirectory(inputDir, {
    excludePaths: [path.resolve(outputDir)],
    include: config.input?.include,
    exclude: config.input?.exclude,
  });
  const files = allFiles.filter((filePath) => {
    const sourceFormat = getImageSourceFormat(filePath);
    return sourceFormat === null || !skip.has(sourceFormat);
  });

  const claimedOutputs = new Map<string, string>();

  // Bounded pool: up to `concurrency` files in flight. The pool starts files
  // in scan order (so onProgress stays monotonic) and returns results in scan
  // order (indexed array) — only completions interleave. Shared state
  // (manifest, claimedOutputs) is only touched synchronously, so no locking.
  const settled = await mapWithConcurrency(files, concurrency, async (filePath, i) => {
    onProgress?.(i + 1, files.length, filePath);

    const start = Date.now();
    // scanDirectory only returns supported extensions, so this cannot be null.
    const assetType = getAssetType(filePath);
    if (assetType === null) return null;

    let inputSize = 0;
    try {
      const buffer = await readBuffer(filePath);
      inputSize = buffer.length;
      const cacheKey = useCache ? computeCacheKey(buffer, hashableConfig, CORE_VERSION) : null;

      if (cacheKey !== null) {
        const entry = manifest[cacheKey];
        if (entry) {
          const absoluteOutputPath = path.resolve(outputDir, entry.outputPath);
          if (existsSync(absoluteOutputPath)) {
            claimOutputPath(claimedOutputs, absoluteOutputPath, filePath);
            const savedBytes = entry.inputSize - entry.outputSize;
            return {
              inputPath: filePath,
              outputPath: absoluteOutputPath,
              inputSize: entry.inputSize,
              outputSize: entry.outputSize,
              savedBytes,
              savedPercent: computeSavedPercent(savedBytes, entry.inputSize),
              assetType,
              durationMs: Date.now() - start,
              cached: true,
            };
          }
        }
      }

      const dispatched = await dispatch(filePath, buffer, config);
      const newExt =
        dispatched.assetType === 'image' ? FORMAT_TO_EXT[dispatched.format] : undefined;

      // "Larger output" guard (ROADMAP P1.3): unless forceReencode is set, when
      // the optimized bytes are not smaller AND we are not converting format,
      // keep the source bytes verbatim (0 % savings) rather than writing a
      // bigger file. A format conversion that grows the file is intentional
      // (a bigger .webp than the .jpg source can still be the goal) and is
      // always kept — hence the `!formatChanged` condition.
      const formatChanged =
        dispatched.assetType === 'image' && dispatched.format !== getImageSourceFormat(filePath);
      const keepSource =
        !forceReencode && !formatChanged && dispatched.outputSize >= dispatched.originalSize;
      const outputBuffer = keepSource ? buffer : dispatched.buffer;
      const outputSize = keepSource ? dispatched.originalSize : dispatched.outputSize;

      const outputPath = resolveOutputPath(filePath, inputDir, outputDir, newExt);
      claimOutputPath(claimedOutputs, outputPath, filePath);

      if (!dryRun) {
        await writeBuffer(outputPath, outputBuffer);
      }

      if (cacheKey !== null && !dryRun) {
        manifest[cacheKey] = {
          inputSize: dispatched.originalSize,
          outputSize,
          outputPath: toPosixPath(path.relative(outputDir, outputPath)),
          outputFormat: dispatched.assetType === 'image' ? dispatched.format : undefined,
          timestamp: Date.now(),
        };
      }

      const savedBytes = dispatched.originalSize - outputSize;

      return {
        inputPath: filePath,
        outputPath,
        inputSize: dispatched.originalSize,
        outputSize,
        savedBytes,
        savedPercent: computeSavedPercent(savedBytes, dispatched.originalSize),
        assetType: dispatched.assetType,
        durationMs: Date.now() - start,
        cached: false,
      };
    } catch (err) {
      // One corrupt or conflicting file must not abort the whole run (nor
      // discard the manifest entries of files already processed).
      return {
        inputPath: filePath,
        outputPath: resolveOutputPath(filePath, inputDir, outputDir),
        inputSize,
        outputSize: inputSize,
        savedBytes: 0,
        savedPercent: 0,
        assetType,
        durationMs: Date.now() - start,
        cached: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  });

  const results = settled.filter((r): r is AssetResult => r !== null);

  if (useCache && !dryRun) {
    await writeManifest(manifestPath, manifest);
  }

  return results;
}
