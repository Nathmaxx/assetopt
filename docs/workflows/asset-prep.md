# Workflow: asset prep before integration

You receive raw assets — client photos, screenshots, vector logos, batch icon downloads. You optimize them, then integrate them by hand (writing the `<img>` tags, dropping them into a CMS, sending them to a designer). The HTML doesn't exist yet, so format conversion is safe: you'll write the references after the fact.

This is the workflow where the `web-perf` preset shines.

## Prerequisites

- A staging folder for incoming assets (e.g. `./incoming/`).
- A clear destination for the prepped output (e.g. directly into your project's `public/images/`, or a shared folder).
- You're the one writing the references, so changing extensions is no problem.

## Recommended `.assetoptrc`

```json
{
  "preset": "web-perf",
  "images": {
    "quality": { "jpeg": 82, "webp": 80, "avif": 72 },
    "stripMetadata": true
  },
  "svg": { "multipass": true, "minifyIds": true },
  "output": { "dir": "./prepped" }
}
```

Key choices:

- `preset: "web-perf"` enables JPEG → WebP, PNG → WebP/AVIF (smart routed based on transparency).
- `minifyIds: true` for SVGs because logo files from designers usually have no external references — safe to shrink IDs aggressively.
- Output goes to `./prepped/`, separate from `./optimized/`, to avoid colliding with other workflows in the same project.

## Step by step

```bash
# 1. Drop incoming files in ./incoming/

# 2. See what gains to expect (no writes)
assetopt analyze ./incoming

# 3. Run the actual optimization
assetopt optimize ./incoming -o ./prepped/

# 4. Browse ./prepped/, pick what you want, write the references
```

The `-o` flag overrides `output.dir` for this one run — handy when you want to land in different places per batch (`-o ./prepped/blog/`, `-o ./prepped/landing/`).

## Expected terminal output

For the analyze step:

```
✓ config loaded from /home/me/site/.assetoptrc
Analyzing /home/me/site/incoming...

  image  client-photo-01.jpg               4.2 MB  →   612.4 KB    -85.8%
  image  client-photo-02.jpg               3.8 MB  →   548.9 KB    -85.6%
  image  logo-final.png                    234.5 KB →    42.1 KB    -82.0%
  image  product-shot.png                  1.1 MB  →   198.7 KB    -82.3%

  4 files · 9.4 MB → 1.4 MB · Would save 8.0 MB (84.7%) · 0 cached · 4.2s
```

Then the optimize step writes them to disk:

```
✓ config loaded from /home/me/site/.assetoptrc
Optimizing /home/me/site/incoming...

  image  client-photo-01.jpg               4.2 MB  →   612.4 KB    -85.8%
  image  client-photo-02.jpg               3.8 MB  →   548.9 KB    -85.6%
  image  logo-final.png                    234.5 KB →    42.1 KB    -82.0%
  image  product-shot.png                  1.1 MB  →   198.7 KB    -82.3%

  4 files · 9.4 MB → 1.4 MB · Saved 8.0 MB (84.7%) · 0 cached · 5.1s
```

Note that `client-photo-01.jpg` was converted to `client-photo-01.webp` in `./prepped/` (the report still shows the input filename for clarity).

## Common pitfalls

1. **Extensions change.** With `web-perf` active, `client-photo.jpg` becomes `client-photo.webp` and `logo.png` becomes `logo.avif` (or `.webp` if opaque). When you write the `<img src="...">`, use the new extension. The output filename always reflects the chosen target format.

2. **PNG smart routing surprise.** A transparent PNG goes to AVIF. AVIF has near-universal modern browser support (~95%), but if you need broader fallback (older Safari, embedded browsers), either:
   - Override the routing: `formatMatrix: { png: "webp" }` to force WebP.
   - Plan to add a `<picture>` block with a PNG fallback, wired up by hand in your markup.

3. **No responsive variants.** assetopt produces one optimized file per source. If you need `photo-320w.jpg`, `photo-640w.jpg`, `photo-1280w.jpg` for `srcset`, generate those widths separately (e.g. a dedicated sharp script) — assetopt does not rescale.

4. **Iterating on quality settings invalidates the cache.** If you tweak `jpeg.quality` from 82 to 78 and re-run, every JPEG is reprocessed (correctly — the config changed). If you're testing many quality values rapidly, run with `--no-cache` and just compare outputs visually.

5. **The `-o` flag is per-run.** It doesn't update your `.assetoptrc`. If you want a permanent destination, edit `output.dir` in the config instead of typing `-o` every time.

6. **Don't drop the staging folder under your build directory.** If `./incoming/` lives under `./public/` or `./src/`, your bundler may pick those raw assets up before you've prepped them. Keep staging outside your served paths.

## See also

- [Feature catalog → Smart format conversion](../features.md#smart-format-conversion)
- [Feature catalog → JSON output](../features.md#json-output---json) — useful if you want to script "show me only the files where savings > 70%"
- [Workflow: CI pre-deploy](./ci-predeploy.md)
- [Workflow: hand-written static site](./static-site.md)
