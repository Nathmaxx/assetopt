import { describe, it, expect, beforeAll } from 'vitest';
import sharp from 'sharp';
import { dispatch } from '../dispatch.js';

let imageBuffer: Buffer;
const cssBuffer = Buffer.from('.a { color: red; }', 'utf-8');
const jsBuffer = Buffer.from('function hello() { return "world"; }', 'utf-8');
const svgBuffer = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>',
  'utf-8',
);

beforeAll(async () => {
  imageBuffer = await sharp({
    create: { width: 10, height: 10, channels: 3, background: { r: 255, g: 0, b: 0 } },
  })
    .jpeg()
    .toBuffer();
});

describe('dispatch', () => {
  describe('routing', () => {
    it('routes .jpg to image optimizer', async () => {
      const result = await dispatch('photo.jpg', imageBuffer);
      expect(result.assetType).toBe('image');
    });

    it('routes .png to image optimizer', async () => {
      const result = await dispatch('photo.png', imageBuffer);
      expect(result.assetType).toBe('image');
    });

    it('routes .css to css optimizer', async () => {
      const result = await dispatch('style.css', cssBuffer);
      expect(result.assetType).toBe('css');
    });

    it('routes .js to js optimizer', async () => {
      const result = await dispatch('app.js', jsBuffer);
      expect(result.assetType).toBe('js');
    });

    it('routes .mjs to js optimizer', async () => {
      const result = await dispatch('app.mjs', jsBuffer);
      expect(result.assetType).toBe('js');
    });

    it('routes .svg to svg optimizer', async () => {
      const result = await dispatch('icon.svg', svgBuffer);
      expect(result.assetType).toBe('svg');
    });

    it('throws for unsupported extension', async () => {
      await expect(dispatch('font.woff2', Buffer.from(''))).rejects.toThrow(
        'Unsupported asset type',
      );
    });

    it('throws for unknown extension', async () => {
      await expect(dispatch('file.xyz', Buffer.from(''))).rejects.toThrow('Unsupported asset type');
    });
  });

  describe('config forwarding', () => {
    it('forwards image config to optimizer', async () => {
      const result = await dispatch('photo.jpg', imageBuffer, {
        images: { outputFormat: 'webp' },
      });
      expect(result.assetType).toBe('image');
      if (result.assetType === 'image') {
        expect(result.format).toBe('webp');
      }
    });

    it('forwards css config to optimizer', async () => {
      const minified = await dispatch('style.css', cssBuffer, { css: { minify: true } });
      const notMinified = await dispatch('style.css', cssBuffer, { css: { minify: false } });
      expect(minified.outputSize).toBeLessThanOrEqual(notMinified.outputSize);
    });
  });

  describe('result shape', () => {
    it('always returns originalSize and outputSize', async () => {
      const result = await dispatch('style.css', cssBuffer);
      expect(result.originalSize).toBe(cssBuffer.length);
      expect(result.outputSize).toBe(result.buffer.length);
    });
  });
});
