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
 *  3. (Optional) When `EXPECTED_VERSION` is set — e.g. the git tag in the
 *     release workflow — both packages must be at exactly that version, so a
 *     `v*` tag can never publish a mismatched package.json version. A leading
 *     `v` is tolerated (`v1.2.3` and `1.2.3` are equivalent).
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

const expected = process.env.EXPECTED_VERSION?.trim().replace(/^v/, '');
if (expected) {
  for (const pkg of [core, cli]) {
    if (pkg.version !== expected) {
      errors.push(
        `Tag/version mismatch: expected ${expected} (from EXPECTED_VERSION) but ` +
          `${pkg.name} is at ${pkg.version}. Tag the commit that bumps package.json.`,
      );
    }
  }
}

if (errors.length > 0) {
  console.error('✗ Release check failed:');
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

console.log(
  `✓ Release check OK — core ${core.version} satisfies cli's ` +
    `@assetopt/core@"${coreDep}"${expected ? ` (matches tag ${expected})` : ''}; ` +
    `publish order: core → cli.`,
);
