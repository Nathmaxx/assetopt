import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { existsSync } from 'node:fs';
import { runPipeline } from '../pipeline.js';

let tmpInput: string;
let jpegPath: string;
let cssPath: string;
let jsPath: string;
let svgPath: string;

beforeAll(async () => {
  tmpInput = await mkdtemp(path.join(tmpdir(), 'assetopt-test-'));

  const jpegBuffer = await sharp({
    create: { width: 100, height: 100, channels: 3, background: { r: 255, g: 100, b: 50 } },
  })
    .jpeg({ quality: 100 })
    .toBuffer();

  jpegPath = path.join(tmpInput, 'photo.jpg');
  cssPath = path.join(tmpInput, 'style.css');
  jsPath = path.join(tmpInput, 'app.js');
  svgPath = path.join(tmpInput, 'icon.svg');

  await writeFile(jpegPath, jpegBuffer);
  await writeFile(cssPath, '.container { display: flex;   padding: 16px; }');
  await writeFile(jsPath, 'function greet(name) { return "Hello " + name; }');
  await writeFile(
    svgPath,
    '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>',
  );
});

afterAll(async () => {
  await rm(tmpInput, { recursive: true, force: true });
});

describe('runPipeline', () => {
  describe('dry run (analyze mode)', () => {
    it('returns one result per supported file', async () => {
      const results = await runPipeline(tmpInput, {}, { dryRun: true });
      expect(results).toHaveLength(4);
    });

    it('reports correct asset types', async () => {
      const results = await runPipeline(tmpInput, {}, { dryRun: true });
      const types = results.map((r) => r.assetType).sort();
      expect(types).toEqual(['css', 'image', 'js', 'svg']);
    });

    it('does not write files to disk', async () => {
      const outputDir = path.join(tmpInput, 'optimized-dry');
      await runPipeline(tmpInput, { output: { dir: outputDir } }, { dryRun: true });
      expect(existsSync(outputDir)).toBe(false);
    });

    it('computes savedBytes correctly', async () => {
      const results = await runPipeline(tmpInput, {}, { dryRun: true });
      for (const result of results) {
        expect(result.savedBytes).toBe(result.inputSize - result.outputSize);
      }
    });

    it('computes savedPercent correctly', async () => {
      const results = await runPipeline(tmpInput, {}, { dryRun: true });
      for (const result of results) {
        const expected = Math.round((result.savedBytes / result.inputSize) * 10000) / 100;
        expect(result.savedPercent).toBe(expected);
      }
    });

    it('records durationMs > 0', async () => {
      const results = await runPipeline(tmpInput, {}, { dryRun: true });
      for (const result of results) {
        expect(result.durationMs).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('optimize mode', () => {
    let outputDir: string;

    beforeAll(async () => {
      outputDir = await mkdtemp(path.join(tmpdir(), 'assetopt-out-'));
      await runPipeline(tmpInput, { output: { dir: outputDir } });
    });

    afterAll(async () => {
      await rm(outputDir, { recursive: true, force: true });
    });

    it('writes output files to outDir', () => {
      expect(existsSync(path.join(outputDir, 'style.css'))).toBe(true);
      expect(existsSync(path.join(outputDir, 'app.js'))).toBe(true);
      expect(existsSync(path.join(outputDir, 'icon.svg'))).toBe(true);
    });

    it('renames image extension when format changes', async () => {
      const outputDir2 = await mkdtemp(path.join(tmpdir(), 'assetopt-webp-'));
      await runPipeline(tmpInput, {
        images: { outputFormat: 'webp' },
        output: { dir: outputDir2 },
      });
      expect(existsSync(path.join(outputDir2, 'photo.webp'))).toBe(true);
      await rm(outputDir2, { recursive: true, force: true });
    });
  });

  describe('skip by source format', () => {
    let skipInput: string;

    beforeAll(async () => {
      skipInput = await mkdtemp(path.join(tmpdir(), 'assetopt-skip-'));

      const jpegBuffer = await sharp({
        create: { width: 50, height: 50, channels: 3, background: { r: 200, g: 50, b: 50 } },
      })
        .jpeg({ quality: 100 })
        .toBuffer();
      const pngBuffer = await sharp({
        create: {
          width: 50,
          height: 50,
          channels: 4,
          background: { r: 0, g: 200, b: 100, alpha: 1 },
        },
      })
        .png()
        .toBuffer();

      await writeFile(path.join(skipInput, 'photo.jpg'), jpegBuffer);
      await writeFile(path.join(skipInput, 'logo.png'), pngBuffer);
      await writeFile(path.join(skipInput, 'style.css'), '.a { color: red; }');
    });

    afterAll(async () => {
      await rm(skipInput, { recursive: true, force: true });
    });

    it('omits skipped format entirely from results', async () => {
      const results = await runPipeline(
        skipInput,
        { images: { skip: ['jpeg'] } },
        { dryRun: true },
      );
      const inputs = results.map((r) => path.basename(r.inputPath)).sort();
      expect(inputs).toEqual(['logo.png', 'style.css']);
    });

    it('skips multiple formats at once', async () => {
      const results = await runPipeline(
        skipInput,
        { images: { skip: ['jpeg', 'png'] } },
        { dryRun: true },
      );
      const inputs = results.map((r) => path.basename(r.inputPath));
      expect(inputs).toEqual(['style.css']);
    });

    it('does not write skipped files to output dir', async () => {
      const outputDir = await mkdtemp(path.join(tmpdir(), 'assetopt-skip-out-'));
      await runPipeline(skipInput, {
        images: { skip: ['jpeg'] },
        output: { dir: outputDir },
      });
      expect(existsSync(path.join(outputDir, 'photo.jpg'))).toBe(false);
      expect(existsSync(path.join(outputDir, 'logo.png'))).toBe(true);
      await rm(outputDir, { recursive: true, force: true });
    });

    it('treats empty skip array as no-op', async () => {
      const results = await runPipeline(skipInput, { images: { skip: [] } }, { dryRun: true });
      expect(results).toHaveLength(3);
    });

    it('skipping an absent format is a no-op', async () => {
      const results = await runPipeline(
        skipInput,
        { images: { skip: ['avif'] } },
        { dryRun: true },
      );
      expect(results).toHaveLength(3);
    });

    it('does not affect non-image files', async () => {
      const results = await runPipeline(
        skipInput,
        { images: { skip: ['jpeg', 'png', 'webp', 'avif'] } },
        { dryRun: true },
      );
      const types = results.map((r) => r.assetType);
      expect(types).toEqual(['css']);
    });
  });

  describe('incremental cache', () => {
    let cacheInput: string;

    beforeAll(async () => {
      cacheInput = await mkdtemp(path.join(tmpdir(), 'assetopt-cache-in-'));
      const jpegBuffer = await sharp({
        create: { width: 50, height: 50, channels: 3, background: { r: 100, g: 200, b: 50 } },
      })
        .jpeg({ quality: 100 })
        .toBuffer();
      await writeFile(path.join(cacheInput, 'photo.jpg'), jpegBuffer);
      await writeFile(path.join(cacheInput, 'style.css'), '.x { color: blue; }');
    });

    afterAll(async () => {
      await rm(cacheInput, { recursive: true, force: true });
    });

    it('first run reports cached: false for every asset', async () => {
      const out = await mkdtemp(path.join(tmpdir(), 'assetopt-cache-out-'));
      const results = await runPipeline(cacheInput, { output: { dir: out } });
      expect(results.every((r) => r.cached === false)).toBe(true);
      await rm(out, { recursive: true, force: true });
    });

    it('writes a manifest file at outputDir/.assetopt-cache.json', async () => {
      const out = await mkdtemp(path.join(tmpdir(), 'assetopt-cache-out-'));
      await runPipeline(cacheInput, { output: { dir: out } });
      expect(existsSync(path.join(out, '.assetopt-cache.json'))).toBe(true);
      await rm(out, { recursive: true, force: true });
    });

    it('second run reports cached: true for unchanged files', async () => {
      const out = await mkdtemp(path.join(tmpdir(), 'assetopt-cache-out-'));
      await runPipeline(cacheInput, { output: { dir: out } });
      const second = await runPipeline(cacheInput, { output: { dir: out } });
      expect(second.every((r) => r.cached === true)).toBe(true);
      await rm(out, { recursive: true, force: true });
    });

    it('preserves output sizes from the original run on cache hit', async () => {
      const out = await mkdtemp(path.join(tmpdir(), 'assetopt-cache-out-'));
      const first = await runPipeline(cacheInput, { output: { dir: out } });
      const second = await runPipeline(cacheInput, { output: { dir: out } });
      const firstByPath = new Map(first.map((r) => [r.inputPath, r]));
      for (const r of second) {
        const f = firstByPath.get(r.inputPath)!;
        expect(r.outputSize).toBe(f.outputSize);
        expect(r.inputSize).toBe(f.inputSize);
      }
      await rm(out, { recursive: true, force: true });
    });

    it('invalidates cache when input buffer changes', async () => {
      const localInput = await mkdtemp(path.join(tmpdir(), 'assetopt-cache-mut-'));
      const out = await mkdtemp(path.join(tmpdir(), 'assetopt-cache-out-'));
      const cssPath = path.join(localInput, 'style.css');
      await writeFile(cssPath, '.x { color: red; }');
      await runPipeline(localInput, { output: { dir: out } });
      await writeFile(cssPath, '.x { color: green; padding: 8px; }');
      const second = await runPipeline(localInput, { output: { dir: out } });
      expect(second[0].cached).toBe(false);
      await rm(localInput, { recursive: true, force: true });
      await rm(out, { recursive: true, force: true });
    });

    it('invalidates cache when options change', async () => {
      const out = await mkdtemp(path.join(tmpdir(), 'assetopt-cache-out-'));
      await runPipeline(cacheInput, { output: { dir: out } });
      const second = await runPipeline(cacheInput, {
        output: { dir: out },
        images: { quality: { jpeg: 50 } },
      });
      const jpeg = second.find((r) => r.assetType === 'image')!;
      expect(jpeg.cached).toBe(false);
      await rm(out, { recursive: true, force: true });
    });

    it('useCache: false bypasses cache reads and writes', async () => {
      const out = await mkdtemp(path.join(tmpdir(), 'assetopt-cache-out-'));
      const localInput = await mkdtemp(path.join(tmpdir(), 'assetopt-no-cache-'));
      await writeFile(path.join(localInput, 'a.css'), '.a { color: red; }');
      await runPipeline(localInput, { output: { dir: out } }, { useCache: false });
      expect(existsSync(path.join(out, '.assetopt-cache.json'))).toBe(false);
      const second = await runPipeline(localInput, { output: { dir: out } }, { useCache: false });
      expect(second.every((r) => r.cached === false)).toBe(true);
      await rm(out, { recursive: true, force: true });
      await rm(localInput, { recursive: true, force: true });
    });

    it('dryRun does not write the manifest', async () => {
      const out = await mkdtemp(path.join(tmpdir(), 'assetopt-cache-out-'));
      await runPipeline(cacheInput, { output: { dir: out } }, { dryRun: true });
      expect(existsSync(path.join(out, '.assetopt-cache.json'))).toBe(false);
      await rm(out, { recursive: true, force: true });
    });

    it('stores manifest outputPath with posix separators for nested files', async () => {
      const localInput = await mkdtemp(path.join(tmpdir(), 'assetopt-nested-'));
      const out = await mkdtemp(path.join(tmpdir(), 'assetopt-nested-out-'));
      await mkdir(path.join(localInput, 'sub', 'deep'), { recursive: true });
      await writeFile(path.join(localInput, 'sub', 'deep', 'a.css'), '.x { color: red; }');
      await runPipeline(localInput, { output: { dir: out } });
      const raw = await readFile(path.join(out, '.assetopt-cache.json'), 'utf-8');
      const manifest = JSON.parse(raw) as Record<string, { outputPath: string }>;
      const entries = Object.values(manifest);
      expect(entries).toHaveLength(1);
      expect(entries[0].outputPath).toBe('sub/deep/a.css');
      expect(entries[0].outputPath).not.toContain('\\');
      await rm(localInput, { recursive: true, force: true });
      await rm(out, { recursive: true, force: true });
    });

    it('falls back to dispatch if manifest entry exists but output file is missing', async () => {
      const out = await mkdtemp(path.join(tmpdir(), 'assetopt-cache-out-'));
      const first = await runPipeline(cacheInput, { output: { dir: out } });
      // delete one output file, leaving manifest stale
      await rm(first[0].outputPath, { force: true });
      const second = await runPipeline(cacheInput, { output: { dir: out } });
      const stale = second.find((r) => r.inputPath === first[0].inputPath)!;
      expect(stale.cached).toBe(false);
      await rm(out, { recursive: true, force: true });
    });
  });

  describe('per-file errors', () => {
    let errInput: string;

    beforeAll(async () => {
      errInput = await mkdtemp(path.join(tmpdir(), 'assetopt-err-'));
      await writeFile(path.join(errInput, 'broken.jpg'), Buffer.from('definitely not an image'));
      await writeFile(path.join(errInput, 'style.css'), '.ok { color: red; }');
    });

    afterAll(async () => {
      await rm(errInput, { recursive: true, force: true });
    });

    it('continues past a corrupt file and reports it with an error', async () => {
      const out = await mkdtemp(path.join(tmpdir(), 'assetopt-err-out-'));
      const results = await runPipeline(errInput, { output: { dir: out } });

      expect(results).toHaveLength(2);
      const broken = results.find((r) => r.inputPath.endsWith('broken.jpg'))!;
      const css = results.find((r) => r.inputPath.endsWith('style.css'))!;
      expect(broken.error).toBeDefined();
      expect(broken.savedBytes).toBe(0);
      expect(broken.cached).toBe(false);
      expect(css.error).toBeUndefined();
      await rm(out, { recursive: true, force: true });
    });

    it('does not write output for the failed file but writes the others', async () => {
      const out = await mkdtemp(path.join(tmpdir(), 'assetopt-err-out-'));
      await runPipeline(errInput, { output: { dir: out } });
      expect(existsSync(path.join(out, 'broken.jpg'))).toBe(false);
      expect(existsSync(path.join(out, 'style.css'))).toBe(true);
      await rm(out, { recursive: true, force: true });
    });

    it('still writes the manifest so successful work is not lost', async () => {
      const out = await mkdtemp(path.join(tmpdir(), 'assetopt-err-out-'));
      await runPipeline(errInput, { output: { dir: out } });
      expect(existsSync(path.join(out, '.assetopt-cache.json'))).toBe(true);
      // Second run: the healthy file hits the cache, the broken one errors again.
      const second = await runPipeline(errInput, { output: { dir: out } });
      const css = second.find((r) => r.inputPath.endsWith('style.css'))!;
      expect(css.cached).toBe(true);
      await rm(out, { recursive: true, force: true });
    });
  });

  describe('output path collisions', () => {
    let collInput: string;

    beforeAll(async () => {
      collInput = await mkdtemp(path.join(tmpdir(), 'assetopt-coll-'));
      const jpegBuffer = await sharp({
        create: { width: 40, height: 40, channels: 3, background: { r: 10, g: 20, b: 30 } },
      })
        .jpeg()
        .toBuffer();
      const pngBuffer = await sharp({
        create: {
          width: 40,
          height: 40,
          channels: 4,
          background: { r: 10, g: 20, b: 30, alpha: 1 },
        },
      })
        .png()
        .toBuffer();
      // Same basename: both convert to photo.webp with outputFormat: 'webp'.
      await writeFile(path.join(collInput, 'photo.jpg'), jpegBuffer);
      await writeFile(path.join(collInput, 'photo.png'), pngBuffer);
    });

    afterAll(async () => {
      await rm(collInput, { recursive: true, force: true });
    });

    it('reports the second source as an error instead of silently overwriting', async () => {
      const out = await mkdtemp(path.join(tmpdir(), 'assetopt-coll-out-'));
      const results = await runPipeline(collInput, {
        images: { outputFormat: 'webp' },
        output: { dir: out },
      });

      const errored = results.filter((r) => r.error !== undefined);
      expect(errored).toHaveLength(1);
      expect(errored[0].error).toContain('collision');
      expect(results.filter((r) => r.error === undefined)).toHaveLength(1);
      await rm(out, { recursive: true, force: true });
    });

    it('does not collide when formats stay distinct', async () => {
      const out = await mkdtemp(path.join(tmpdir(), 'assetopt-coll-out-'));
      const results = await runPipeline(collInput, { output: { dir: out } });
      expect(results.every((r) => r.error === undefined)).toBe(true);
      await rm(out, { recursive: true, force: true });
    });
  });

  describe('scan exclusions', () => {
    it('never re-scans the output directory as a source', async () => {
      const localInput = await mkdtemp(path.join(tmpdir(), 'assetopt-selfscan-'));
      await writeFile(path.join(localInput, 'top.css'), '.a { color: red; }');
      // Output dir nested inside the input dir — the dangerous default layout.
      const out = path.join(localInput, 'optimized');

      const first = await runPipeline(localInput, { output: { dir: out } });
      expect(first).toHaveLength(1);
      const second = await runPipeline(localInput, { output: { dir: out } });
      expect(second).toHaveLength(1);
      expect(second[0].inputPath.endsWith('top.css')).toBe(true);
      await rm(localInput, { recursive: true, force: true });
    });

    it('ignores node_modules inside the input directory', async () => {
      const localInput = await mkdtemp(path.join(tmpdir(), 'assetopt-nm-'));
      await writeFile(path.join(localInput, 'app.js'), 'const a = 1;');
      await mkdir(path.join(localInput, 'node_modules', 'dep'), { recursive: true });
      await writeFile(path.join(localInput, 'node_modules', 'dep', 'vendor.js'), 'var v = 2;');

      const results = await runPipeline(localInput, {}, { dryRun: true });
      expect(results).toHaveLength(1);
      expect(results[0].inputPath.endsWith('app.js')).toBe(true);
      await rm(localInput, { recursive: true, force: true });
    });
  });

  describe('parallel execution', () => {
    it('returns results in the same order as a serial run', async () => {
      const serial = await runPipeline(tmpInput, {}, { dryRun: true, concurrency: 1 });
      const parallel = await runPipeline(tmpInput, {}, { dryRun: true, concurrency: 4 });
      expect(parallel.map((r) => r.inputPath)).toEqual(serial.map((r) => r.inputPath));
    });

    it('reports progress with a monotonic counter and a stable total', async () => {
      const calls: Array<[number, number]> = [];
      const results = await runPipeline(
        tmpInput,
        {},
        {
          dryRun: true,
          onProgress: (current, total) => calls.push([current, total]),
        },
      );
      expect(calls.map(([current]) => current)).toEqual(results.map((_, i) => i + 1));
      expect(calls.every(([, total]) => total === results.length)).toBe(true);
    });

    it('writes the same outputs as a serial run', async () => {
      const outSerial = await mkdtemp(path.join(tmpdir(), 'assetopt-par-s-'));
      const outParallel = await mkdtemp(path.join(tmpdir(), 'assetopt-par-p-'));
      const serial = await runPipeline(
        tmpInput,
        { output: { dir: outSerial } },
        { useCache: false, concurrency: 1 },
      );
      const parallel = await runPipeline(
        tmpInput,
        { output: { dir: outParallel } },
        { useCache: false, concurrency: 4 },
      );

      expect(parallel.map((r) => path.basename(r.outputPath))).toEqual(
        serial.map((r) => path.basename(r.outputPath)),
      );
      for (const result of parallel) {
        expect(existsSync(result.outputPath)).toBe(true);
      }
      await rm(outSerial, { recursive: true, force: true });
      await rm(outParallel, { recursive: true, force: true });
    });

    it('still reports exactly one collision error under concurrency', async () => {
      // Same-basename sources racing to the same output path: whichever task
      // claims first wins, but exactly one of the two must error either way.
      const collInput = await mkdtemp(path.join(tmpdir(), 'assetopt-par-coll-'));
      const jpegBuffer = await sharp({
        create: { width: 40, height: 40, channels: 3, background: { r: 10, g: 20, b: 30 } },
      })
        .jpeg()
        .toBuffer();
      const pngBuffer = await sharp({
        create: {
          width: 40,
          height: 40,
          channels: 4,
          background: { r: 10, g: 20, b: 30, alpha: 1 },
        },
      })
        .png()
        .toBuffer();
      await writeFile(path.join(collInput, 'photo.jpg'), jpegBuffer);
      await writeFile(path.join(collInput, 'photo.png'), pngBuffer);
      const out = await mkdtemp(path.join(tmpdir(), 'assetopt-par-coll-out-'));

      const results = await runPipeline(
        collInput,
        { images: { outputFormat: 'webp' }, output: { dir: out } },
        { concurrency: 4 },
      );
      expect(results.filter((r) => r.error !== undefined)).toHaveLength(1);
      expect(results.filter((r) => r.error === undefined)).toHaveLength(1);

      await rm(collInput, { recursive: true, force: true });
      await rm(out, { recursive: true, force: true });
    });
  });
});
