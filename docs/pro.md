# assetopt Pro — overview

**Pro is the integration layer on top of `@assetopt/core`.** The free CLI optimizes a folder on demand. Pro automates that into your daily workflow — build pipelines, your editor, CI bots, shareable reports — and adds the build-time features that turn raw byte savings into measurable Lighthouse gains.

> **Status: not released yet.** No dates, no signup form. This page lists what's planned so you can decide whether to wait for it or build the missing pieces yourself.

Pro will live in a separate, private repo (`assetopt-pro`) and depend on `@assetopt/core` like any other consumer of the public package.

---

## How it differs from the free CLI

|                                     | Free CLI                                    | Pro                                                                           |
| ----------------------------------- | ------------------------------------------- | ----------------------------------------------------------------------------- |
| **Mode**                            | One-shot, on-demand (`assetopt optimize`)   | Continuous — build plugins, editor, CI                                        |
| **Format conversion in production** | Safe only when you control HTML integration | Safe everywhere — plugins rewrite imports automatically                       |
| **Output**                          | Optimized files in `./optimized/`           | Optimized files **+** auto-injected `<picture>` / `srcset` / `loading="lazy"` |
| **Lighthouse impact**               | Indirect (smaller files)                    | Direct (responsive variants + modern formats served correctly)                |
| **License**                         | MIT                                         | Paid one-shot, source available to license holders                            |

---

## Star features — the main reason to upgrade

### Vite plugin

Hooks into the Vite build, optimizes assets in-place, and rewrites imports so format conversion (`jpeg → webp`, `png → avif`) becomes safe by default. Zero config needed beyond installing the plugin.

### Next.js plugin

Same idea for Next.js — works with the App Router and Pages Router, integrates with `next/image` where relevant. Webpack-only paths supported if traction justifies it.

### VS Code extension

Optimizes assets on save, shows the byte savings inline in the editor gutter (e.g. `-72%` next to a freshly-saved JPEG). Useful in itself, viral when shared in a screenshot.

### Shareable HTML report

After every optimize run, generate a self-contained HTML page with before/after comparisons (visual diff for images, byte breakdown for code). One click to publish a public link or export a PNG card — built for Twitter posts and for freelances who need to show a client what was done.

---

## Performance features — measurable Lighthouse gains

These are the features that turn assetopt from "smaller files" to "better Core Web Vitals". They're the differentiator most competitors miss.

### Responsive variant generation

```json
{ "images": { "responsive": [320, 640, 1280, 1920] } }
```

Generates `photo-320w.jpg`, `photo-640w.jpg`, `photo-1280w.jpg`, `photo-1920w.jpg` from a single source, ready to feed a `<picture>` block. Aspect ratio preserved (proportional resize, no crop).

### Automatic `<picture>` / `srcset` / `loading="lazy"` injection

When the build plugin (Vite/Next) sees an `<img>` tag in the built HTML, it rewrites it to a full `<picture>` block: modern format with fallback, `srcset` with the responsive variants from the previous feature, and `loading="lazy"` on offscreen images. The user-facing HTML stays clean (`<img src="...">`); the heavy lifting happens at build time.

This is what turns assetopt's optimizations into actual Lighthouse points.

---

## Power-user features — quality-of-life carrots

These features are functional but volontarily reserved to Pro to keep the free CLI focused on its core value.

### Watch mode

Real-time directory watching during local dev. Modify an asset, the optimized output updates within milliseconds. Useful when you're iterating on quality settings or working with a designer dropping new files.

### Parallel processing

Worker-thread based pipeline for projects with many assets (500+). Roughly 5x faster on a typical 8-core machine. The free CLI is single-threaded for simplicity and predictable resource usage; Pro uses your full CPU.

### Advanced CI/CD integration

- **PR comments**: a GitHub/GitLab bot posts the savings table directly on the pull request.
- **Per-file thresholds**: fail CI if a single image regresses more than X%, not just the global savings (which the free `--min-savings` already covers).
- **Slack notifications**: ping a channel when a deploy ships with degraded asset quality.

---

## Pricing direction

The target is **single developers and small teams** — freelances, indie hackers, agencies under 10 devs. The first product is intentionally simple and accessible, sized for indie/freelance budgets rather than enterprise contracts.

Pricing is **a one-shot purchase** (per developer, with team licenses available). No subscriptions, no per-seat monthly bills, no usage-based billing. You buy it once, you own that version forever; future major versions may be paid upgrades.

Final pricing isn't set yet and will be confirmed at launch.

---

## What stays in the free CLI forever

This is a hard commitment. The free CLI is not crippleware:

- All four asset types (images, CSS, JS, SVG)
- All quality and metadata options
- The `web-perf` preset and the full `formatMatrix` system
- The incremental cache
- The `analyze`, `audit`, and `init` commands
- The `--min-savings` global quality gate
- JSON output

Anything currently in [features.md](./features.md) is yours, MIT, forever. Pro adds new things on top — it doesn't take anything away.

---

## Status

Not released. The roadmap and feature list above can shift before launch. There's no early-access program or signup form right now.

To follow progress, watch the [GitHub repository](https://github.com/Nathmaxx/assetopt). The Pro release announcement will go there first.

---

## See also

- [README — About assetopt Pro](../README.md#about-assetopt-pro) — short heads-up
- [FAQ — Free CLI vs Pro](./faq.md#whats-the-difference-between-the-free-cli-and-assetopt-pro) — TL;DR
- [Feature catalog](./features.md) — what's already in the free CLI
