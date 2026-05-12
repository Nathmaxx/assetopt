export { optimizeImage } from './optimizers/images.js';
export { optimizeCss } from './optimizers/css.js';
export { optimizeJs } from './optimizers/js.js';
export { optimizeSvg } from './optimizers/svg.js';

export { dispatch } from './pipeline/dispatch.js';
export { runPipeline } from './pipeline/pipeline.js';

export { buildReport } from './analyzers/report.js';

export {
  loadConfig,
  mergeConfig,
  resolveConfig,
  DEFAULTS,
  type LoadedConfig,
} from './config/loader.js';
export { PRESETS } from './config/presets.js';

export { scanDirectory, getAssetType, getFileSize } from './utils/fs.js';

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
} from './types/index.js';
