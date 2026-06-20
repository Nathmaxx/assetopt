# CLI reference

Exhaustive reference for every `assetopt` command. For higher-level guidance, see the [feature catalog](./features.md) and the [workflow guides](./workflows/).

---

## Synopsis

```
assetopt <command> [arguments] [options]
```

## Global flags

These come from commander and apply to every command:

| Flag              | Effect                                               |
| ----------------- | ---------------------------------------------------- |
| `--help`, `-h`    | Print help for the program or for a specific command |
| `--version`, `-V` | Print the installed CLI version                      |

```bash
assetopt --help
assetopt optimize --help
assetopt --version
```

---

## `assetopt init`

Generate a default `.assetoptrc` configuration file in the current working directory.

### Signature

```
assetopt init [--force]
```

### Arguments

None.

### Options

| Option    | Default | Effect                                                 |
| --------- | ------- | ------------------------------------------------------ |
| `--force` | _off_   | Overwrite the existing `.assetoptrc` if one is present |

### Exit codes

| Code | Condition                                                 |
| ---- | --------------------------------------------------------- |
| `0`  | File created (or overwritten with `--force`)              |
| `1`  | `.assetoptrc` already exists and `--force` was not passed |

### Examples

```bash
# In a fresh project
assetopt init
# → Created .assetoptrc

# Overwrite an existing config
assetopt init --force
```

### Notes

- The file is always written to `process.cwd()` — the current working directory at invocation time, not the project root.
- The generated config matches `DEFAULTS` from `@assetopt/core` (no preset, conservative quality, output dir `./optimized`).

---

## `assetopt analyze [dir]`

Analyze assets and report potential savings without modifying any files (dry-run).

### Signature

```
assetopt analyze [dir] [-o, --output <dir>] [--json] [--min-savings <percent>] [--no-cache]
```

### Arguments

| Argument | Default | Effect                               |
| -------- | ------- | ------------------------------------ |
| `dir`    | `.`     | Source directory to scan recursively |

### Options

| Option                    | Default                     | Effect                                                                                                              |
| ------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `-o, --output <dir>`      | from config (`./optimized`) | Override `output.dir` from config — used here for cache lookup                                                      |
| `--json`                  | _off_                       | Output the report as JSON on stdout. Suppresses the colored summary, the progress bar, and the config-source banner |
| `--min-savings <percent>` | _off_                       | Fail with exit code 1 if total savings are below this percent. Value must be a finite number between 0 and 100      |
| `--no-cache`              | _off_                       | Bypass the incremental cache (read every asset from scratch)                                                        |

### Exit codes

| Code | Condition                                                                         |
| ---- | --------------------------------------------------------------------------------- |
| `0`  | Analyze ran successfully and `--min-savings` (if set) was satisfied               |
| `1`  | `--min-savings` threshold not met, invalid threshold value, or any pipeline error |

### Examples

```bash
# Analyze the current directory
assetopt analyze

# Analyze a specific folder
assetopt analyze ./public

# CI quality gate: fail if savings < 15%
assetopt analyze ./dist --min-savings 15

# Force a full re-scan, ignoring the cache
assetopt analyze ./public --no-cache

# Use a one-off output dir for cache lookup
assetopt analyze ./public -o /tmp/assetopt-cache

# Machine-readable report for tooling / CI
assetopt analyze ./public --json > savings.json
```

### Notes

- `analyze` **reads** the cache to skip redundant work, but **never writes** the manifest. Only `optimize` maintains the cache.
- The output report has the same structure as `optimize`'s. The verb in the summary is `Would save` instead of `Saved`.
- With `--json`, only valid JSON is written to stdout (the summary, progress bar, and config-source banner are suppressed) — safe for piping.
- If no supported assets are found in `dir`, the command prints `No supported assets found.` and exits 0.

---

## `assetopt optimize [dir]`

Optimize assets and write the results to the output directory.

### Signature

```
assetopt optimize [dir] [-o, --output <dir>] [--json] [--min-savings <percent>] [--no-cache]
```

### Arguments

| Argument | Default | Effect                               |
| -------- | ------- | ------------------------------------ |
| `dir`    | `.`     | Source directory to scan recursively |

### Options

| Option                    | Default                     | Effect                                                                                                              |
| ------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `-o, --output <dir>`      | from config (`./optimized`) | Override `output.dir` from config for this run                                                                      |
| `--json`                  | _off_                       | Output the report as JSON on stdout. Suppresses the colored summary, the progress bar, and the config-source banner |
| `--min-savings <percent>` | _off_                       | Fail with exit code 1 if total savings are below this percent. Value must be a finite number between 0 and 100      |
| `--no-cache`              | _off_                       | Bypass the incremental cache (force re-processing of every asset, do not write the manifest)                        |

### Exit codes

| Code | Condition                                                                         |
| ---- | --------------------------------------------------------------------------------- |
| `0`  | Optimization ran successfully and `--min-savings` (if set) was satisfied          |
| `1`  | `--min-savings` threshold not met, invalid threshold value, or any pipeline error |

### Examples

```bash
# Optimize the current directory using config's output.dir
assetopt optimize

# Optimize a specific folder
assetopt optimize ./public

# Override the destination for this one run
assetopt optimize ./public -o ./build/static-optimized

# CI: fail if total savings drop below 5%
assetopt optimize dist --min-savings 5

# Pipe the report into a custom script
assetopt optimize dist --json > report.json

# Bypass the cache (reproduce a "first run")
assetopt optimize dist --no-cache
```

### Notes

