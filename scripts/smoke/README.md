# Install smoke test

Verifies that **the package published on npm** actually installs and runs on a machine
that is not ours. This is deliberately _not_ what `npm run test:run` covers: the vitest
suite tests the source tree at HEAD, so it stays green even if the published tarball is
missing a file, or if a native dependency has no prebuilt binary for a given platform.

`@assetopt/core` pulls in three packages that ship platform-specific prebuilt binaries —
`sharp`, `esbuild` and `lightningcss`. Each is an opportunity for `npm install -g` to
succeed on our Linux box and fail on someone else's machine.

## Run it

```bash
./scripts/smoke/run.sh            # whatever is published as `latest`
./scripts/smoke/run.sh 1.2.0      # a specific published version
IMAGES="node:24-alpine" ./scripts/smoke/run.sh 1.2.0   # a single environment
```

Requires Docker, and network access from the container: the install must hit the real
registry, exactly as a user's would.

## What it covers

Each container installs `@assetopt/cli` globally from npm and walks the path a first-time
user walks — `init`, `analyze`, `optimize`, a second `optimize` to exercise the incremental
cache, `optimize --no-cache`, `audit`, `clean --all`. Assertions live in `assert.mjs` and
read the `--json` report: no asset errored, all four asset types (image / CSS / JS / SVG)
were optimized, every output the report claims really exists on disk, savings are positive,
and the cache is hit on the second run and only then.

Default matrix: Node 20 / 22 / 24 on glibc, plus Node 20 / 24 on musl (Alpine).

`fixtures/` is a trimmed copy of the demo pack — one JPEG, one PNG, one CSS, one JS, one
SVG, ~370 KB total, small enough to keep the repo light and still large enough that the
optimizers have real work to do.

## What it does _not_ cover

**macOS and Windows.** Those need the `install-smoke` GitHub Actions matrix, which runs the
same `smoke.sh` on `macos-latest` and `windows-latest` runners. Windows is the higher risk of
the two: the cache manifest stores posix paths, and glob matching has to cope with `\`
separators.
