#!/usr/bin/env node
/**
 * Pre-publish guard for the ordered release (`npm run release`).
 *
 * Enforces the invariants behind roadmap task B4 ("respecter l'ordre de
 * publication") so the order can never silently drift:
 *
 *  1. `@assetopt/cli` declares a `@assetopt/core` range that the version of
 *     core *about to be published* actually satisfies. Since the release
 *     script publishes core first, this guarantees the dependency points to a
 *     version that exists on the registry.
 *  2. The two workspaces stay version-aligned (same `version`) — the v1
 *     release ships both packages in lockstep.
 *
 * Exits non-zero with an explanation on any violation so the publish aborts
 * before anything reaches npm.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import semver from 'semver';

const read = (rel) =>
  JSON.parse(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8'));

const core = read('../packages/core/package.json');
const cli = read('../packages/cli/package.json');

const errors = [];

const coreDep = cli.dependencies?.['@assetopt/core'];
if (!coreDep) {
  errors.push('@assetopt/cli no longer depends on @assetopt/core — unexpected.');
} else if (!semver.satisfies(core.version, coreDep)) {
  errors.push(
    `@assetopt/cli requires @assetopt/core@"${coreDep}", but core is at ` +
      `${core.version}, which does not satisfy that range. Bump the dependency ` +
      `before publishing so the CLI resolves the version actually on npm.`,
  );
}

if (core.version !== cli.version) {
  errors.push(
    `Version drift: @assetopt/core is ${core.version} but @assetopt/cli is ` +
      `${cli.version}. Both packages ship in lockstep for v1.`,
  );
}

if (errors.length > 0) {
  console.error('✗ Release check failed:');
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

console.log(
  `✓ Release check OK — core ${core.version} satisfies cli's ` +
    `@assetopt/core@"${coreDep}"; publish order: core → cli.`,
);
