# @assetopt/core

Pure asset optimization functions for images (sharp), CSS (lightningcss), JS (esbuild), and SVG (svgo). The engine behind the [`@assetopt/cli`](https://www.npmjs.com/package/@assetopt/cli) command-line tool, exported as a standalone library for programmatic use.

Open source, MIT.

## Install

```bash
npm install @assetopt/core
```

## Quick start

```ts
import { optimizeImage, optimizeCss, optimizeJs, optimizeSvg } from '@assetopt/core';
import { readFile } from 'node:fs/promises';

const buf = await readFile('photo.jpg');
const result = await optimizeImage(buf, { quality: { jpeg: 80 } });

console.log(result.format); // 'jpeg'
console.log(result.originalSize); // 824133
console.log(result.outputSize); // 245912
console.log(result.buffer); // Buffer with optimized bytes
```

Every optimizer is a pure function: a buffer in, an optimized buffer out. No hidden I/O, no global state.

## API

### Optimizers

| Function                          | Underlying lib | Returns                      |
| --------------------------------- | -------------- | ---------------------------- |
| `optimizeImage(buffer, options?)` | `sharp`        | `Promise<ImageBufferResult>` |
| `optimizeCss(buffer, options?)`   | `lightningcss` | `CssBufferResult`            |
| `optimizeJs(buffer, options?)`    | `esbuild`      | `Promise<JsBufferResult>`    |
| `optimizeSvg(buffer, options?)`   | `svgo`         | `SvgBufferResult`            |

All option types are optional with sensible defaults:

- `ImageOptimizeOptions` — `{ outputFormat?, formatMatrix?, quality?, stripMetadata?, skip? }`
- `CssOptimizeOptions` — `{ minify? }`
- `JsOptimizeOptions` — `{ minify? }`
- `SvgOptimizeOptions` — `{ multipass?, minifyIds? }`

### Pipeline

For folder-level orchestration:

```ts
import { runPipeline, buildReport, loadConfig } from '@assetopt/core';

const { config } = await loadConfig(); // walk-up .assetoptrc
const assets = await runPipeline('./public', config);
const report = buildReport(assets, /* durationMs */ 0);
```

### Format matrix with smart routing

`formatMatrix` accepts function values for content-aware routing:

```ts
import { optimizeImage } from '@assetopt/core';

await optimizeImage(buf, {
  formatMatrix: {
    // AVIF for transparent PNGs, WebP for opaque ones
    png: (ctx) => (ctx.hasAlpha ? 'avif' : 'webp'),
    jpeg: 'webp',
    webp: 'keep',
    avif: 'keep',
  },
});
```

This is exactly how the built-in `web-perf` preset works.

### Exports

```ts
// Optimizers (pure functions)
export { optimizeImage, optimizeCss, optimizeJs, optimizeSvg };

// Pipeline / orchestration
export { dispatch, runPipeline, buildReport };

// Config
export { loadConfig, mergeConfig, resolveConfig, DEFAULTS, PRESETS };
export type { LoadedConfig };

// Utilities
export { scanDirectory, getAssetType, getFileSize };

// Types
export type {
  AssetType,
  AssetResult,
  OptimizeResult,
  ImageQualityOptions,
  ImageOptimizeOptions,
  ImageBufferResult,
  ImageSourceFormat,
  ImageMatrixTarget,
  FormatMatrixValue,
  FormatMatrixResolver,
  FormatRoutingContext,
  PresetName,
  CssOptimizeOptions,
  CssBufferResult,
  JsOptimizeOptions,
  JsBufferResult,
  SvgOptimizeOptions,
  SvgBufferResult,
  DispatchResult,
  AssetoptConfig,
};
```

## Documentation

- [Configuration reference](https://github.com/Nathmaxx/assetopt/blob/main/docs/config.md) — every option, every default, programmatic API for `formatMatrix` functions
- [Feature catalog](https://github.com/Nathmaxx/assetopt/blob/main/docs/features.md) — behavior of each optimizer in plain English
- [Project README](https://github.com/Nathmaxx/assetopt#readme)

For the command-line interface, see [`@assetopt/cli`](https://www.npmjs.com/package/@assetopt/cli).

## License

MIT.