- The cache manifest lives at `<output.dir>/.assetopt-cache.json`. `--no-cache` neither reads nor writes it.
- With `--json`, only valid JSON is written to stdout — safe for piping. The config-source banner and progress are normally on stderr-equivalent paths… in practice they're suppressed entirely when `--json` is set.
- The report's `outputPath` reflects any extension change from format conversion (e.g. `photo.jpg` → `photo.webp` when `web-perf` is active). The `inputPath` always shows the original.

---

## `assetopt audit [dir]`

Scan a folder and flag problematic assets (oversized, optimization potential), without modifying anything.

### Signature

```
assetopt audit [dir] [--savings] [--threshold <percent>]
```

### Arguments

| Argument | Default | Effect                               |
| -------- | ------- | ------------------------------------ |
| `dir`    | `.`     | Source directory to scan recursively |

### Options

| Option                  | Default | Effect                                                                                                                                                |
| ----------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--savings`             | _off_   | Run a full pipeline dry-run to compute potential savings per file. Flags files where savings would exceed `--threshold`. Slower than the default mode |
| `--threshold <percent>` | `10`    | Minimum savings percent to flag a file. Only meaningful with `--savings`                                                                              |

### Exit codes

| Code | Condition                                                                               |
| ---- | --------------------------------------------------------------------------------------- |
| `0`  | No file flagged                                                                         |
| `1`  | At least one file was flagged for any reason (oversized or above the savings threshold) |

### Examples

```bash
# Fast scan: only flags oversized files
assetopt audit ./public

# Full scan with savings analysis
assetopt audit ./public --savings

# Tighter threshold for the savings flag
assetopt audit ./public --savings --threshold 25
```

### Behavior

**Fast mode (default)**: reads only file size. Flags assets larger than these built-in thresholds:

| Asset type | Threshold |
| ---------- | --------- |
| Image      | 500 KB    |
| JavaScript | 100 KB    |
| CSS        | 50 KB     |
| SVG        | 50 KB     |

**Full mode (`--savings`)**: runs the optimization pipeline as a dry-run. In addition to the size flag, files whose potential savings exceed `--threshold` are flagged with `would save X (-Y%)`. The cache is consulted to avoid re-processing unchanged files.

### Notes

- `audit` does not accept `-o, --output <dir>` — its purpose is diagnostic, not output-producing.
- A file may show multiple flags on the same row (e.g. both oversized **and** with high savings potential).

---

## `assetopt clean`

Remove the incremental cache manifest, or the whole output directory with `--all`.

### Signature

```
assetopt clean [-o, --output <dir>] [--all] [--dry-run]
```

### Arguments

None. The target is the **output** directory (`output.dir` from config, or `-o`), not a source dir.

### Options

| Option               | Default                     | Effect                                                                           |
| -------------------- | --------------------------- | -------------------------------------------------------------------------------- |
| `-o, --output <dir>` | from config (`./optimized`) | Output directory to clean, overriding `output.dir` from config                   |
| `--all`              | _off_                       | Remove the entire output directory, not just the `.assetopt-cache.json` manifest |
| `--dry-run`          | _off_                       | Print what would be removed without deleting anything                            |

### Exit codes

| Code | Condition                                                                             |
| ---- | ------------------------------------------------------------------------------------- |
| `0`  | Target removed, or nothing to remove (a missing target is not an error)               |
| `1`  | `--all` would delete the current directory or a parent of it, or any filesystem error |

### Examples

```bash
# Drop the cache so the next run re-optimizes everything from scratch
assetopt clean

# Wipe the whole build output (assets + cache)
assetopt clean --all

# Preview a full wipe without touching the disk
assetopt clean --all --dry-run

# Clean a non-default output directory
assetopt clean -o ./build/static --all
```

### Notes

- Default removes only `<output.dir>/.assetopt-cache.json`; the optimized assets are kept.
- A missing target is reported (`Nothing to clean — …`) and exits `0` — `clean` is idempotent.
- As a safety net, `--all` refuses to delete the current working directory or any of its parents
  (e.g. when `output.dir` is set to `.`); point it at a dedicated build folder instead.

---

## Configuration resolution

For every command, the CLI:

1. Loads `.assetoptrc` (or `.assetoptrc.json`) by walking up from `process.cwd()` until one is found, or falls back to `DEFAULTS` from `@assetopt/core`.
2. Applies the preset (if `preset: "web-perf"` is set), then deep-merges the user config on top.
3. If `-o, --output <dir>` was passed (where supported), overrides `config.output.dir` for this run only — the on-disk `.assetoptrc` is never modified.

The CLI prints the source line at the start of every command:

```
✓ config loaded from /home/me/proj/.assetoptrc
```

or

```
⚠ no .assetoptrc found, using defaults
```

For the schema, see [features.md → Zero-friction config](./features.md#zero-friction-config). For the full field-by-field reference, see [config.md](./config.md).

---

## Error handling

All commands route unhandled errors through a single helper that prints `Error: <message>` to stderr and exits with code 1. There is no stack trace by default.

Common errors:

| Message                                                                  | Cause                                                 |
| ------------------------------------------------------------------------ | ----------------------------------------------------- |
| `Invalid /path/to/.assetoptrc: ...`                                      | The config file failed JSON parsing or zod validation |
| `Invalid --min-savings value: "X" (expected a number between 0 and 100)` | The threshold is non-finite, negative, or above 100   |
| `Error: ENOENT: no such file or directory, ...`                          | The target `dir` doesn't exist                        |
| `Error: .assetoptrc already exists. Use --force to overwrite.`           | `init` ran without `--force` against an existing file |

---

## See also

- [Feature catalog](./features.md) — every feature with its config and behavior
- [Workflow guides](./workflows/) — three end-to-end integration patterns
- [FAQ](./faq.md) — common objections and edge cases
- [Configuration reference](./config.md) — exhaustive reference of `.assetoptrc`
