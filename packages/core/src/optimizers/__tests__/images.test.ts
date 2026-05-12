import { describe, it, expect, beforeAll } from 'vitest';
import sharp from 'sharp';
import { optimizeImage } from '../images.js';
import { resolveConfig } from '../../config/loader.js';

let jpegBuffer: Buffer;
let pngBuffer: Buffer;
let pngOpaqueBuffer: Buffer;
let pngTransparentBuffer: Buffer;
let webpBuffer: Buffer;

beforeAll(async () => {
  jpegBuffer = await sharp({
    create: { width: 200, height: 200, channels: 3, background: { r: 255, g: 100, b: 50 } },
  })
    .jpeg({ quality: 100 })
    .toBuffer();

  pngBuffer = await sharp({
    create: { width: 200, height: 200, channels: 4, background: { r: 50, g: 200, b: 100, alpha: 1 } },
  })
    .png()
    .toBuffer();

  pngOpaqueBuffer = await sharp({
    create: { width: 200, height: 200, channels: 3, background: { r: 50, g: 200, b: 100 } },
  })
    .png()
    .toBuffer();

  pngTransparentBuffer = await sharp({
    create: { width: 200, height: 200, channels: 4, background: { r: 50, g: 200, b: 100, alpha: 0.5 } },
  })
    .png()
    .toBuffer();

  webpBuffer = await sharp({
    create: { width: 200, height: 200, channels: 3, background: { r: 100, g: 150, b: 200 } },
  })
    .webp({ quality: 100 })
    .toBuffer();
});

