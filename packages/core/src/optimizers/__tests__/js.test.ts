import { describe, it, expect } from 'vitest';
import { optimizeJs } from '../js.js';

const SAMPLE_JS = `
// Utility functions
function calculateTotal(items) {
  return items.reduce(function(accumulator, currentItem) {
    return accumulator + currentItem.price;
  }, 0);
}

function formatPrice(amount) {
  if (amount === null || amount === undefined) {
    return '0.00';
  }
  return amount.toFixed(2);
}

const isEven = function(number) {
  if (number % 2 === 0) {
    return true;
  } else {
    return false;
  }
};

module.exports = { calculateTotal, formatPrice, isEven };
`;

const inputBuffer = Buffer.from(SAMPLE_JS, 'utf-8');

describe('optimizeJs', () => {
  describe('minification', () => {
    it('reduces output size', async () => {
      const result = await optimizeJs(inputBuffer);
      expect(result.outputSize).toBeLessThan(result.originalSize);
    });

    it('removes comments', async () => {
      const result = await optimizeJs(inputBuffer);
      expect(result.buffer.toString('utf-8')).not.toContain('//');
    });

    it('removes internal whitespace', async () => {
      const result = await optimizeJs(inputBuffer);
      // esbuild appends a trailing newline (POSIX convention) — only that one is expected
      expect(result.buffer.toString('utf-8').trimEnd()).not.toMatch(/\n/);
    });

    it('produces larger output with minify: false', async () => {
      const minified = await optimizeJs(inputBuffer, { minify: true });
      const notMinified = await optimizeJs(inputBuffer, { minify: false });
      expect(notMinified.outputSize).toBeGreaterThan(minified.outputSize);
    });

    it('simplifies syntax (minifySyntax)', async () => {
      const redundant = Buffer.from(
        'function isEven(n) { if (n % 2 === 0) { return true; } else { return false; } }',
        'utf-8',
      );
      const result = await optimizeJs(redundant);
      expect(result.outputSize).toBeLessThan(redundant.length);
    });
  });

  describe('size tracking', () => {
    it('reports correct originalSize', async () => {
      const result = await optimizeJs(inputBuffer);
      expect(result.originalSize).toBe(inputBuffer.length);
    });

    it('reports correct outputSize', async () => {
      const result = await optimizeJs(inputBuffer);
      expect(result.outputSize).toBe(result.buffer.length);
    });
  });

  describe('output validity', () => {
    it('works with no options (all defaults)', async () => {
      await expect(optimizeJs(inputBuffer)).resolves.toBeDefined();
    });

    it('works with empty JS', async () => {
      const result = await optimizeJs(Buffer.from('', 'utf-8'));
      expect(result.buffer.length).toBe(0);
    });
  });
});
