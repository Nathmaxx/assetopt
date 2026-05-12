# Workflow: hand-written static site

You write your HTML and CSS by hand. Your image references are literal: `<img src="/img/photo.jpg">`, `background-image: url('/img/bg.png')`. You want lighter assets, but you don't want to chase down every reference when filenames change.

This workflow uses assetopt strictly as a recompressor: it shrinks files, never converts formats. Every asset keeps its original extension.

## Prerequisites

- Source assets live in a stable directory (e.g. `public/images/` or `assets/`).
- You're OK with one of: replacing the originals in place, or serving from a sibling output directory.
- You're not generating the HTML from a build tool (otherwise see the [CI pre-deploy workflow](./ci-predeploy.md)).

## Recommended `.assetoptrc`

```json
{
  "images": {
    "quality": { "jpeg": 82, "png": 80, "webp": 82 },
    "stripMetadata": true
  },
  "css": { "minify": true },
  "js": { "minify": true },
  "svg": { "multipass": true },
  "output": { "dir": "./optimized" }
}
```

Note the absence of `"preset": "web-perf"` and of any `formatMatrix` entry that targets a different format. The defaults (`outputFormat: 'keep'`) are exactly what you want.

## Step by step

```bash
# One-time setup
assetopt init
# Edit .assetoptrc if you want to tweak quality

# Each time assets change
assetopt optimize public/images
```

Then pick **one** of the two integration patterns and stick with it:

### Pattern A — replace originals

```bash
assetopt optimize public/images
cp -r optimized/* public/images/
```

Simple, works with any web server. Downside: you lose the cache (the manifest lives in `optimized/`, which you just overwrote… nothing actually, but if you `mv` instead of `cp` you'd lose it).

### Pattern B — serve from `./optimized/` directly

Update your static server (nginx, Caddy, Vercel static hosting…) to serve `./optimized/` as the public root for that path. Originals stay in `public/images/` (and in git), and you can `git ignore optimized/` entirely.

```nginx
# nginx example
location /img/ {
    alias /var/www/site/optimized/images/;
}
```

This is the better long-term setup: the cache stays alive, originals stay version-controlled, and you can re-run `optimize` as often as you like.

## Expected terminal output

```
✓ config loaded from /home/me/site/.assetoptrc
Optimizing /home/me/site/public/images...

  image  banner.jpg                        2.3 MB  →   824.1 KB    -65.0%
  image  about-photo.jpg                   1.1 MB  →   389.2 KB    -64.5%
  image  team.png                          245.6 KB →    98.3 KB    -60.0%
  svg    favicon.svg                         8.4 KB →     2.1 KB    -75.0%

  4 files · 3.7 MB → 1.3 MB · Saved 2.4 MB (64.7%) · 0 cached · 3.1s
```

After integration (Pattern A) and a content-only edit, the next run shows:

```
  4 files · 3.7 MB → 1.3 MB · Saved 2.4 MB (64.7%) · 3 cached · 0.4s
```

## Common pitfalls

1. **Never enable `preset: 'web-perf'` here.** It rewrites `.jpg` to `.webp` and `.png` to `.avif`. Your HTML still says `<img src="banner.jpg">`. Result: 404s everywhere, no error from assetopt itself.

2. **Don't `mv optimized/* public/images/`** — the manifest (`.assetopt-cache.json`) goes with it and ends up in your served directory, which is messy and may even get exposed publicly. Use `cp` (Pattern A) or, better, serve from `./optimized/` (Pattern B).

3. **The `-o` flag overrides config.** If you sometimes run `assetopt optimize public/images -o ./tmp/` and other times rely on the config, you'll end up with optimized files in two places. Pick one source of truth for `output.dir`.

4. **EXIF stripping is on by default.** Useful for privacy on user-uploaded photos, but a problem for stock photography where attribution lives in IPTC metadata. Set `stripMetadata: false` for that case.

5. **SVG `minifyIds` is conservative.** It's off by default to protect inline SVGs that get referenced via `url(#myIcon)` from external CSS or sprite sheets. If your icons are self-contained (one SVG per file, no external references), turn it on for an extra 5-10%.

6. **Re-running on a `cp`-merged directory works, but is wasteful.** assetopt re-reads the originals every time. The cache helps (file content hasn't changed → marked `(cached)`), but the scan is still slow on large folders. Pattern B avoids this entirely.

## See also

- [Feature catalog → Per-asset-type optimization](../features.md#per-asset-type-optimization)
- [Feature catalog → Incremental cache](../features.md#incremental-cache)
- [Workflow: CI pre-deploy](./ci-predeploy.md)
- [Workflow: asset prep before integration](./asset-prep.md)
