# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.4.0] - 2026-07-26

### Added

- **`ntn-lua init`** — Create `ntn-lua.toml` in the current directory from a commented template.
- **`ntn-lua push`** — Create a new Notion database from a local `.luau` ModuleScript. Infers schema from flat property values (number, checkbox, rich text, multi-select) and inserts records. Nested relation dictionaries are not supported in v1.

### Changed

- Setup no longer requires copying example files. Document `.env` contents in README; generate `ntn-lua.toml` with `ntn-lua init`.

## [0.3.0] - 2026-07-26

### Breaking

- **Relation columns are embedded automatically** as Luau dictionaries. In v0.1.x, Relation columns were skipped. Databases with Relation columns now emit nested tables (for example `{ Fire = 10, Ice = 5 }`). Related databases must be shared with your Notion integration. Duplicate related Titles and circular relations are errors. Embed depth is limited to one level.
- **Configuration moved to `ntn-lua.toml`.** Environment variables `NOTION_DATABASE_ID` and `NOTION_OUTPUT_DIR` were removed. The `--no-format` CLI flag was removed; use `format = false` in `ntn-lua.toml`.
- **Note:** v0.2.0 was never published. The Bun toolchain migration and TOML configuration changes are included in this release.

### Added

- Nested dictionary support via Notion Relations — scalar collapse (`{ [string]: number }`) when the related database has one exportable column, or nested tables when it has two or more. See [docs/nested-relations.md](./docs/nested-relations.md).
- Global `empty_value` setting (`omit`, `nil`, `empty_string`) for missing property values.
- Global `empty_relation` setting (`omit`, `empty_table`) for Relation columns with no linked records.
- `docs/nested-relations.md` — database design guide and configuration reference.

### Changed

- Development toolchain migrated to [Bun](https://bun.sh) (standalone release binaries unchanged for Rokit users).
- Release artifacts built with `bun build --compile`.

## [0.1.1] - (previous release)

- Initial Rokit distribution and StyLua formatting.

## [0.1.0] - (previous release)

- Initial release.
