import sharp from 'sharp';
import type {
  ImageOptimizeOptions,
  ImageBufferResult,
  ImageSourceFormat,
  ImageOutputFormat,
  FormatMatrixValue,
  FormatRoutingContext,
} from '../types/index.js';
import { IMAGE_SOURCE_FORMATS } from '../types/formats.js';

const SUPPORTED_INPUT_FORMATS: ReadonlySet<string> = new Set(IMAGE_SOURCE_FORMATS);

export const IMAGE_DEFAULTS = {
  outputFormat: 'keep',
  quality: { jpeg: 85, png: 80, webp: 82, avif: 75 },
  stripMetadata: true,
} satisfies ImageOptimizeOptions;

function normalizeInputFormat(format: string): ImageSourceFormat {
  if (format === 'heif') return 'avif'; // sharp reports AVIF files as 'heif'
  if (SUPPORTED_INPUT_FORMATS.has(format)) return format as ImageSourceFormat;
  return 'jpeg';
}

function resolveOutputFormat(
  inputFormat: ImageSourceFormat,
  outputFormat: ImageOutputFormat,
  formatMatrix: Partial<Record<ImageSourceFormat, FormatMatrixValue>> | undefined,
  context: FormatRoutingContext,
): ImageSourceFormat {
  const matrixValue = formatMatrix?.[inputFormat];
  if (matrixValue !== undefined) {
    const resolved = typeof matrixValue === 'function' ? matrixValue(context) : matrixValue;
    return resolved === 'keep' ? inputFormat : resolved;
  }
  if (outputFormat !== 'keep') return outputFormat;
  return inputFormat;
}

/**
 * Optimize an image buffer using sharp.
 *
 * The output format is resolved with this priority:
 *   1. `options.formatMatrix[inputFormat]` if defined (target format, `'keep'`, or a function)
 *   2. `options.outputFormat` if not `'keep'`
 *   3. The input format (no conversion)
 *
 * Function values in `formatMatrix` receive a `FormatRoutingContext` built from sharp
 * metadata (currently exposes `hasAlpha`). This is how the `web-perf` preset routes
 * PNG to WebP (opaque) or AVIF (transparent) automatically.
 *
 * Defaults come from `IMAGE_DEFAULTS` (quality 85/80/82/75 for jpeg/png/webp/avif,
 * `stripMetadata: true`, `outputFormat: 'keep'`).
 *
 * @param input - Image buffer. Supported source formats: JPEG, PNG, WebP, AVIF.
 *                Unrecognized formats fall back to JPEG handling.
 * @param options - All fields optional. See `ImageOptimizeOptions`.
 * @returns Resolved buffer with output format and size metadata.
 *
 * @example
 * ```ts
 * // Simple global conversion
 * await optimizeImage(buf, { outputFormat: 'webp' });
 *
 * // Per-format rules (JSON-serializable, usable in .assetoptrc)
 * await optimizeImage(buf, {
 *   formatMatrix: { jpeg: 'webp', png: 'avif', webp: 'keep', avif: 'keep' },
 * });
 *
 * // Smart routing (programmatic only — functions can't live in JSON)
 * await optimizeImage(buf, {
 *   formatMatrix: { png: (ctx) => ctx.hasAlpha ? 'avif' : 'webp' },
 * });
 * ```
 */
export async function optimizeImage(
  input: Buffer,
  options: ImageOptimizeOptions = {},
): Promise<ImageBufferResult> {
  const outputFormat = options.outputFormat ?? IMAGE_DEFAULTS.outputFormat;
  const quality = { ...IMAGE_DEFAULTS.quality, ...options.quality };
  const stripMetadata = options.stripMetadata ?? IMAGE_DEFAULTS.stripMetadata;

  const image = sharp(input);
  const metadata = await image.metadata();
  const inputFormat = normalizeInputFormat(metadata.format ?? 'jpeg');
  const targetFormat = resolveOutputFormat(inputFormat, outputFormat, options.formatMatrix, {
    hasAlpha: metadata.hasAlpha ?? false,
  });

  let pipeline = stripMetadata ? image : image.withMetadata();

  switch (targetFormat) {
    case 'jpeg':
      pipeline = pipeline.jpeg({ quality: quality.jpeg });
      break;
    case 'png':
      pipeline = pipeline.png({ quality: quality.png });
      break;
    case 'webp':
      pipeline = pipeline.webp({ quality: quality.webp });
      break;
    case 'avif':
      pipeline = pipeline.avif({ quality: quality.avif });
      break;
  }

  const outputBuffer = await pipeline.toBuffer();

  return {
    buffer: outputBuffer,
    format: targetFormat,
    originalSize: input.length,
    outputSize: outputBuffer.length,
  };
}
