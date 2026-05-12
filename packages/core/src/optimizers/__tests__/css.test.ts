import { describe, it, expect } from 'vitest';
import { optimizeCss } from '../css.js';

const SAMPLE_CSS = `
/* Main layout */
.container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  margin: 0 auto;
}

/* Button styles */
.button {
  background-color: #007bff;
  color: #ffffff;
  border: none;
  border-radius: 4px;
  padding: 8px 16px;
  cursor: pointer;
}

.button:hover {
  background-color: #0056b3;
}
`;

const inputBuffer = Buffer.from(SAMPLE_CSS, 'utf-8');

describe('optimizeCss', () => {
  describe('minification', () => {
    it('reduces output size', () => {
      const result = optimizeCss(inputBuffer);
      expect(result.outputSize).toBeLessThan(result.originalSize);
    });

    it('removes comments', () => {
      const result = optimizeCss(inputBuffer);
      expect(result.buffer.toString('utf-8')).not.toContain('/*');
    });

    it('removes whitespace', () => {
      const result = optimizeCss(inputBuffer);
      const output = result.buffer.toString('utf-8');
      expect(output).not.toMatch(/\n/);
    });

    it('produces larger output with minify: false', () => {
      const minified = optimizeCss(inputBuffer, { minify: true });
      const notMinified = optimizeCss(inputBuffer, { minify: false });
      expect(notMinified.outputSize).toBeGreaterThan(minified.outputSize);
    });
  });

  describe('size tracking', () => {
    it('reports correct originalSize', () => {
      const result = optimizeCss(inputBuffer);
      expect(result.originalSize).toBe(inputBuffer.length);
    });

    it('reports correct outputSize', () => {
      const result = optimizeCss(inputBuffer);
      expect(result.outputSize).toBe(result.buffer.length);
    });
  });

  describe('output validity', () => {
    it('preserves all selectors', () => {
      const result = optimizeCss(inputBuffer);
      const output = result.buffer.toString('utf-8');
      expect(output).toContain('.container');
      expect(output).toContain('.button');
      expect(output).toContain('.button:hover');
    });

    it('works with no options (all defaults)', () => {
      expect(() => optimizeCss(inputBuffer)).not.toThrow();
    });

    it('works with empty CSS', () => {
      const result = optimizeCss(Buffer.from('', 'utf-8'));
      expect(result.buffer.length).toBe(0);
    });
  });
});
