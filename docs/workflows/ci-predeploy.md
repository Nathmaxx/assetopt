# Workflow: CI pre-deploy on the built `dist/`

The most natural workflow for any project that already has a build step. You let your bundler (Vite, Next, Astro, anything) produce a `dist/` whose HTML and CSS reference resolved URLs, then you run `assetopt optimize` on that output right before deploying.

Why this works so well: the build has already wired up file paths and references, so as long as you keep file extensions intact, nothing breaks. assetopt's `outputFormat: 'keep'` default does exactly that — recompress every asset, keep the same name and extension.

## Prerequisites

- A build pipeline that emits a deterministic output directory (commonly `dist/`).
- Node.js 20+ available in your CI environment.
- Your deploy step pointing at the optimized output (not at `dist/` directly).

## Recommended `.assetoptrc`

```json
{
  "images": {
    "quality": { "jpeg": 82, "png": 80, "webp": 82, "avif": 72 },
    "stripMetadata": true
  },
  "css": { "minify": true },
  "js": { "minify": true },
  "svg": { "multipass": true },
  "output": { "dir": "./optimized" }
}
```

**Do not set `"preset": "web-perf"` here.** The preset converts file extensions (`jpeg → webp`, `png → avif`), and your built HTML still references the originals. Format conversion in this workflow requires a build plugin that rewrites imports — that's [an assetopt Pro feature](../pro.md#vite-plugin).

## Step by step

```bash
# Local check (optional but recommended once)
npm run build
assetopt analyze dist
```

Then in CI (GitHub Actions example):

```yaml
- run: npm ci
- run: npm run build
- run: npx assetopt optimize dist --min-savings 5
- run: # your deploy step, pointing at ./optimized/
```

The `--min-savings 5` flag turns assetopt into a quality gate: if the build's total savings drop below 5%, CI fails. Start low and tighten over time.

## Expected terminal output

```
✓ config loaded from /workspace/.assetoptrc
Optimizing /workspace/dist...

  image  hero.jpg                          412.3 KB →   147.8 KB    -64.1%
  image  about-team.jpg                    1.1 MB  →   389.2 KB    -65.5%
  image  logo.png                           14.2 KB →     8.1 KB    -42.9%
  css    main.css                           48.7 KB →    34.2 KB    -29.7%
  js     app.js                            186.5 KB →   112.9 KB    -39.4%
  svg    icon-arrow.svg                     1.2 KB →      0.6 KB    -50.0%

  6 files · 1.7 MB → 692.8 KB · Saved 1.0 MB (61.0%) · 0 cached · 1.8s
```

On subsequent runs, the cache kicks in:

```
  6 files · 1.7 MB → 692.8 KB · Saved 1.0 MB (61.0%) · 6 cached · 0.1s
```

## Common pitfalls

1. **Don't run `optimize` on source folders** (`src/`, `public/`). Those assets haven't been processed by your build yet, and your bundled imports usually won't pick up the optimized copies. Always target the build output.

2. **Persist the cache between CI runs.** The manifest lives in `<output.dir>/.assetopt-cache.json`. CI typically wipes the workspace, killing the cache. In GitHub Actions, add a step to cache the `./optimized/` directory keyed on a hash of `dist/`:

   ```yaml
   - uses: actions/cache@v4
     with:
       path: ./optimized
       key: assetopt-${{ hashFiles('dist/**') }}
   ```

3. **Threshold tuning.** `--min-savings 15` on a project that already outputs already-optimized assets (modern builds with image-min plugins) will fail every run. Start at 3-5%, raise it once you have a baseline.

4. **The deploy target must be `./optimized/`**, not `./dist/`. If you forget, you deploy unoptimized files and the whole pipeline becomes a no-op. Add a sanity check in your deploy script (e.g. `[ -d ./optimized ] || exit 1`).

5. **`outputFormat: 'keep'` is critical here.** If you ever explicitly set `outputFormat: 'webp'` (or use the `web-perf` preset), every `.jpg` becomes `.jpg.webp` and your HTML breaks silently — no error, just 404s in production.

## See also

- [Feature catalog → CI quality gate](../features.md#ci-quality-gate---min-savings)
- [Feature catalog → Incremental cache](../features.md#incremental-cache)
- [Workflow: hand-written static site](./static-site.md)
- [Workflow: asset prep before integration](./asset-prep.md)