describe('optimizeImage', () => {
  describe('format preservation (outputFormat: "keep")', () => {
    it('keeps JPEG format', async () => {
      const result = await optimizeImage(jpegBuffer);
      expect(result.format).toBe('jpeg');
    });

    it('keeps PNG format', async () => {
      const result = await optimizeImage(pngBuffer);
      expect(result.format).toBe('png');
    });

    it('keeps WebP format', async () => {
      const result = await optimizeImage(webpBuffer);
      expect(result.format).toBe('webp');
    });
  });

  describe('format conversion', () => {
    it('converts JPEG to WebP', async () => {
      const result = await optimizeImage(jpegBuffer, { outputFormat: 'webp' });
      expect(result.format).toBe('webp');
      const meta = await sharp(result.buffer).metadata();
      expect(meta.format).toBe('webp');
    });

    it('converts PNG to WebP', async () => {
      const result = await optimizeImage(pngBuffer, { outputFormat: 'webp' });
      expect(result.format).toBe('webp');
    });

    it('converts JPEG to AVIF', async () => {
      const result = await optimizeImage(jpegBuffer, { outputFormat: 'avif' });
      expect(result.format).toBe('avif');
      const meta = await sharp(result.buffer).metadata();
      expect(meta.format).toBe('heif');
    });
  });

  describe('format matrix', () => {
    it('applies matrix entry on matching source format', async () => {
      const result = await optimizeImage(jpegBuffer, {
        formatMatrix: { jpeg: 'webp' },
      });
      expect(result.format).toBe('webp');
    });

    it('matrix entry takes priority over outputFormat', async () => {
      const result = await optimizeImage(pngBuffer, {
        outputFormat: 'avif',
        formatMatrix: { png: 'webp' },
      });
      expect(result.format).toBe('webp');
    });

    it('falls back to outputFormat when source not in matrix', async () => {
      const result = await optimizeImage(jpegBuffer, {
        outputFormat: 'avif',
        formatMatrix: { png: 'webp' },
      });
      expect(result.format).toBe('avif');
    });

    it('matrix value "keep" preserves source format even with outputFormat set', async () => {
      const result = await optimizeImage(pngBuffer, {
        outputFormat: 'avif',
        formatMatrix: { png: 'keep' },
      });
      expect(result.format).toBe('png');
    });

    it('falls back to source format when no matrix entry and no outputFormat', async () => {
      const result = await optimizeImage(jpegBuffer, {
        formatMatrix: { png: 'webp' },
      });
      expect(result.format).toBe('jpeg');
    });
  });

  describe('format matrix — function values', () => {
    it('calls function with hasAlpha context and uses returned target', async () => {
      const result = await optimizeImage(pngOpaqueBuffer, {
        formatMatrix: {
          png: (ctx) => (ctx.hasAlpha ? 'avif' : 'webp'),
        },
      });
      expect(result.format).toBe('webp');
    });

    it('function returning "keep" preserves source format', async () => {
      const result = await optimizeImage(pngTransparentBuffer, {
        outputFormat: 'avif',
        formatMatrix: {
          png: () => 'keep',
        },
      });
      expect(result.format).toBe('png');
    });
  });

  describe('web-perf preset — smart PNG routing', () => {
    it('routes opaque PNG to WebP', async () => {
      const config = resolveConfig({ preset: 'web-perf' });
      const result = await optimizeImage(pngOpaqueBuffer, config.images);
      expect(result.format).toBe('webp');
    });

    it('routes transparent PNG to AVIF', async () => {
      const config = resolveConfig({ preset: 'web-perf' });
      const result = await optimizeImage(pngTransparentBuffer, config.images);
      expect(result.format).toBe('avif');
    });

    it('routes JPEG to WebP (static rule, no smart logic)', async () => {
      const config = resolveConfig({ preset: 'web-perf' });
      const result = await optimizeImage(jpegBuffer, config.images);
      expect(result.format).toBe('webp');
    });

    it('user can override the smart PNG rule with a static value', async () => {
      const config = resolveConfig({
        preset: 'web-perf',
        images: { formatMatrix: { png: 'avif' } },
      });
      const result = await optimizeImage(pngOpaqueBuffer, config.images);
      expect(result.format).toBe('avif');
    });
  });

  describe('size tracking', () => {
    it('reports correct originalSize', async () => {
      const result = await optimizeImage(jpegBuffer);
      expect(result.originalSize).toBe(jpegBuffer.length);
    });

    it('reports correct outputSize', async () => {
      const result = await optimizeImage(jpegBuffer);
      expect(result.outputSize).toBe(result.buffer.length);
    });

    it('produces a smaller output with low quality', async () => {
      const highQuality = await optimizeImage(jpegBuffer, { quality: { jpeg: 95 } });
      const lowQuality = await optimizeImage(jpegBuffer, { quality: { jpeg: 10 } });
      expect(lowQuality.outputSize).toBeLessThan(highQuality.outputSize);
    });
  });

  describe('output validity', () => {
    it('returns a buffer readable by sharp', async () => {
      const result = await optimizeImage(jpegBuffer);
      await expect(sharp(result.buffer).metadata()).resolves.toBeDefined();
    });

    it('works with no options (all defaults)', async () => {
      await expect(optimizeImage(jpegBuffer)).resolves.toBeDefined();
    });
  });

  describe('metadata stripping', () => {
    it('strips metadata by default', async () => {
      const result = await optimizeImage(jpegBuffer);
      const meta = await sharp(result.buffer).metadata();
      expect(meta.exif).toBeUndefined();
    });

    it('keeps metadata when stripMetadata is false', async () => {
      const withMeta = await sharp({
        create: { width: 100, height: 100, channels: 3, background: { r: 0, g: 0, b: 0 } },
      })
        .jpeg()
        .withMetadata({ exif: { IFD0: { Copyright: 'test' } } })
        .toBuffer();

      const stripped = await optimizeImage(withMeta, { stripMetadata: true });
      const kept = await optimizeImage(withMeta, { stripMetadata: false });

      const strippedMeta = await sharp(stripped.buffer).metadata();
      const keptMeta = await sharp(kept.buffer).metadata();

      expect(strippedMeta.exif).toBeUndefined();
      expect(keptMeta.exif).toBeDefined();
    });
  });
});
