import { transform } from 'lightningcss';
import type { CssOptimizeOptions, CssBufferResult } from '../types/index.js';

export const CSS_DEFAULTS = {
  minify: true,
} satisfies CssOptimizeOptions;

export function optimizeCss(input: Buffer, options: CssOptimizeOptions = {}): CssBufferResult {
  const minify = options.minify ?? CSS_DEFAULTS.minify;

  const { code } = transform({
    filename: 'style.css',
    code: input,
    minify,
  });

  return {
    buffer: Buffer.from(code),
    originalSize: input.length,
    outputSize: code.length,
  };
}
