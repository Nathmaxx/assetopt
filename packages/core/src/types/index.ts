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
}

export interface OptimizeResult {
  assets: AssetResult[];
  totalInputSize: number;
  totalOutputSize: number;
  totalSavedBytes: number;
  totalSavedPercent: number;
  durationMs: number;
  cachedCount: number;
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
  images?: ImageOptimizeOptions;
  css?: CssOptimizeOptions;
  js?: JsOptimizeOptions;
  svg?: SvgOptimizeOptions;
  output?: {
    dir?: string;
  };
}
