// Single source of truth for the format string sets used across types,
// zod schemas, and runtime checks. Adding a new format = touch one line here.

export const IMAGE_SOURCE_FORMATS = ['jpeg', 'png', 'webp', 'avif'] as const;
export const IMAGE_MATRIX_TARGETS = ['jpeg', 'png', 'webp', 'avif', 'keep'] as const;
export const IMAGE_OUTPUT_FORMATS = ['keep', 'webp', 'avif'] as const;
export const PRESET_NAMES = ['web-perf'] as const;

export type ImageSourceFormat = (typeof IMAGE_SOURCE_FORMATS)[number];
export type ImageMatrixTarget = (typeof IMAGE_MATRIX_TARGETS)[number];
export type ImageOutputFormat = (typeof IMAGE_OUTPUT_FORMATS)[number];
export type PresetName = (typeof PRESET_NAMES)[number];
