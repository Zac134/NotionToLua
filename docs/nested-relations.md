# Nested Relations

Notion databases are flat by default — each column maps to a single Luau field. To represent **dictionaries** or **nested tables** (for example weapon effects keyed by element name), use a **Relation column**. All Relation columns are embedded automatically — no per-column configuration is required.

## Quick example

### Effects DB (master)

| Title (key) | Power (number) |
|---|---|
| Fire | 10 |
| Ice | 5 |

### Weapons DB

| Title | Damage | Effects (Relation → Effects) |
|---|---|---|
| Sword | 12 | Fire, Ice |

### `ntn-lua.toml`

```toml
database_id = "weapons-db-id"
output = "src/shared/Config/Weapons.luau"
```

### Generated Luau

```lua
export type WeaponsEntry = {
    Damage: number?,
    Effects: { [string]: number }?,
}

local Weapons: Weapons = {
    Sword = {
        Damage = 12,
        Effects = {
            Fire = 10,
            Ice = 5,
        },
    },
}

return Weapons
```

## How it works

1. Add a Relation column in Notion (for example `Effects` pointing to an Effects master DB).
2. Run `ntn-lua` — every Relation column is fetched and embedded automatically.
3. The related record **Title** becomes the Luau dictionary key.
4. The related record fields become the dictionary values.

## Scalar vs nested dictionaries

When the related database has **exactly one exportable column** (excluding Title), values are collapsed into a scalar dictionary:

```text
Effects DB: Title + Power  →  { Fire = 10, Ice = 5 }
Type: { [string]: number }
```

When the related database has **two or more exportable columns**, each key maps to a nested table:

```text
Effects DB: Title + Power + Duration  →  { Fire = { Power = 10, Duration = 3 } }
Type: { [string]: { Power: number?, Duration: number? } }
```

## Configuration

Only **global** settings in `ntn-lua.toml` — no per-column or per-database overrides.

```toml
# Skip null values (default)
empty_value = "omit"

# Skip empty relation columns (default)
empty_relation = "omit"
```

| Key | Values | Default | Meaning |
|---|---|---|---|
| `empty_value` | `omit`, `nil`, `empty_string` | `omit` | How to emit null / missing property values |
| `empty_relation` | `omit`, `empty_table` | `omit` | How to emit Relation columns with no linked records |

### `empty_value`

| Mode | Behavior |
|---|---|
| `omit` | Null values are skipped (keys omitted from output) |
| `nil` | Keys are kept with `nil` values, e.g. `Notes = nil` |
| `empty_string` | String-like properties (`rich_text`, `select`, `url`, `date`, `status`) emit `""`; other types still use `omit` |

### `empty_relation`

| Mode | Behavior |
|---|---|
| `omit` | When a Relation has no linked records, the property is omitted |
| `empty_table` | When a Relation has no linked records, output an empty table: `Effects = {}` |

## Notion setup checklist

1. Create a **master database** (e.g. Effects) with Title as the dictionary key.
2. Create a **main database** (e.g. Weapons) with a Relation column pointing to the master.
3. Share **both databases** with your Notion integration.
4. Run `ntn-lua` from the directory containing `ntn-lua.toml`.

## Rules and errors

- Related record **Title values must be unique** within each Relation column.
- **Circular relations** are detected and reported as errors.
- Relation embedding depth is limited to **1 level** (Weapons → Effects; no further nesting by default).
- There is **no opt-out** for Relation embedding in v0.3.0 — all Relation columns are expanded. Reference-only mode is planned for a future release.
- Unsupported property types on the related database are still skipped.

See also [README breaking changes](../README.md#configuration-ntn-luatoml) when upgrading from v0.1.x.

## Roadmap

| Version | Status |
|---|---|
| v0.3.0 | Relation auto-embed, scalar/nested collapse, global empty handling |
| v0.4 | Configurable embed depth, reference-only mode |
| Future | JSON-in-Rich-Text escape hatch, multi-module output |
