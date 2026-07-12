/**
 * Assertions for the install smoke test.
 *
 * Reads an `assetopt optimize --json` report and checks what a first-time user
 * would notice: assets were actually processed, every declared output really
 * exists on disk, and the incremental cache behaves as advertised.
 *
 * Usage: node assert.mjs <report.json> <fresh|cached|nocache>
 */
import { readFileSync, existsSync } from 'node:fs';

const [reportPath, mode] = process.argv.slice(2);

if (!reportPath || !['fresh', 'cached', 'nocache', 'exclude'].includes(mode)) {
  console.error('usage: node assert.mjs <report.json> <fresh|cached|nocache|exclude>');
  process.exit(2);
}

const failures = [];
const check = (label, ok, detail = '') => {
  if (ok) {
    console.log(`  ok   ${label}`);
  } else {
    console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ''}`);
    failures.push(label);
  }
};

let report;
try {
  report = JSON.parse(readFileSync(reportPath, 'utf8'));
} catch (err) {
  console.error(`  FAIL report is not valid JSON — ${err.message}`);
  process.exit(1);
}

const assets = report.assets ?? [];

check('report lists at least one asset', assets.length > 0, `got ${assets.length}`);
check('no asset failed to process', report.errorCount === 0, `errorCount=${report.errorCount}`);

const errored = assets.filter((a) => a.error !== undefined && a.error !== null);
for (const asset of errored) {
  check(`asset ${asset.inputPath} processed without error`, false, asset.error);
}

// The four asset types are the whole selling point — if one silently drops out
// on a given platform (a native binary that failed to resolve), we want to know.
// The `exclude` run deliberately drops the SVG, so it is checked separately below.
if (mode !== 'exclude') {
  for (const type of ['image', 'css', 'js', 'svg']) {
    check(
      `${type} assets were optimized`,
      assets.some((a) => a.assetType === type),
    );
  }
}

// The failure mode a unit test can't catch: the report claims success but the
// optimizer never wrote anything to disk.
const missing = assets.filter((a) => !existsSync(a.outputPath));
check(
  'every reported output exists on disk',
  missing.length === 0,
  missing.map((a) => a.outputPath).join(', '),
);

if (mode === 'fresh') {
  check('savings are positive', report.totalSavedBytes > 0, `${report.totalSavedBytes} bytes`);
  check('nothing came from the cache on a first run', report.cachedCount === 0);
} else if (mode === 'cached') {
  check(
    'a second run serves every asset from the cache',
    report.cachedCount === assets.length,
    `${report.cachedCount}/${assets.length}`,
  );
} else if (mode === 'nocache') {
  check('--no-cache bypasses the cache entirely', report.cachedCount === 0);
} else if (mode === 'exclude') {
  // Glob matching is the one place Windows can still diverge: patterns are posix,
  // but the paths the scanner feeds picomatch come from the host filesystem. A
  // `**/…` pattern that silently matches nothing on Windows would leave the SVG in.
  const svg = assets.filter((a) => a.assetType === 'svg');
  check(
    "--exclude '**/*.svg' really drops the SVG",
    svg.length === 0,
    svg.map((a) => a.inputPath).join(', '),
  );
  // …and the mirror image: a pattern that over-matches and drops everything would
  // "pass" the check above while quietly optimizing nothing at all.
  for (const type of ['image', 'css', 'js']) {
    check(
      `${type} assets survive the exclusion`,
      assets.some((a) => a.assetType === type),
    );
  }
}

if (failures.length > 0) {
  console.log(`\n  ${failures.length} assertion(s) failed`);
  process.exit(1);
}
