# assetopt

A Node.js CLI for optimizing static assets — images, CSS, JS, and SVG. Open source, MIT.

assetopt scans a folder of assets, writes optimized versions to a separate output directory, and never touches your originals. An incremental cache means only changed files get reprocessed — first run is slow, every run after is near-instant.

## Install

```bash
npm install -g @assetopt/cli
# or as a project dev dependency
npm install --save-dev @assetopt/cli
```

## Quick start

```bash
# Generate a default .assetoptrc
assetopt init

# Dry-run: report potential savings without writing anything
assetopt analyze ./public

# Optimize for real (writes to ./optimized/ by default)
assetopt optimize ./public
```

## Why assetopt

- **Local and free.** No upload, no account, no SaaS. Your assets stay on your machine.
- **Smart format conversion.** The `web-perf` preset converts JPEG → WebP and routes PNG to WebP (opaque) or AVIF (transparent) automatically — one config line, the right decision per file.
- **Incremental cache by default.** Re-running `optimize` skips every file whose source and config haven't changed. CI builds stay fast.

## Recommended workflows

Three integration patterns, ordered by friction. Pick the one matching your project, then read the full guide.

| Workflow | When to use | Guide |
|----------|-------------|-------|
| **CI pre-deploy** | You have a build (Vite, Next, Astro…) producing `dist/`. Optimize before deploy. | [ci-predeploy.md](./docs/workflows/ci-predeploy.md) |
| **Hand-written static site** | You write HTML by hand and reference images by literal filenames. | [static-site.md](./docs/workflows/static-site.md) |
| **Asset prep before integration** | You receive raw assets, optimize them, then write the references yourself. | [asset-prep.md](./docs/workflows/asset-prep.md) |

The `web-perf` preset (which converts `.jpg → .webp` and `.png → .webp`/`.avif`) is safe in workflows 1 and 3 only. **Don't enable it on a hand-written site** — it breaks every `<img>` tag.

## Configuration

Drop a `.assetoptrc` at your project root. assetopt finds it automatically by walking up from the invocation directory.

```json
{
  "preset": "web-perf",
  "images": {
    "quality": { "jpeg": 85, "png": 80, "webp": 82, "avif": 75 },
    "stripMetadata": true,
    "skip": ["avif"]
  },
  "css": { "minify": true },
  "js": { "minify": true },
  "svg": { "multipass": true },
  "output": { "dir": "./optimized" }
}
```

### Presets

- **`web-perf`** — converts to modern formats automatically (`jpeg → webp`, `png → webp` if opaque or `avif` if transparent). Use only when you control HTML integration (workflow 1 or 3).

### Format matrix (advanced)

For fine-grained control, override per source format:

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

`'keep'` means "don't convert this format, just recompress it".

### Skip by format

```json
{ "images": { "skip": ["avif"] } }
```

`.avif` files are ignored entirely (not read, not written).

## Commands

| Command | Effect |
|---------|--------|
| `assetopt optimize [dir]` | Optimize and write results to `output.dir` |
| `assetopt analyze [dir]` | Dry-run: report savings without writing files |
| `assetopt audit [dir]` | Flag problematic assets (oversized, optimization potential) |
| `assetopt init` | Create a default `.assetoptrc` |

### Flags

| Flag | Commands | Effect |
|------|----------|--------|
| `-o, --output <dir>` | `optimize`, `analyze` | Override `output.dir` from config for this run |
| `--min-savings <%>` | `optimize`, `analyze` | Exit 1 if total savings < threshold (CI quality gate) |
| `--no-cache` | `optimize`, `analyze` | Bypass the incremental cache |
| `--json` | `optimize` | Raw JSON report (for scripts and downstream tooling) |
| `--savings` | `audit` | Run a full pipeline dry-run to compute per-file savings |
| `--threshold <%>` | `audit` | Min savings % to flag a file (requires `--savings`, default `10`) |
| `--force` | `init` | Overwrite an existing `.assetoptrc` |

## Incremental cache

Enabled by default. Manifest: `<output.dir>/.assetopt-cache.json`. An asset is reprocessed only when its source content **or** the resolved config changes.

```bash
assetopt optimize ./public               # 1st run: everything processed
assetopt optimize ./public               # 2nd run: everything marked (cached) ✓
assetopt optimize ./public --no-cache    # force a full re-run
```

If an entry points to an output file that no longer exists (you cleared `./optimized/`), assetopt re-dispatches automatically.

## About assetopt Pro

A few sections of the docs reference an upcoming **assetopt Pro** — a separate paid layer on top of this free CLI. Heads-up so you're not lost when you see it mentioned:

- **What it is**: an integration layer that the CLI deliberately doesn't provide — Vite/Next build plugins (so format conversion stays safe across your HTML), a VS Code extension that optimizes on save, shareable HTML reports, responsive variant generation, automatic `<picture>` injection, watch mode, and parallel processing.
- **What it isn't**: a hosted SaaS or a subscription. It will be a one-shot purchase, in a separate repo, depending on `@assetopt/core`. The free CLI stays MIT and feature-complete on its own.
- **Status**: not released yet — no dates, no signup. Full overview in [docs/pro.md](./docs/pro.md), short FAQ TL;DR [here](./docs/faq.md#whats-the-difference-between-the-free-cli-and-assetopt-pro).

## Documentation

- [CLI reference](./docs/cli.md) — every command, every flag, every exit code.
- [Configuration reference](./docs/config.md) — every `.assetoptrc` field with type, default, and constraints.
- [Feature catalog](./docs/features.md) — every feature with its config, behavior, and limits.
- [Workflow guides](./docs/workflows/) — detailed walkthroughs for the three integration patterns above.
- [FAQ](./docs/faq.md) — common objections, integration questions, and edge cases.
- [Pro overview](./docs/pro.md) — what the upcoming paid layer will add on top of the free CLI.

## License

MIT.
