# NotionToLua

A CLI that converts all records in a Notion database into Roblox Luau `ModuleScript` format.  
Use `ntn-lua` to write the result into a Notion page code block or to a local file.

## Features

- `ntn-lua` CLI (Node.js 22 `parseArgs`)
- Fetch all database records with pagination
- Notion property types → Luau value conversion
- Find a `language = lua` code block on the target page (Luau in the UI is supported), update it, or append a new one at the end
- With `--output`, write to a file only (no Notion writes). Accepts a directory or a `.lua` / `.luau` file path
- Format with Stylua (warn and continue on failure; skip with `--no-format`)
- Use the title property as the top-level record key (duplicate or empty values are errors)
- Skip unsupported property types

## Requirements

### End users (Rokit)

- [Rokit](https://github.com/rojo-rbx/rokit)
- [StyLua](https://github.com/JohnnyMorganz/StyLua) (`ntn-lua` spawns `stylua`; install both via Rokit)
- Notion integration token (`NOTION_API_TOKEN`)
- Target pages and databases shared with your Notion integration

### Developers

- Node.js 22+
- npm 10.9.2+
- [StyLua](https://github.com/JohnnyMorganz/StyLua) (optional during development; warns and outputs unformatted code if missing)

## Install with Rokit

For Roblox projects, install `ntn-lua` and StyLua together with Rokit. StyLua is required because `ntn-lua` runs `stylua` on generated Luau.

```bash
rokit add Zac134/NotionToLua ntn-lua
rokit add JohnnyMorganz/StyLua
```

The second argument (`ntn-lua`) is the command name on `PATH`. Without it, Rokit would expose the tool as `NotionToLua`.

Or add both to your project's `rokit.toml`:

```toml
[tools]
StyLua = "JohnnyMorganz/StyLua@2.5.2"
ntn-lua = "Zac134/NotionToLua@0.1.0"
```

Then run `rokit install` from the project root. Rokit places `ntn-lua` on `PATH` for that project.

### Linting (optional)

`ntn-lua` formats output with StyLua but does not run selene. Conversion-time checks (duplicate title keys, missing titles, permission errors, and similar contract violations) fail immediately with a non-zero exit code. If you want additional linting in your Roblox project, install [selene](https://github.com/Kampfkarren/selene) via Rokit and run it on generated files or in CI after sync.

## Use in Roblox projects

This workflow assumes a [Rojo](https://github.com/rojo-rbx/rojo) project. Run `ntn-lua` from the project root so it reads that directory's `.env` (same behavior for the Rokit binary and the npm dev CLI).

Example layout:

```
my-game/
  .env
  rokit.toml
  default.project.json
  src/
    shared/
      Config/
        Weapons.luau   # generated
```

Example `default.project.json` mapping:

```json
{
  "name": "MyGame",
  "tree": {
    "$className": "DataModel",
    "ReplicatedStorage": {
      "Shared": {
        "$path": "src/shared"
      }
    }
  }
}
```

Sync a Notion database into a ModuleScript file (recommended: write directly to the Rojo-mapped path):

```bash
# With NOTION_DATABASE_ID / NOTION_OUTPUT_DIR in .env
ntn-lua

# Or explicitly
ntn-lua -d <DATABASE_ID> -o src/shared/Config/Weapons.luau
```

Require the generated module from game code:

```lua
local Weapons = require(game.ReplicatedStorage.Shared.Config.Weapons)

print(Weapons.Sword.Damage)
```

## Setup (developers)

```bash
# Install dependencies
npm install

# Build
npm run build

# Type check
npm run check

# Unit tests
npm test
```

### Environment variables

```bash
cp .env.example .env
```

Set `NOTION_API_TOKEN` (required) and any defaults you use often in `.env`.  
The loader reads `process.cwd()/.env`, so run `ntn-lua` from the directory that contains your `.env` (Rokit binary and npm dev CLI behave the same).

| Variable             | Required | Purpose                                                                 |
| -------------------- | -------- | ----------------------------------------------------------------------- |
| `NOTION_API_TOKEN`   | Yes      | Notion integration internal secret                                    |
| `NOTION_DATABASE_ID` | No       | Default `database_id` or `data_source_id`                               |
| `NOTION_OUTPUT_DIR`  | No       | Default output path for file mode (directory or `.lua` / `.luau` file) |

## Usage

During development (no build required):

```bash
# Shortest path (DB ID and output dir already in .env)
npm run sync

# Override individually
npm run sync -- -o ./other
npm run sync -- 3a94b589fd86808d9d64d7c99ce91844
```

After building:

```bash
npm run build
npx ntn-lua
npx ntn-lua -o ./other
```

Priority:

- Database ID: `-d` / `--database-id` → positional argument → `NOTION_DATABASE_ID`
- Output path: `-o` / `--output` → `NOTION_OUTPUT_DIR` (if unset, writes to a Notion code block)

### Write to a Notion code block (default)

```bash
ntn-lua -d <DATABASE_OR_DATA_SOURCE_ID>
# or
ntn-lua <DATABASE_OR_DATA_SOURCE_ID>
```

The target page is resolved in this order:

1. `--page-id` (when provided)
2. `database_parent.page_id` on the data source
3. Walk parents from `database_parent.block_id` via `blocks.retrieve`
4. Error when unresolvable (for example, a database directly under the workspace)

```bash
# Explicit page ID
ntn-lua -d <DATABASE_ID> -p <PAGE_ID>
```

If a database has multiple data sources, pass a `data_source_id` directly instead of a `database_id`.

The tool searches recursively through page blocks for the first `lua` / `luau` code block.

### Write to a local file

```bash
# No arguments needed when NOTION_DATABASE_ID / NOTION_OUTPUT_DIR are set in .env
ntn-lua

# Explicit options
ntn-lua -d <DATABASE_ID> -o ./output
ntn-lua <DATABASE_ID> -o ./output
ntn-lua -d <DATABASE_ID> -o ./output/Weapons.luau
```

- Directory output: file name is `{sanitized-data-source-title}.luau`
- File output: the path and base name (without extension) become the module variable name
- The output directory must already exist (it is not created automatically)
- With `--output`, nothing is written to Notion and `--page-id` is ignored (a warning is printed to stderr)

### Options

```bash
ntn-lua [-d <id>] [<database-id>] [-p <page-id>] [-o <dir-or-file>] [--no-format]
```

| Option              | Description                                                              |
| ------------------- | ------------------------------------------------------------------------ |
| `<database-id>`     | Positional database or data source ID when `-d` is omitted               |
| `-d, --database-id` | Source `database_id` or `data_source_id`                                 |
| `-p, --page-id`     | Notion page ID to write the code block to (ignored in file output mode) |
| `-o, --output`      | Output directory or `.lua` / `.luau` file path (file output mode only)  |
| `--no-format`       | Skip Stylua formatting                                                   |
| `-h, --help`        | Show help                                                                |

## Type conversion rules

| Notion type  | Luau value / type annotation              |
| ------------ | ----------------------------------------- |
| Number       | `number`                                  |
| Checkbox     | `boolean`                                 |
| Rich Text    | `string`                                  |
| Select       | `string`                                  |
| Multi Select | `{ "a", "b" }`                            |
| Date         | ISO 8601 string                           |
| URL          | `string`                                  |
| Formula      | Converted from the evaluated result type  |
| Status       | `string`                                  |
| Empty        | Omitted from output (stored as `nil`)     |

Unsupported types (Relation, Rollup, Files, People, and others) are skipped.

Generated `export type` fields use `?` when a property is missing on some records but present on others.  
Property names and record keys that are not valid Luau identifiers use bracket notation (for example, `["my-item"]`).

## Output example

Database:

| Name  | Damage | Cooldown |
| ----- | ------ | -------- |
| Sword | 25     | 1.2      |
| Axe   | 40     | 2        |

Generated output (with `-o ./output/Weapons.luau`):

```lua
export type WeaponsEntry = {
    Cooldown: number,
    Damage: number,
}

export type Weapons = {
    Axe: WeaponsEntry,
    Sword: WeaponsEntry,
}

local Weapons: Weapons = {
    Axe = {
        Cooldown = 2,
        Damage = 40,
    },
    Sword = {
        Cooldown = 1.2,
        Damage = 25,
    },
}

return Weapons
```

When `-o` points to a `.lua` or `.luau` file, that path and its base name (without extension) are used as the module variable name.  
When `-o` is a directory, the module name is derived from the sanitized data source title.

## Errors

Clear messages are returned for cases such as:

- Missing, empty, or duplicate title property values
- Database or page not found
- Data fetch or write failures
- Insufficient integration permissions
- Output directory missing or not writable
- Multiple data sources on one database without a direct `data_source_id`
- Unresolvable write target page (for example, workspace-root database without `--page-id`)

## Project layout

```
src/
  cli.ts            # CLI entry point
  env.ts            # .env loader and token validation
  generate.ts       # Luau generation orchestration
  resolve-page.ts   # Resolve Notion write target page
  stylua.ts         # Stylua formatting
  file-output.ts    # File output
  notion-client.ts  # Notion client factory
  notion.ts         # Notion API access and property conversion
  generator.ts      # Luau ModuleScript generation
  formatter.ts      # Luau value and key formatting
  module-name.ts    # Module name sanitization
  blocks.ts         # Code block search and update
  types.ts          # Shared types
  errors.ts         # Error handling
tests/              # Unit tests
```

## Extensibility

The `ModuleGenerator` interface in `generator.ts` and the `CodeBlockUpdater` interface in `blocks.ts` allow future changes such as splitting ModuleScripts or swapping output targets.

## Building binaries

Release artifacts are standalone Bun-compiled binaries packaged as Rokit-compatible zip files. This is for maintainers only; end users install via Rokit (see [Install with Rokit](#install-with-rokit)).

Prerequisites:

- [Bun](https://bun.sh) on `PATH`
- `zip` or Python 3 (used by the packaging script)

Local compile (smoke test on your machine):

```bash
npm run compile -- 0.1.0 bun-darwin-arm64 ./release
```

Arguments: `<version> <bun-target> <output-dir>`. Supported `bun-target` values:

| `bun-target`        | Zip suffix        |
| ------------------- | ----------------- |
| `bun-linux-x64`     | `linux-x86_64`    |
| `bun-linux-arm64`   | `linux-aarch64`   |
| `bun-darwin-x64`    | `macos-x86_64`    |
| `bun-darwin-arm64`  | `macos-aarch64`   |
| `bun-windows-x64`   | `windows-x86_64`  |
| `bun-windows-arm64` | `windows-aarch64` |

Output: `ntn-lua-<version>-<os>-<arch>.zip` containing a single `ntn-lua` (or `ntn-lua.exe` on Windows) binary.

## Release checklist

1. Confirm tests pass locally: `npm test`
2. Tag the release and push:
   ```bash
   git tag v0.1.0
   git push origin v0.1.0
   ```
3. GitHub Actions (`.github/workflows/release.yml`) runs on the tag:
   - `npm run check` and `npm test` on Ubuntu
   - Bun compile + zip for all six targets above
   - GitHub Release with the six zip assets attached
4. Verify end-user install from a clean Roblox project:
   ```bash
   rokit add Zac134/NotionToLua@0.1.0 ntn-lua
   rokit add JohnnyMorganz/StyLua
   rokit install
   ntn-lua --help
   ```

## License

MIT License. See [LICENSE](./LICENSE) for details.
