import { getAssetType } from '../utils/fs.js';
import { optimizeImage } from '../optimizers/images.js';
import { optimizeCss } from '../optimizers/css.js';
import { optimizeJs } from '../optimizers/js.js';
import { optimizeSvg } from '../optimizers/svg.js';
import type { AssetoptConfig, DispatchResult } from '../types/index.js';

export async function dispatch(
  filePath: string,
  buffer: Buffer,
  config: AssetoptConfig = {},
): Promise<DispatchResult> {
  const assetType = getAssetType(filePath);

  switch (assetType) {
    case 'image': {
      const result = await optimizeImage(buffer, config.images);
      return { ...result, assetType: 'image' };
    }
    case 'css': {
      const result = optimizeCss(buffer, config.css);
      return { ...result, assetType: 'css' };
    }
    case 'js': {
      const result = await optimizeJs(buffer, config.js);
      return { ...result, assetType: 'js' };
    }
    case 'svg': {
      const result = optimizeSvg(buffer, config.svg);
      return { ...result, assetType: 'svg' };
    }
    default:
      throw new Error(`Unsupported asset type for file: ${filePath}`);
  }
}
