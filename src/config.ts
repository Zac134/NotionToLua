import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { parse } from "smol-toml";

import { NotionToLuaError } from "./errors.js";
import type { EmptyRelationMode, EmptyValueMode } from "./types.js";

export type UserConfigFile = {
  database_id?: string;
  page_id?: string;
  code_block_parent_page_id?: string;
  output?: string;
  format?: boolean;
  export_types?: boolean;
  empty_value?: EmptyValueMode;
  empty_relation?: EmptyRelationMode;
  omit_array_index?: boolean;
};

export type ResolvedUserConfig = {
  databaseId?: string;
  pageId?: string;
  output?: string;
  format: boolean;
  exportTypes: boolean;
  emptyValue: EmptyValueMode;
  emptyRelation: EmptyRelationMode;
  omitArrayIndex: boolean;
};

const SECTION_NAMES = new Set(["source", "paths", "emit"]);

const FLAT_ALLOWED_KEYS = new Set([
  "database_id",
  "page_id",
  "code_block_parent_page_id",
  "output",
  "format",
  "export_types",
  "empty_value",
  "empty_relation",
  "omit_array_index",
]);

const SOURCE_KEYS = new Set(["database_id", "code_block_parent_page_id"]);
const PATHS_KEYS = new Set(["output"]);
const EMIT_KEYS = new Set([
  "format",
  "export_types",
  "empty_value",
  "empty_relation",
  "omit_array_index",
]);

const DEFAULT_CONFIG: ResolvedUserConfig = {
  format: true,
  exportTypes: true,
  emptyValue: "omit",
  emptyRelation: "omit",
  omitArrayIndex: false,
};

function assertNonEmptyString(value: unknown, key: string): string {
  if (typeof value !== "string") {
    throw new NotionToLuaError(
      `Invalid type for "${key}" in ntn-lua.toml. Expected a string.`,
    );
  }

  const trimmed = value.trim();

  if (trimmed.length === 0) {
    throw new NotionToLuaError(
      `Invalid value for "${key}" in ntn-lua.toml. Expected a non-empty string.`,
    );
  }

  return trimmed;
}

function assertBoolean(value: unknown, key: string): boolean {
  if (typeof value !== "boolean") {
    throw new NotionToLuaError(
      `Invalid type for "${key}" in ntn-lua.toml. Expected a boolean.`,
    );
  }

  return value;
}

function assertEmptyValueMode(value: unknown, key: string): EmptyValueMode {
  if (value !== "omit" && value !== "nil" && value !== "empty_string") {
    throw new NotionToLuaError(
      `Invalid value for "${key}" in ntn-lua.toml. Expected "omit", "nil", or "empty_string".`,
    );
  }

  return value;
}

function assertEmptyRelationMode(
  value: unknown,
  key: string,
): EmptyRelationMode {
  if (value !== "omit" && value !== "empty_table") {
    throw new NotionToLuaError(
      `Invalid value for "${key}" in ntn-lua.toml. Expected "omit" or "empty_table".`,
    );
  }

  return value;
}

function assertSectionTable(
  value: unknown,
  section: string,
): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new NotionToLuaError(
      `Invalid ntn-lua.toml. Expected a table for section "[${section}]".`,
    );
  }

  return value as Record<string, unknown>;
}

function assertAllowedKeys(
  record: Record<string, unknown>,
  allowedKeys: Set<string>,
  context?: string,
): void {
  for (const key of Object.keys(record)) {
    if (!allowedKeys.has(key)) {
      const suffix = context ? ` in ${context}` : "";
      throw new NotionToLuaError(`Unknown key "${key}"${suffix} in ntn-lua.toml.`);
    }
  }
}

function applySourceFields(
  config: UserConfigFile,
  record: Record<string, unknown>,
): void {
  if ("database_id" in record) {
    config.database_id = assertNonEmptyString(record.database_id, "database_id");
  }

  if ("code_block_parent_page_id" in record) {
    config.code_block_parent_page_id = assertNonEmptyString(
      record.code_block_parent_page_id,
      "code_block_parent_page_id",
    );
  }
}

function applyPathsFields(
  config: UserConfigFile,
  record: Record<string, unknown>,
): void {
  if ("output" in record) {
    config.output = assertNonEmptyString(record.output, "output");
  }
}

function applyEmitFields(
  config: UserConfigFile,
  record: Record<string, unknown>,
): void {
  if ("format" in record) {
    config.format = assertBoolean(record.format, "format");
  }

  if ("export_types" in record) {
    config.export_types = assertBoolean(record.export_types, "export_types");
  }

  if ("empty_value" in record) {
    config.empty_value = assertEmptyValueMode(record.empty_value, "empty_value");
  }

  if ("empty_relation" in record) {
    config.empty_relation = assertEmptyRelationMode(
      record.empty_relation,
      "empty_relation",
    );
  }

  if ("omit_array_index" in record) {
    config.omit_array_index = assertBoolean(
      record.omit_array_index,
      "omit_array_index",
    );
  }
}

