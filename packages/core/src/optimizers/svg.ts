import { optimize } from 'svgo';
import type { SvgOptimizeOptions, SvgBufferResult } from '../types/index.js';

export const SVG_DEFAULTS = {
  multipass: true,
  minifyIds: false,
} satisfies SvgOptimizeOptions;

export function optimizeSvg(input: Buffer, options: SvgOptimizeOptions = {}): SvgBufferResult {
  const multipass = options.multipass ?? SVG_DEFAULTS.multipass;
  const minifyIds = options.minifyIds ?? SVG_DEFAULTS.minifyIds;

  const result = optimize(input.toString('utf-8'), {
    multipass,
    plugins: [
      {
        name: 'preset-default',
        params: {
          overrides: minifyIds ? {} : { cleanupIds: { minify: false } },
        },
      },
    ],
  });

  const outputBuffer = Buffer.from(result.data, 'utf-8');

  return {
    buffer: outputBuffer,
    originalSize: input.length,
    outputSize: outputBuffer.length,
  };
}
