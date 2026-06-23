# Feature catalog — assetopt CLI

Exhaustive reference of every feature in the free CLI (open source, MIT). For workflows and getting started, see the [README](../README.md). For real-world numbers, see `docs/benchmarks.md` (coming soon).

---

## Per-asset-type optimization

assetopt processes four families of static assets, one well-known library per type. The functions in `core` are pure: a buffer in, an optimized buffer out, no hidden I/O. The CLI handles reading, writing, and reporting around them.

### Images — `sharp`

**What you get**: serious compression for JPEG, PNG, WebP, and AVIF, with no manual setup. EXIF/ICC metadata is stripped by default — instant size win, plus better privacy.

**Defaults**: per-format quality `jpeg: 85`, `png: 80`, `webp: 82`, `avif: 75` — conservative, visually neutral in the vast majority of cases. `stripMetadata: true`. Output format `keep` (no conversion unless explicitly requested — see [Smart format conversion](#smart-format-conversion)).

```json
{
  "images": {
    "quality": { "jpeg": 80, "avif": 70 },
    "stripMetadata": true
  }
}
```

**Notes**: `sharp` uses native `libvips` bindings — the fastest and most stable image-processing library in the Node ecosystem. Supported input formats: JPEG, PNG, WebP, AVIF. GIF is no longer supported.

**When to lower quality**: if you serve large photos (hero sections, lightboxes), dropping JPEG to 75-80 stays visually clean and shaves another 20-30% off the size.

### CSS — `lightningcss`

**What you get**: production-grade minification without configuring a bundler.

**Defaults**: `minify: true`. Nothing else to tune.

```json
{ "css": { "minify": true } }
```

**Notes**: `lightningcss` is written in Rust and is significantly faster than `cssnano` or `csso`. It also handles modern CSS transformations (nesting, custom properties) without plugins.

**Limit**: no transformation options (browserslist, vendor prefixes) — by design, assetopt minifies what's there, it doesn't transform. If you need CSS transformations, do them upstream in your build.

### JavaScript — `esbuild`

**What you get**: minification (whitespace, identifiers, syntax) without installing `terser` or configuring a bundler.

**Defaults**: `minify: true`.

```json
{ "js": { "minify": true } }
```

**Notes**: `esbuild` is the reference for minification speed (Go, multi-threaded). All three levers fire together: whitespace removal, local identifier shortening, syntax simplification.

**Limit**: no bundling, no tree-shaking, no transpilation. assetopt minifies a JS file as-is — if you need bundling, that's the job of Vite/esbuild/Rollup upstream.

### SVG — `svgo`

**What you get**: aggressive cleanup of SVG files (comments, metadata, useless attributes), with multi-pass optimization on by default.

**Defaults**: `multipass: true`, `minifyIds: false`.

```json
{ "svg": { "multipass": true, "minifyIds": false } }
```

**Notes**: `multipass` re-applies the optimization pass until convergence (slower but more effective). `minifyIds: false` is a safe default — minifying `id` attributes can break SVGs referenced from external CSS (`url(#myIcon)`) or from SVG sprites. Turn it on if your SVGs are self-contained (inline icons, no cross-file reuse).

---

## Smart format conversion

assetopt knows how to recompress an asset in its original format **and** to convert it to a modern one. Three ways to express that conversion, from simplest to most fine-grained.

### The `web-perf` preset

**What you get**: the best web-perf decision per file, with no config. You write one line, assetopt routes each format to its lightest modern equivalent.

```json
{ "preset": "web-perf" }
```

Under the hood, the preset applies:

| Source format   | Target    | Why                                                   |
| --------------- | --------- | ----------------------------------------------------- |
| JPEG            | WebP      | WebP beats JPEG on virtually every photo              |
| Opaque PNG      | WebP      | WebP is lighter than AVIF on transparency-free images |
| Transparent PNG | AVIF      | AVIF preserves alpha at a lower size than WebP        |
| WebP            | unchanged | Already optimal                                       |
| AVIF            | unchanged | Already optimal                                       |

**When to use**: workflows where you control HTML integration (build with a plugin, asset prep before integration). **Avoid** on a hand-written site that hard-codes `.jpg` in `<img>` tags — see the README workflows section.

### Other presets

Three more presets cover common intents. Like `web-perf`, each is just a one-liner (`{ "preset": "<name>" }`) and stays fully overridable by your own config (preset → user config deep merge).

| Preset            | Format routing                        | Quality                         | Metadata | Extras                        | When to use                                                    |
| ----------------- | ------------------------------------- | ------------------------------- | -------- | ----------------------------- | -------------------------------------------------------------- |
| `max-compression` | everything → AVIF (AVIF kept)         | `avif: 50` (others = defaults)  | stripped | SVG `multipass` + `minifyIds` | Smallest possible payload; you control HTML and can serve AVIF |
| `quality`         | every format kept (no lossy switch)   | `jpeg/png/webp: 95`, `avif: 90` | **kept** | —                             | Fidelity-first: photography, print prep, color-managed assets  |
| `compatibility`   | every format kept (never more modern) | defaults                        | stripped | —                             | Legacy targets: output stays as widely supported as the input  |

Notes:

- Image quality is keyed by the **output** format. Under `max-compression` everything converges to AVIF, so only `avif: 50` is in play; the other quality entries stay at their defaults but rarely apply.
- `quality` is **not** bit-for-bit lossless — JPEG/WebP/AVIF remain lossy codecs, just pinned to a high quality floor. PNG stays PNG (lossless container). Metadata (EXIF, color profiles) is preserved.
- `compatibility` performs no format surgery: it pins every source to `keep`, guaranteeing the output is never a more modern format than the input. It still recompresses at default quality.

### The `formatMatrix` (power user)

**What you get**: per-format conversion rules, in pure JSON. Partial or full override of the preset.

```json
{
  "images": {
    "formatMatrix": {
      "jpeg": "webp",
      "png": "keep",
      "webp": "keep"
    }
  }
}
```

**Resolution semantics**: `formatMatrix[X]` (if defined) > global `outputFormat` > source format (no-op). The value `'keep'` explicitly excludes a format from conversion (useful for "convert JPEG but leave my PNGs alone").

**Merging with a preset**: preset → user config in deep merge over the matrix. You can change one entry without losing the others:

```json
{
  "preset": "web-perf",
  "images": { "formatMatrix": { "jpeg": "keep" } }
}
```

→ JPEG stays JPEG, PNG keeps the preset's smart routing.

### Transparency-aware PNG smart routing

**What you get**: the right format based on actual content, not on the container. A PNG with no alpha channel has no business going to AVIF (heavier than WebP on opaque images); a transparent PNG has every reason to land on AVIF (alpha preserved, smaller size).

This ships directly with the `web-perf` preset (nothing to configure). Programmatically, it's expressed as a function in the matrix:

```ts
import { optimizeImage } from '@assetopt/core';

await optimizeImage(buf, {
  formatMatrix: {
    png: (ctx) => (ctx.hasAlpha ? 'avif' : 'webp'),
  },
});
```

**Notes**: the decision is taken after reading sharp metadata, in a single pass. `FormatRoutingContext` exposes `hasAlpha` today; more signals (size, palette) can be added without breaking the API.

---

## Incremental cache

**What you get**: re-run `assetopt optimize` as often as you want — only new or modified files are reprocessed. First run is slow, every run after is near-instant. No config to enable.

```bash
assetopt optimize ./public               # 1st run — everything processed
assetopt optimize ./public               # 2nd run — everything marked (cached) ✓
assetopt optimize ./public --no-cache    # force a full re-run
```

**How it works**:

- Manifest stored in `<output.dir>/.assetopt-cache.json`.
- Cache key: `sha256(source buffer ⊕ stable-serialized config ⊕ @assetopt/core version)`.
- Automatic invalidation on: source file change, config change (preset, matrix, quality, skip…), core version bump.
- `output.dir` is excluded from the hash — moving the output folder doesn't invalidate.
- Self-healing: if an entry points to an output file that no longer exists (you cleared `./optimized/`), assetopt re-dispatches automatically.

**Behavior with `analyze`**: `analyze` reads the cache to skip redundant work, but never writes the manifest (only `optimize` maintains it).

**When to use `--no-cache`**: to faithfully reproduce a first-run, or to benchmark internal changes without bias.

**Clearing the cache**: `assetopt clean` removes the manifest (force a fresh re-optimize next run);
`assetopt clean --all` removes the whole output directory. See [CLI reference → clean](./cli.md#assetopt-clean).

---

## Skip by format

**What you get**: ignore source formats without removing them from the folder. The file is neither read, nor written, nor copied.

```json
{ "images": { "skip": ["avif", "webp"] } }
```

**Don't confuse with `'keep'` in the matrix**:

| Construct                       | Effect                                                          |
| ------------------------------- | --------------------------------------------------------------- |
| `images.skip: ["png"]`          | PNGs are **ignored** — absent from report, cache, and output    |
| `formatMatrix: { png: 'keep' }` | PNGs are **processed** (recompressed) without format conversion |

Typical use case: you already serve pre-optimized AVIFs and you want assetopt to leave them strictly alone.

---

## `assetopt audit`

**What you get**: a fast scan that tells you where the problems are in an asset folder, without modifying anything. Great for discovering an unfamiliar project, or for a quick check before a cleanup.

```bash
assetopt audit ./public                          # fast mode (size only)
assetopt audit ./public --savings                # full mode (pipeline dry-run)
assetopt audit ./public --savings --threshold 20 # flag threshold at 20%
```

**Fast mode (default)**: only reads file size, flags oversized files per type:

| Type       | Default threshold |
| ---------- | ----------------- |
| Image      | 500 KB            |
| JavaScript | 100 KB            |
| CSS        | 50 KB             |
| SVG        | 50 KB             |

**Full mode (`--savings`)**: runs the pipeline as a dry-run to compute potential savings per file. Also flags files where savings would exceed `--threshold` (default 10%). Slower, but writes nothing.

**Exit code**: 1 if at least one file was flagged, 0 otherwise. Usable in CI to block a commit that introduces an oversized asset.

---

## CI quality gate (`--min-savings`)

**What you get**: a single flag that turns assetopt into a CI/CD quality gate. If total savings drop below the threshold, the process exits with code 1 — CI breaks, the deploy is blocked.

```bash
assetopt optimize dist --min-savings 15
assetopt analyze dist --min-savings 15
```

Available on both `optimize` and `analyze`. The threshold compares the report's `totalSavedPercent` (overall savings, not per file).

**Use cases**:

- Block a deploy that contains accidentally-unoptimized assets.
- Detect a pipeline regression (e.g. a dependency that re-introduces EXIF metadata, a build that no longer pipes through assetopt).
- On `analyze`, confirm in pre-build that there's still gain to extract before launching a costly optimize.

**Note**: the threshold is _global_ — it gates total savings across the run, not individual files.

---

## Zero-friction config

**What you get**: no config file to pass on the command line, no path to spell out. Drop a `.assetoptrc` at your project root and `assetopt` will find it from any subdirectory.

```bash
assetopt init                # generate a .assetoptrc with defaults
assetopt optimize src/img    # finds .assetoptrc at the root, applies it
```

**Walk-up**: `loadConfig()` starts at `process.cwd()` and walks up parents until it finds `.assetoptrc` or `.assetoptrc.json`. First match wins.

**Explicit indication**: the CLI prints the config source at the start of every command:

```
Config: /home/me/proj/.assetoptrc
Optimizing /home/me/proj/src/img...
```

Or, if no file was found:

```
Config: defaults (no .assetoptrc found)
```

→ you immediately know whether your config was picked up.

**Defaults applied if no file**: whatever is set in `IMAGE_DEFAULTS`, `CSS_DEFAULTS`, `JS_DEFAULTS`, `SVG_DEFAULTS` (conservative quality, minification on, output dir `./optimized`).

---

## JSON output (`--json`)

**What you get**: the optimization report in JSON, ready to pipe into your own scripts (custom analysis, internal dashboard, run-to-run comparison, etc.).

```bash
assetopt optimize ./public --json > report.json
```

Available on `optimize` and `analyze` (not on `audit` for now). On `analyze` the report has the
same `OptimizeResult` shape — it just reflects a dry-run (potential savings), nothing is written.

**JSON structure** (type `OptimizeResult`):

```json
{
  "assets": [
    {
      "inputPath": "/abs/path/to/photo.jpg",
      "outputPath": "/abs/path/to/optimized/photo.webp",
      "inputSize": 824133,
      "outputSize": 245912,
      "savedBytes": 578221,
      "savedPercent": 70.2,
      "assetType": "image",
      "durationMs": 142,
      "cached": false
    }
  ],
  "totalInputSize": 824133,
  "totalOutputSize": 245912,
  "totalSavedBytes": 578221,
  "totalSavedPercent": 70.2,
  "durationMs": 142,
  "cachedCount": 0
}
```

When `--json` is on, the CLI logs neither the progress bar nor the colored summary — stdout contains only the JSON.

---

## See also

- [README](../README.md) — quick start, recommended workflows
- `docs/benchmarks.md` (coming soon) — real-world savings numbers per scenario
- [CLI reference](./cli.md) — exhaustive reference of each command
- [Configuration reference](./config.md) — exhaustive reference of `.assetoptrc`
