import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findCliVersion } from '../version.js';

// src/utils/__tests__ → packages/cli/package.json is three levels up.
const pkgPath = resolve(dirname(fileURLToPath(import.meta.url)), '../../../package.json');

describe('findCliVersion', () => {
  it('resolves the version declared in packages/cli/package.json', () => {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as { name: string; version: string };
    expect(pkg.name).toBe('@assetopt/cli');
    expect(findCliVersion()).toBe(pkg.version);
  });

  it('never returns the unknown fallback from the repo layout', () => {
    expect(findCliVersion()).not.toBe('0.0.0-unknown');
  });
});
