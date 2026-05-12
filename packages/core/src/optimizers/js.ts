import { transform } from 'esbuild';
import type { JsOptimizeOptions, JsBufferResult } from '../types/index.js';

export const JS_DEFAULTS = {
  minify: true,
} satisfies JsOptimizeOptions;

export async function optimizeJs(
  input: Buffer,
  options: JsOptimizeOptions = {},
): Promise<JsBufferResult> {
  const minify = options.minify ?? JS_DEFAULTS.minify;

  const { code } = await transform(input.toString('utf-8'), {
    minifyWhitespace: minify,
    minifyIdentifiers: minify,
    minifySyntax: minify,
  });

  const outputBuffer = Buffer.from(code, 'utf-8');

  return {
    buffer: outputBuffer,
    originalSize: input.length,
    outputSize: outputBuffer.length,
  };
}
