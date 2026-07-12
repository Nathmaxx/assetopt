#!/bin/sh
# Install smoke test — runs INSIDE a clean container.
#
# Installs the *published* package from the npm registry (not this repo's source)
# and puts it through the exact path a first-time user takes: install, init,
# analyze, optimize, re-run for the cache, audit.
#
# POSIX sh on purpose: the Alpine images have no bash.
set -eu

VERSION="${ASSETOPT_VERSION:-latest}"

echo "→ environment"
echo "  node    $(node --version)"
echo "  npm     $(npm --version)"
echo "  platform $(node -p 'process.platform + "/" + process.arch')"
# On Linux, tell glibc from musl: the three native deps ship a different prebuilt
# binary for each, and musl is where a missing platform package tends to surface.
echo "  libc    $(node -p "
  const h = process.report.getReport().header;
  process.platform !== 'linux' ? 'n/a' : h.glibcVersionRuntime ? 'glibc ' + h.glibcVersionRuntime : 'musl';
")"

echo "→ npm install -g @assetopt/cli@${VERSION}"
start=$(date +%s)
npm install -g "@assetopt/cli@${VERSION}" --loglevel=error
echo "  installed in $(($(date +%s) - start))s"

echo "→ assetopt --version"
assetopt --version

echo "→ assetopt init"
assetopt init
test -f .assetoptrc || { echo "  FAIL .assetoptrc was not created"; exit 1; }
echo "  ok   .assetoptrc created"

echo "→ assetopt analyze ./assets"
assetopt analyze ./assets > /dev/null
echo "  ok   analyze exited 0"

echo "→ assetopt optimize ./assets (first run)"
assetopt optimize ./assets -o ./optimized --json > report-fresh.json
node assert.mjs report-fresh.json fresh

echo "→ assetopt optimize ./assets (second run — incremental cache)"
assetopt optimize ./assets -o ./optimized --json > report-cached.json
node assert.mjs report-cached.json cached

echo "→ assetopt optimize ./assets --no-cache"
assetopt optimize ./assets -o ./optimized --json --no-cache > report-nocache.json
node assert.mjs report-nocache.json nocache

echo "→ assetopt audit ./assets"
assetopt audit ./assets > /dev/null
echo "  ok   audit exited 0"

echo "→ assetopt clean --all"
assetopt clean -o ./optimized --all > /dev/null
test ! -d ./optimized || { echo "  FAIL ./optimized survived clean --all"; exit 1; }
echo "  ok   output directory removed"

echo "PASS"