function applyFlatFields(
  config: UserConfigFile,
  record: Record<string, unknown>,
): void {
  applySourceFields(config, record);
  applyPathsFields(config, record);
  applyEmitFields(config, record);

  if ("page_id" in record) {
    config.page_id = assertNonEmptyString(record.page_id, "page_id");
  }
}

function assertExclusivePageIdFields(config: UserConfigFile): void {
  if (config.page_id && config.code_block_parent_page_id) {
    throw new NotionToLuaError(
      'Cannot specify both "page_id" and "code_block_parent_page_id" in ntn-lua.toml.',
    );
  }
}

function parseSectionConfig(record: Record<string, unknown>): UserConfigFile {
  for (const key of Object.keys(record)) {
    if (!SECTION_NAMES.has(key)) {
      throw new NotionToLuaError(`Unknown key "${key}" in ntn-lua.toml.`);
    }
  }

  const config: UserConfigFile = {};

  if ("source" in record) {
    const source = assertSectionTable(record.source, "source");
    assertAllowedKeys(source, SOURCE_KEYS, 'section "[source]"');
    applySourceFields(config, source);
  }

  if ("paths" in record) {
    const paths = assertSectionTable(record.paths, "paths");
    assertAllowedKeys(paths, PATHS_KEYS, 'section "[paths]"');
    applyPathsFields(config, paths);
  }

  if ("emit" in record) {
    const emit = assertSectionTable(record.emit, "emit");
    assertAllowedKeys(emit, EMIT_KEYS, 'section "[emit]"');
    applyEmitFields(config, emit);
  }

  assertExclusivePageIdFields(config);
  return config;
}

function parseFlatConfig(record: Record<string, unknown>): UserConfigFile {
  assertAllowedKeys(record, FLAT_ALLOWED_KEYS);

  const config: UserConfigFile = {};
  applyFlatFields(config, record);
  assertExclusivePageIdFields(config);
  return config;
}

function validateUserConfig(raw: unknown): UserConfigFile {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new NotionToLuaError(
      "Invalid ntn-lua.toml. Expected a table at the root.",
    );
  }

  const record = raw as Record<string, unknown>;
  const hasSection = Object.keys(record).some((key) => SECTION_NAMES.has(key));
  const hasFlat = Object.keys(record).some((key) => !SECTION_NAMES.has(key));

  if (hasSection && hasFlat) {
    throw new NotionToLuaError(
      "Cannot mix section tables and flat keys in ntn-lua.toml.",
    );
  }

  if (hasSection) {
    return parseSectionConfig(record);
  }

  return parseFlatConfig(record);
}

function resolveConfig(config: UserConfigFile): ResolvedUserConfig {
  return {
    databaseId: config.database_id,
    pageId: config.code_block_parent_page_id ?? config.page_id,
    output: config.output,
    format: config.format ?? true,
    exportTypes: config.export_types ?? true,
    emptyValue: config.empty_value ?? "omit",
    emptyRelation: config.empty_relation ?? "omit",
    omitArrayIndex: config.omit_array_index ?? false,
  };
}

export function loadUserConfig(cwd = process.cwd()): ResolvedUserConfig {
  const path = resolve(cwd, "ntn-lua.toml");

  let content: string;

  try {
    content = readFileSync(path, "utf8");
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return { ...DEFAULT_CONFIG };
    }

    throw error;
  }

  let parsed: unknown;

  try {
    parsed = parse(content);
  } catch (error) {
    throw new NotionToLuaError(
      `Failed to parse ntn-lua.toml: ${error instanceof Error ? error.message : "invalid TOML"}`,
    );
  }

  return resolveConfig(validateUserConfig(parsed));
}

export function resolveDatabaseId(options?: {
  flag?: string;
  positional?: string;
  config?: ResolvedUserConfig;
}): string | undefined {
  const fromFlag = options?.flag?.trim();
  if (fromFlag) {
    return fromFlag;
  }

  const fromPositional = options?.positional?.trim();
  if (fromPositional) {
    return fromPositional;
  }

  return options?.config?.databaseId;
}

export function resolveOutputPath(options?: {
  flag?: string;
  config?: ResolvedUserConfig;
}): string | undefined {
  const fromFlag = options?.flag?.trim();
  if (fromFlag) {
    return fromFlag;
  }

  return options?.config?.output;
}

export function resolvePageId(options?: {
  flag?: string;
  config?: ResolvedUserConfig;
}): string | undefined {
  const fromFlag = options?.flag?.trim();
  if (fromFlag) {
    return fromFlag;
  }

  return options?.config?.pageId;
}
