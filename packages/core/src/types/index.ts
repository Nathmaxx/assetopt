export type {
  ImageSourceFormat,
  ImageMatrixTarget,
  ImageOutputFormat,
  PresetName,
} from './formats.js';

import type {
  ImageSourceFormat,
  ImageMatrixTarget,
  ImageOutputFormat,
  PresetName,
} from './formats.js';

export type AssetType = 'image' | 'css' | 'js' | 'svg';

export interface AssetResult {
  inputPath: string;
  outputPath: string;
  inputSize: number;
  outputSize: number;
  savedBytes: number;
  savedPercent: number;
  assetType: AssetType;
  durationMs: number;
  cached: boolean;
  /**
   * Set when this asset could not be processed (corrupt input, optimizer
   * failure, output path collision…). The pipeline keeps going: the asset is
   * reported with `savedBytes: 0` and nothing is written for it.
   */
  error?: string;
}

export interface OptimizeResult {
  assets: AssetResult[];
  totalInputSize: number;
  totalOutputSize: number;
  totalSavedBytes: number;
  totalSavedPercent: number;
  durationMs: number;
  cachedCount: number;
  /** Number of assets whose processing failed (see {@link AssetResult.error}). */
  errorCount: number;
}

export interface ImageQualityOptions {
  jpeg?: number;
  png?: number;
  webp?: number;
  avif?: number;
}

export interface FormatRoutingContext {
  hasAlpha: boolean;
}

export type FormatMatrixResolver = (ctx: FormatRoutingContext) => ImageMatrixTarget;

export type FormatMatrixValue = ImageMatrixTarget | FormatMatrixResolver;

export interface ImageOptimizeOptions {
  outputFormat?: ImageOutputFormat;
  formatMatrix?: Partial<Record<ImageSourceFormat, FormatMatrixValue>>;
  quality?: ImageQualityOptions;
  stripMetadata?: boolean;
  skip?: ImageSourceFormat[];
}

export interface ImageBufferResult {
  buffer: Buffer;
  format: ImageSourceFormat;
  originalSize: number;
  outputSize: number;
}

export interface CssOptimizeOptions {
  minify?: boolean;
}

export interface CssBufferResult {
  buffer: Buffer;
  originalSize: number;
  outputSize: number;
}

export interface JsOptimizeOptions {
  minify?: boolean;
}

export interface JsBufferResult {
  buffer: Buffer;
  originalSize: number;
  outputSize: number;
}

export interface SvgOptimizeOptions {
  multipass?: boolean;
  minifyIds?: boolean;
}

export interface SvgBufferResult {
  buffer: Buffer;
  originalSize: number;
  outputSize: number;
}

export type DispatchResult =
  | (ImageBufferResult & { assetType: 'image' })
  | (CssBufferResult & { assetType: 'css' })
  | (JsBufferResult & { assetType: 'js' })
  | (SvgBufferResult & { assetType: 'svg' });

export interface AssetoptConfig {
  preset?: PresetName;
  /**
   * Source selection. Globs are matched against the path *relative to the
   * scanned directory*, with posix separators (e.g. `drafts/**`, `*.min.js`).
   * `include` keeps only matching files (when non-empty); `exclude` then
   * removes matches. Neither affects the optimized bytes, so changing them
   * never invalidates the cache.
   */
  input?: {
    include?: string[];
    exclude?: string[];
  };
  images?: ImageOptimizeOptions;
  css?: CssOptimizeOptions;
  js?: JsOptimizeOptions;
  svg?: SvgOptimizeOptions;
  output?: {
    dir?: string;
  };
}
