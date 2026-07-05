import path from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Walk up from this module looking for the @assetopt/cli package.json so the
 * version resolves correctly both in dev (src/) and in the bundled dist/.
 * Mirrors the pattern used by @assetopt/core for its own version — the
 * version must never be hard-coded (it silently rots on every release).
 */
export function findCliVersion(): string {
  let dir = path.dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 10; i++) {
    const candidate = path.join(dir, 'package.json');
    try {
      const pkg = JSON.parse(readFileSync(candidate, 'utf-8')) as {
        name?: string;
        version?: string;
      };
      if (pkg.name === '@assetopt/cli' && pkg.version) return pkg.version;
    } catch {
      // not found at this level, keep walking
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return '0.0.0-unknown';
}
