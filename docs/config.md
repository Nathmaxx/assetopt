# Configuration reference

Exhaustive reference for `.assetoptrc`. For higher-level guidance see the [feature catalog](./features.md), for command-line flags see the [CLI reference](./cli.md).

The config file is a plain JSON object validated with [zod](https://zod.dev/) at load time. Both `.assetoptrc` and `.assetoptrc.json` are accepted. Unknown keys at the top level are tolerated; **unknown keys inside `images.formatMatrix` are rejected** to catch typos early.

---

## Quick example

```json
{
  "preset": "web-perf",
  "images": {
    "outputFormat": "keep",
    "formatMatrix": { "avif": "keep" },
    "quality": { "jpeg": 85, "png": 80, "webp": 82, "avif": 75 },
    "stripMetadata": true,
    "skip": ["avif"]
  },
  "css": { "minify": true },
  "js": { "minify": true },
  "svg": { "multipass": true, "minifyIds": false },
  "output": { "dir": "./optimized" }
}
```

Every field is optional. The minimum viable config is `{}` — everything falls back to documented defaults.

---

## Top-level fields

| Field    | Type         | Default                                 | Description                                                                                     |
| -------- | ------------ | --------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `preset` | `"web-perf"` | _none_                                  | Apply a built-in config preset before merging the rest of your config. See [Presets](#presets). |
| `images` | `object`     | `IMAGE_DEFAULTS`                        | Image optimization options. See [`images`](#images).                                            |
| `css`    | `object`     | `{ minify: true }`                      | CSS optimization options. See [`css`](#css).                                                    |
| `js`     | `object`     | `{ minify: true }`                      | JavaScript optimization options. See [`js`](#js).                                               |
| `svg`    | `object`     | `{ multipass: true, minifyIds: false }` | SVG optimization options. See [`svg`](#svg).                                                    |
| `output` | `object`     | `{ dir: "./optimized" }`                | Output settings. See [`output`](#output).                                                       |

---

## Presets

### `preset`

|                 |                                           |
| --------------- | ----------------------------------------- |
| **Type**        | `"web-perf"`                              |
| **Default**     | _none_                                    |
| **Constraints** | Must be one of the supported preset names |

Currently a single preset is shipped:

- **`web-perf`** — converts to modern formats automatically: `jpeg → webp`, `png → webp` (opaque) or `avif` (transparent), `webp` and `avif` left as-is. Implemented as a `formatMatrix` whose `png` entry is a function reading `hasAlpha` metadata.

```json
{ "preset": "web-perf" }
```

When set, the preset's config is layered on top of `DEFAULTS` and below your user config — see [Resolution order](#resolution-order).

---

## `images`

### `images.outputFormat`

|                 |                                                                                                                                 |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **Type**        | `"keep" \| "webp" \| "avif"`                                                                                                    |
| **Default**     | `"keep"`                                                                                                                        |
| **Constraints** | Must be one of the listed values. `"jpeg"` and `"png"` are not accepted as a global output format — use `formatMatrix` instead. |

Global output format applied to every image when no `formatMatrix` entry overrides it.

```json
{ "images": { "outputFormat": "webp" } }
```

`"keep"` means "recompress, keep the original format and extension".

### `images.formatMatrix`

|                 |                                                                                                                                                                 |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Type**        | `Partial<Record<"jpeg"\|"png"\|"webp"\|"avif", "jpeg"\|"png"\|"webp"\|"avif"\|"keep">>`                                                                         |
| **Default**     | _none_ (unless set by a preset)                                                                                                                                 |
| **Constraints** | Strict object — unknown keys are rejected at parse time. Function values are valid programmatically but not in JSON. See [Programmatic API](#programmatic-api). |

Per-source-format conversion rules. Takes precedence over `outputFormat`. The value `"keep"` explicitly excludes a format from conversion.

```json
{
  "images": {
    "formatMatrix": {
      "jpeg": "webp",
      "png": "keep",
      "webp": "keep",
      "avif": "keep"
    }
  }
}
```

**Resolution priority for any source image**: `formatMatrix[source]` (if defined) > `outputFormat` > source format (no-op).

### `images.quality`

|                 |                                                                 |
| --------------- | --------------------------------------------------------------- |
| **Type**        | `{ jpeg?: number, png?: number, webp?: number, avif?: number }` |
| **Defaults**    | `{ jpeg: 85, png: 80, webp: 82, avif: 75 }`                     |
| **Constraints** | Each value must be an integer between 1 and 100 inclusive       |

Per-format compression quality. Higher = better visual fidelity, larger files.

```json
{ "images": { "quality": { "jpeg": 80, "avif": 70 } } }
```

Partial overrides are deep-merged: setting `quality.jpeg` to 80 leaves `png`, `webp`, and `avif` at their defaults.

### `images.stripMetadata`

|             |           |
| ----------- | --------- |
| **Type**    | `boolean` |
| **Default** | `true`    |

When `true`, EXIF and ICC profile data is removed from the output. Set to `false` for stock photography where attribution lives in IPTC metadata.

```json
{ "images": { "stripMetadata": false } }
```

### `images.skip`

|                 |                                              |
| --------------- | -------------------------------------------- |
| **Type**        | `Array<"jpeg" \| "png" \| "webp" \| "avif">` |
| **Default**     | `[]`                                         |
| **Constraints** | Each entry must be a supported source format |

List of source formats to ignore entirely. Skipped files are not read, not written, not cached, and absent from the report.

```json
{ "images": { "skip": ["avif"] } }
```

**Different from `formatMatrix: { X: "keep" }`** — `skip` removes the file from the pipeline; `"keep"` recompresses without changing format. See [features.md → Skip by format](./features.md#skip-by-format).

---

## `css`

### `css.minify`

|             |           |
| ----------- | --------- |
| **Type**    | `boolean` |
| **Default** | `true`    |

When `true`, CSS is minified via `lightningcss`. When `false`, the input is passed through unchanged.

```json
{ "css": { "minify": false } }
```

---

## `js`

### `js.minify`

|             |           |
| ----------- | --------- |
| **Type**    | `boolean` |
| **Default** | `true`    |

When `true`, JS is minified via `esbuild` (whitespace + identifiers + syntax). When `false`, the input is passed through unchanged.

```json
{ "js": { "minify": false } }
```

---

## `svg`

### `svg.multipass`

|             |           |
| ----------- | --------- |
| **Type**    | `boolean` |
| **Default** | `true`    |

When `true`, `svgo` re-applies its optimization pass until the output stops shrinking. Slower but more thorough. Disable for faster runs on very large SVG batches.

### `svg.minifyIds`

|             |           |
| ----------- | --------- |
| **Type**    | `boolean` |
| **Default** | `false`   |

When `true`, SVG `id` attributes are renamed to short forms. Disabled by default because external CSS or sprite references (`url(#myIcon)`) can break. Safe to enable for self-contained inline icons.

```json
{ "svg": { "multipass": true, "minifyIds": true } }
```

---

## `output`

### `output.dir`

|             |                 |
| ----------- | --------------- |
| **Type**    | `string`        |
| **Default** | `"./optimized"` |

Destination directory for the optimized assets. Resolved relative to the directory where you invoke the CLI (or the absolute path if provided). Created automatically if it doesn't exist.

```json
{ "output": { "dir": "./public/optimized" } }
```

The cache manifest is always written at `<output.dir>/.assetopt-cache.json`.

**Override per run**: pass `-o, --output <dir>` to `optimize` or `analyze` to override this for a single invocation, without touching `.assetoptrc`. See [CLI reference → optimize](./cli.md#assetopt-optimize-dir).

---

## Resolution order

When `loadConfig()` runs, it merges configurations in this order (each step deep-merges over the previous):

1. **`DEFAULTS`** — built-in defaults from each optimizer (`IMAGE_DEFAULTS`, `CSS_DEFAULTS`, `JS_DEFAULTS`, `SVG_DEFAULTS`, `output.dir = './optimized'`).
2. **Preset** (if `preset` is set) — e.g. `web-perf` injects its `formatMatrix`.
3. **User config** — your `.assetoptrc`, validated by zod.

For `images.formatMatrix` and `images.quality`, the merge is **per-key**: setting `quality.jpeg = 80` keeps the default `png`, `webp`, `avif`. Setting `formatMatrix.jpeg = "webp"` doesn't wipe out the preset's other entries.

For everything else, the merge is **per-object**: `{ css: { minify: false } }` replaces the entire `css` object.

---

## Programmatic API

The `.assetoptrc` is the JSON-serializable surface of the config. The full TypeScript type `AssetoptConfig` (from `@assetopt/core`) accepts a richer shape — specifically, `formatMatrix` values can be **functions** for content-aware routing.

```ts
import { runPipeline, type AssetoptConfig } from '@assetopt/core';

const config: AssetoptConfig = {
  images: {
    formatMatrix: {
      // Smart routing: AVIF for transparent PNGs, WebP for opaque ones
      png: (ctx) => (ctx.hasAlpha ? 'avif' : 'webp'),

      // Static target for the rest
      jpeg: 'webp',
      webp: 'keep',
      avif: 'keep',
    },
  },
};

await runPipeline('./public', config);
```

### `FormatMatrixResolver`

A function that takes a `FormatRoutingContext` and returns a target format (or `'keep'`):

```ts
type FormatRoutingContext = { hasAlpha: boolean };
type FormatMatrixResolver = (
  ctx: FormatRoutingContext,
) => 'jpeg' | 'png' | 'webp' | 'avif' | 'keep';
```

This is exactly how the `web-perf` preset implements its PNG smart routing.

### Cache invalidation with functions

When a function is used in `formatMatrix`, its body is hashed via `Function.prototype.toString()` for cache-key computation. Editing the function body invalidates the cache for affected files automatically.

---

## Validation and errors

The CLI runs `configSchema.parse()` on every load. Failures throw with a clear message and exit code 1:

```
Error: Invalid /home/me/proj/.assetoptrc: <zod error message>
```

Common validation errors:

| Cause                           | Example message fragment                                                                                                                                      |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Wrong type                      | `Expected boolean, received string`                                                                                                                           |
| Out-of-range quality            | `Number must be greater than or equal to 1` / `less than or equal to 100`                                                                                     |
| Unknown source format in `skip` | `Invalid enum value. Expected 'jpeg' \| 'png' \| 'webp' \| 'avif'`                                                                                            |
| Unknown key in `formatMatrix`   | `Unrecognized key(s) in object: '...'` (strict object)                                                                                                        |
| Unknown preset name             | `Invalid enum value. Expected 'web-perf'`                                                                                                                     |
| Invalid global `outputFormat`   | `Invalid enum value. Expected 'keep' \| 'webp' \| 'avif'` (note: `'jpeg'` and `'png'` are intentionally not accepted globally — use `formatMatrix` for those) |

All other top-level keys are tolerated silently (forward-compat with future fields). To get an explicit error on unknown root keys, run your config through your own validator first.

---

## See also

- [CLI reference](./cli.md) — flags and exit codes
- [Feature catalog](./features.md) — behavior of each feature in plain English
- [Workflow guides](./workflows/) — recommended config per integration pattern
- [FAQ](./faq.md) — common configuration questions
