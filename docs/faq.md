# FAQ

Twelve questions covering the most common objections, integration concerns, and edge cases. For a full feature reference see [features.md](./features.md), for end-to-end setups see the [workflow guides](./workflows/).

---

## Trust & safety

### Does assetopt touch my originals?

No. assetopt reads from a source directory and writes to a separate output directory (`./optimized/` by default). Source files are never modified, moved, or renamed. The only thing assetopt writes outside the optimized assets themselves is the cache manifest (`.assetopt-cache.json`), and that lives inside the output directory.

### Why does my optimized file sometimes end up larger than the source?

Two common reasons:

- **The source is already heavily optimized.** Recompressing a TinyPNG-d PNG or a WebP from another tool may add a handful of bytes of container overhead with no real gain.
- **You converted to a poorly-suited target format.** AVIF on tiny opaque thumbnails or simple PNG icons can end up larger than the source PNG. The `web-perf` preset's smart routing avoids this for PNGs (opaque → WebP), but a manual `formatMatrix: { png: 'avif' }` does not.

The CLI flags this in red in the per-file output, so a regression is visible at a glance.

### Why is the first run so slow?

Image processing is CPU-bound: sharp decodes, recompresses, and re-encodes every file in the set. Files are processed in parallel (up to 4 at once), but on 100+ images the first run still takes a few seconds. Subsequent runs are near-instant because the cache marks unchanged files as `(cached)` and skips them. If your CI workspace is wiped between runs, persist `<output.dir>/.assetopt-cache.json` (or the entire output directory) across runs to keep build times low.

---

## Comparisons

### Why not use imagemin / squoosh / sharp directly?

You can — assetopt uses sharp internally. Three things you'd end up building yourself:

- Recursive directory scan with extension-based dispatch to the right optimizer (sharp / svgo / lightningcss / esbuild).
- An incremental cache that survives across runs and invalidates correctly when the config changes.
- A coherent CLI with a config file, presets, CI-grade reporting, and a quality-gate flag.

If your setup is one image, run sharp directly. If it's a folder you re-process regularly, you'd end up rewriting half of assetopt.

## Integration

### Will my image references break?

Not with the defaults. `outputFormat: 'keep'` (the default) means every file keeps its original name and extension — only the bytes change. References break only if you opt into format conversion, either via `preset: 'web-perf'` or by setting a non-`'keep'` target in `formatMatrix`. The [workflow guides](./workflows/) explain which workflows can safely enable the preset.

### How do I run assetopt in GitHub Actions?

```yaml
- run: npm ci
- run: npm run build
- run: npx assetopt optimize dist --min-savings 5
- uses: actions/cache@v4
  with:
    path: ./optimized
    key: assetopt-${{ hashFiles('dist/**') }}
```

`--min-savings 5` exits with code 1 if total savings drop below 5%, turning assetopt into a CI quality gate. Caching `./optimized/` between runs preserves the manifest, so unchanged files stay marked as `(cached)`. See the full walk-through in the [CI pre-deploy workflow](./workflows/ci-predeploy.md).

### Can I use assetopt with Next / Vite / Astro builds?

Yes — run it on the build output (`dist/`, `.next/static/`, etc.) before you deploy. assetopt doesn't hook into the build itself; it runs as a separate step on the built output. When running on built output, format conversion is unsafe (your bundler has already wired up references), so stick to recompression with `outputFormat: 'keep'` (the default).

### Can I call assetopt programmatically from Node.js?

Yes. `@assetopt/core` exports the optimizer functions as pure buffer-in / buffer-out:

```ts
import { optimizeImage, optimizeCss, optimizeJs, optimizeSvg } from '@assetopt/core';

const result = await optimizeImage(buffer, { quality: { jpeg: 80 } });
// result.buffer, result.format, result.originalSize, result.outputSize
```

You can also use `runPipeline`, `loadConfig`, and `buildReport` to assemble a custom flow. The core package pulls in no CLI dependencies.

---

## Behavior & support

### Which formats are supported?

- **Images**: JPEG, PNG, WebP, AVIF (input and output)
- **CSS**: any valid CSS file
- **JavaScript**: any valid JS file
- **SVG**: any valid SVG file

Animated images are not supported — see the last question.

### Why is there a cache, and how do I invalidate it?

Image processing is the slow part of the pipeline (multi-second on a folder of 100+ photos). The cache stores a `sha256(source bytes ⊕ resolved config ⊕ @assetopt/core version)` per file. An asset is reprocessed only when one of those three changes.

Three ways to invalidate:

- Edit the source file — the natural case.
- Change any config field (`quality`, `preset`, `formatMatrix`, `skip`…) — the manifest re-keys automatically.
- Run with `--no-cache` to bypass both reads and writes for a single run.

The manifest lives in `<output.dir>/.assetopt-cache.json`. Deleting it invalidates everything.

### Does assetopt support animated images (GIF, animated WebP)?

No. GIF input was removed because lossy GIF → GIF recompression is uninteresting, and a proper GIF → animated WebP/AVIF pipeline needs a dedicated encoder (gifski or similar) that we didn't want to ship in the free MVP. Animated WebP and AVIF inputs are detected as static and only their first frame is processed — rarely what you want.

Animation-aware optimization isn't supported today; it may be considered for a future release.

---

## See also

- [Feature catalog](./features.md) — exhaustive reference of every feature
- [Workflow guides](./workflows/) — three end-to-end integration patterns
- [README](../README.md) — quick start and project overview
