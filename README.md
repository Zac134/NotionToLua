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

- Node.js 22+
- [Stylua](https://github.com/JohnnyMorganz/StyLua) (optional; warns and outputs unformatted code if missing)
- Target pages and databases shared with your Notion integration

## Setup

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

## License

MIT License. See [LICENSE](./LICENSE) for details.
