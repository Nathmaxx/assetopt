# @assetopt/cli

Command-line tool to optimize images, CSS, JS and SVG assets — open source, MIT.

🌐 **[Landing page & live demo →](https://assetopt.tech)** — overview, before/after gallery, and a downloadable demo pack to try assetopt yourself.

## Install

```bash
npm install -g @assetopt/cli
# or as a project dev dependency
npm install --save-dev @assetopt/cli
```

## Quick start

```bash
# Generate a default .assetoptrc
assetopt init

# Dry-run: report potential savings without writing anything
assetopt analyze ./public

# Optimize for real (writes to ./optimized/ by default)
assetopt optimize ./public
```

## Commands

| Command                   | Effect                                                      |
| ------------------------- | ----------------------------------------------------------- |
| `assetopt optimize [dir]` | Optimize and write results to `output.dir`                  |
| `assetopt analyze [dir]`  | Dry-run: report savings without writing files               |
| `assetopt audit [dir]`    | Flag problematic assets (oversized, optimization potential) |
| `assetopt init`           | Create a default `.assetoptrc`                              |
| `assetopt clean`          | Remove the cache (or the whole output dir with `--all`)     |

Run `assetopt <command> --help` to see every flag and option.

## Documentation

For workflows, configuration reference, and the full feature catalog, see the [project repository](https://github.com/Nathmaxx/assetopt#readme):

- [Landing page](https://assetopt.tech) — project overview, before/after gallery, and a downloadable demo pack
- [Recommended workflows](https://github.com/Nathmaxx/assetopt/tree/main/docs/workflows) — three integration patterns (CI pre-deploy, hand-written static site, asset prep)
- [CLI reference](https://github.com/Nathmaxx/assetopt/blob/main/docs/cli.md) — every command, flag, and exit code
- [Configuration reference](https://github.com/Nathmaxx/assetopt/blob/main/docs/config.md) — every `.assetoptrc` field
- [FAQ](https://github.com/Nathmaxx/assetopt/blob/main/docs/faq.md) — common objections and edge cases

For the programmatic API, see [`@assetopt/core`](https://www.npmjs.com/package/@assetopt/core).

## License

MIT.
