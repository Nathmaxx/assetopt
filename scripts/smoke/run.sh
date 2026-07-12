#!/usr/bin/env bash
# Install smoke test — host driver.
#
# Runs scripts/smoke/smoke.sh in a series of clean containers and prints a
# summary. Covers what we can cover locally: glibc and musl, across Node
# majors. macOS and Windows are out of reach here — that is what the
# install-smoke GitHub Actions matrix is for.
#
#   ./scripts/smoke/run.sh              # test the version published as `latest`
#   ./scripts/smoke/run.sh 1.2.0        # test a specific published version
#   IMAGES="node:24-alpine" ./scripts/smoke/run.sh
set -uo pipefail

cd "$(dirname "$0")"

VERSION="${1:-latest}"

# glibc across the supported Node majors, plus musl — the three native deps
# (sharp, esbuild, lightningcss) ship separate prebuilt binaries for musl, and
# that is where a missing platform package usually shows up.
DEFAULT_IMAGES="node:20-bookworm-slim
node:22-bookworm-slim
node:24-bookworm-slim
node:20-alpine
node:24-alpine"

IMAGES="${IMAGES:-$DEFAULT_IMAGES}"

echo "Install smoke test — @assetopt/cli@${VERSION}"
echo

passed=()
failed=()

for image in $IMAGES; do
  echo "════════════════════════════════════════════════════════"
  echo "  ${image}"
  echo "════════════════════════════════════════════════════════"

  tag="assetopt-smoke:$(echo "$image" | tr ':/' '--')"

  if ! docker build --quiet --build-arg "NODE_IMAGE=${image}" -t "$tag" . > /dev/null; then
    echo "  FAIL could not build the test image"
    failed+=("$image (docker build)")
    echo
    continue
  fi

  # --network is left at default on purpose: the install must reach the real
  # registry, exactly as a user's would.
  if docker run --rm -e "ASSETOPT_VERSION=${VERSION}" "$tag"; then
    passed+=("$image")
  else
    failed+=("$image")
  fi
  echo
done

echo "════════════════════════════════════════════════════════"
echo "  Summary — @assetopt/cli@${VERSION}"
echo "════════════════════════════════════════════════════════"
for image in "${passed[@]:-}"; do
  [[ -n "$image" ]] && echo "  PASS  ${image}"
done
for image in "${failed[@]:-}"; do
  [[ -n "$image" ]] && echo "  FAIL  ${image}"
done

if [[ ${#failed[@]} -gt 0 ]]; then
  echo
  echo "${#failed[@]} environment(s) failed — do not launch on this version."
  exit 1
fi

echo
echo "All ${#passed[@]} environments passed."
