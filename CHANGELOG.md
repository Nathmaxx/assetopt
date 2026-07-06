# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [1.1.0] — 2026-07-06

### Added

- `input.include` / `input.exclude` config fields: glob patterns (picomatch syntax, matched relative to the scanned directory) to target or skip source files; `scanDirectory` gains the matching `include`/`exclude` options in `ScanOptions` (`@assetopt/core`).
- `--exclude <glob>` flag (repeatable) on `optimize`, `analyze` and `audit` — appended to `input.exclude` from the config for a single run.
- `runPipeline` option `concurrency` (clamped to 1–4) to control the size of the processing pool (`@assetopt/core`).

### Changed

- `@assetopt/core` gains a runtime dependency on `picomatch` (zero-dependency glob matcher) to power `input.include`/`input.exclude` with standard, battle-tested glob semantics.
- The pipeline now processes assets concurrently — a bounded in-process pool of `min(cores, 4)`, previously strictly sequential. Large folders optimize several times faster (measured ~3.6× on 24 photos, 4 cores). Result order, report rendering and cache behavior are unchanged; when two sources collide on the same output path, which source wins is no longer guaranteed to be scan order (the collision is still reported as a per-file error either way).

## [1.0.3] — 2026-07-05

### Fixed

- `assetopt --version` reported a hard-coded `1.0.0` regardless of the installed release. The CLI now resolves its version from its own `package.json` at runtime (same pattern `@assetopt/core` already used for cache keys).
- Two sources resolving to the same output path after format conversion (e.g. `photo.jpg` and `photo.png` both converted to `photo.webp`) silently overwrote each other. The collision is now detected — the first source wins, the second is reported as a per-file error and nothing is clobbered.
- A single corrupt or unprocessable file (invalid image, unparsable JS…) aborted the entire run **and** discarded the cache manifest, losing the work of every file already processed. The pipeline now records the failure on that asset and keeps going; the manifest is always written.
- `optimize`, `analyze` and `audit` scanned `node_modules`, dot-directories (`.git`…) and the resolved `output.dir` as sources. All three are now excluded — in particular, a previous run's output is no longer re-optimized when `output.dir` lives inside the input directory (the default `optimize .` layout).

### Added

- Per-file error reporting: `AssetResult.error` and `OptimizeResult.errorCount` in `@assetopt/core`; failed assets are shown in the report (`✖` row, `N failed` in the summary, `error: …` issue in `audit --savings`), and `optimize`/`analyze` exit 1 when at least one asset failed (message on stderr, `--json` stdout stays pure).
- `scanDirectory` now accepts `ScanOptions` (`recursive`, `excludePaths`), exported by `@assetopt/core`.

### Changed

- `scanDirectory(dir, recursive?)` signature changed to `scanDirectory(dir, options?: ScanOptions)`; `node_modules` and dot-directories are always skipped (filters apply to children only, so scanning a hidden directory directly still works).

## [1.0.2] — 2026-07-04

### Changed

- `README.md` and `packages/cli/README.md` — point the landing-page link to the project's own domain `https://assetopt.tech` (previously `https://nathmaxx.github.io/assetopt-site/`).

## [1.0.1] — 2026-06-25

### Changed

- `docs/config.md` — document all four shipped presets (`web-perf`, `max-compression`, `quality`, `compatibility`); the page previously listed only `web-perf`. Aligns the `preset` field type and the validation-error example with the actual `PRESET_NAMES` enum.
- `packages/cli/README.md` (and the project `README.md`) — add a link to the [project landing page](https://nathmaxx.github.io/assetopt-site/) (overview, before/after gallery, and a downloadable demo pack).

## [1.0.0] — 2026-06-19

Initial public release of `@assetopt/cli` and `@assetopt/core`.

### Added

- Core optimizers as pure buffer-in / buffer-out functions:
  - `optimizeImage` — JPEG, PNG, WebP, AVIF via `sharp`
  - `optimizeCss` — minification via `lightningcss`
  - `optimizeJs` — minification via `esbuild`
  - `optimizeSvg` — multipass optimization via `svgo`
- `assetopt optimize [dir]` — full pipeline, writes optimized assets to `output.dir`.
- `assetopt analyze [dir]` — dry-run reporting potential savings without writing.
- `assetopt audit [dir]` — flag oversized assets, optional `--savings` mode for full pipeline analysis.
- `assetopt init` — generate a default `.assetoptrc`.
- `assetopt clean` — remove the incremental cache, or the whole output directory with `--all` (`--dry-run` to preview; refuses to delete the cwd or a parent).
- `web-perf` preset with transparency-aware PNG smart routing (opaque PNG → WebP, transparent PNG → AVIF, JPEG → WebP).
- `max-compression`, `quality`, and `compatibility` presets: `max-compression` routes every format to AVIF at aggressive quality with full SVG optimization; `quality` keeps formats at a high quality floor and preserves metadata; `compatibility` keeps every source format unchanged (never produces a more modern format than the input).
- `images.formatMatrix` — per-source-format conversion rules with `'keep'` opt-out and programmatic function support.
- Incremental cache (`<output.dir>/.assetopt-cache.json`) with sha256 keys derived from source bytes, resolved config, and core version. Auto-recovery on missing output files.
- `images.skip` — exclude source formats from the pipeline entirely.
- `--min-savings <%>` — CI quality gate on `optimize` and `analyze` (exit 1 on threshold miss).
- `-o, --output <dir>` — one-run override of `output.dir` on `optimize` and `analyze`.
- `--no-cache` — bypass the incremental cache.
- `--json` — JSON report on stdout for `optimize` and `analyze` (downstream tooling).
- `--force` — overwrite existing `.assetoptrc` on `init`.
- Zero-friction config — `.assetoptrc` walk-up from `process.cwd()`, validated with zod.
- Colored terminal report with per-file breakdown, progress bar, and config-source banner.

[1.0.1]: https://github.com/Nathmaxx/assetopt/releases/tag/v1.0.1
[1.0.0]: https://github.com/Nathmaxx/assetopt/releases/tag/v1.0.0
