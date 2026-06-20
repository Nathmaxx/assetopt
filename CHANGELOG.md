# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

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

[1.0.0]: https://github.com/Nathmaxx/assetopt/releases/tag/v1.0.0
