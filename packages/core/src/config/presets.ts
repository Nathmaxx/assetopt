import type { AssetoptConfig, PresetName } from '../types/index.js';

export const PRESETS: Record<PresetName, Partial<AssetoptConfig>> = {
  // PNG smart routing: AVIF preserves transparency at smaller size than PNG,
  // but for opaque images WebP is lighter than AVIF. So we route based on
  // the actual presence of an alpha channel rather than the PNG container.
  'web-perf': {
    images: {
      formatMatrix: {
        jpeg: 'webp',
        png: (ctx) => (ctx.hasAlpha ? 'avif' : 'webp'),
        webp: 'keep',
        avif: 'keep',
      },
    },
  },

  // Smallest possible output: everything converges to AVIF (the densest format
  // we support) at aggressive quality, and SVGs get the full svgo treatment.
  // Quality is keyed by the OUTPUT format, so only `avif` matters here.
  'max-compression': {
    images: {
      formatMatrix: {
        jpeg: 'avif',
        png: 'avif',
        webp: 'avif',
        avif: 'keep',
      },
      quality: { avif: 50 },
      stripMetadata: true,
    },
    svg: { multipass: true, minifyIds: true },
  },

  // Fidelity-first: keep every source format (no lossy format switch) and
  // re-encode at high quality. Metadata is preserved (e.g. color profiles,
  // EXIF) — useful for photography or print workflows. Not bit-for-bit
  // lossless: JPEG/WebP/AVIF stay lossy codecs, just at a high quality floor.
  quality: {
    images: {
      formatMatrix: {
        jpeg: 'keep',
        png: 'keep',
        webp: 'keep',
        avif: 'keep',
      },
      quality: { jpeg: 95, png: 95, webp: 95, avif: 90 },
      stripMetadata: false,
    },
  },

  // Maximum target compatibility: never produce a format more modern than the
  // source. Every format is kept as-is (only re-compressed at defaults), so the
  // output is guaranteed to be as widely supported as the input.
  compatibility: {
    images: {
      formatMatrix: {
        jpeg: 'keep',
        png: 'keep',
        webp: 'keep',
        avif: 'keep',
      },
    },
  },
};
