import type { AssetoptConfig, PresetName } from '../types/index.js';

// PNG smart routing: AVIF preserves transparency at smaller size than PNG,
// but for opaque images WebP is lighter than AVIF. So we route based on
// the actual presence of an alpha channel rather than the PNG container.
export const PRESETS: Record<PresetName, Partial<AssetoptConfig>> = {
  'web-perf': {
    images: {
      formatMatrix: {
        jpeg: 'webp',
        png: (ctx) => (ctx.hasAlpha ? 'avif' : 'webp'),
        webp: 'keep',
        avif: 'keep',
      },
    },
  },
};
