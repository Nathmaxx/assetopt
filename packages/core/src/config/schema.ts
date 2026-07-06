import { z } from 'zod';
import type { AssetoptConfig } from '../types/index.js';
import {
  IMAGE_MATRIX_TARGETS,
  IMAGE_OUTPUT_FORMATS,
  IMAGE_SOURCE_FORMATS,
  PRESET_NAMES,
} from '../types/formats.js';

const imageQualitySchema = z.object({
  jpeg: z.number().min(1).max(100).optional(),
  png: z.number().min(1).max(100).optional(),
  webp: z.number().min(1).max(100).optional(),
  avif: z.number().min(1).max(100).optional(),
});

const matrixTargetSchema = z.enum(IMAGE_MATRIX_TARGETS);

const formatMatrixSchema = z
  .object({
    jpeg: matrixTargetSchema.optional(),
    png: matrixTargetSchema.optional(),
    webp: matrixTargetSchema.optional(),
    avif: matrixTargetSchema.optional(),
  })
  .strict();

const imageOptionsSchema = z.object({
  outputFormat: z.enum(IMAGE_OUTPUT_FORMATS).optional(),
  formatMatrix: formatMatrixSchema.optional(),
  quality: imageQualitySchema.optional(),
  stripMetadata: z.boolean().optional(),
  skip: z.array(z.enum(IMAGE_SOURCE_FORMATS)).optional(),
});

const cssOptionsSchema = z.object({
  minify: z.boolean().optional(),
});

const jsOptionsSchema = z.object({
  minify: z.boolean().optional(),
});

const svgOptionsSchema = z.object({
  multipass: z.boolean().optional(),
  minifyIds: z.boolean().optional(),
});

export const configSchema = z.object({
  preset: z.enum(PRESET_NAMES).optional(),
  input: z
    .object({
      include: z.array(z.string()).optional(),
      exclude: z.array(z.string()).optional(),
    })
    .optional(),
  images: imageOptionsSchema.optional(),
  css: cssOptionsSchema.optional(),
  js: jsOptionsSchema.optional(),
  svg: svgOptionsSchema.optional(),
  output: z
    .object({
      dir: z.string().optional(),
    })
    .optional(),
});

// Config and AssetoptConfig are intentionally the same: zod validates the JSON-friendly subset
// at .assetoptrc parse time, but AssetoptConfig also allows function values in formatMatrix
// for programmatic consumers (presets). z.output would be too narrow.
export type Config = AssetoptConfig;
