import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { parse } from "smol-toml";

import { NotionToLuaError } from "./errors.js";
import type { EmptyRelationMode, EmptyValueMode } from "./types.js";

export type UserConfigFile = {
  database_id?: string;
  page_id?: string;
  output?: string;
  format?: boolean;
  export_types?: boolean;
  empty_value?: EmptyValueMode;
  empty_relation?: EmptyRelationMode;
};

export type ResolvedUserConfig = {
  databaseId?: string;
  pageId?: string;
  output?: string;
  format: boolean;
  exportTypes: boolean;
  emptyValue: EmptyValueMode;
  emptyRelation: EmptyRelationMode;
};

const ALLOWED_KEYS = new Set([
  "database_id",
  "page_id",
  "output",
  "format",
  "export_types",
  "empty_value",
  "empty_relation",
]);

const DEFAULT_CONFIG: ResolvedUserConfig = {
  format: true,
  exportTypes: true,
  emptyValue: "omit",
  emptyRelation: "omit",
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

function validateUserConfig(raw: unknown): UserConfigFile {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new NotionToLuaError(
      "Invalid ntn-lua.toml. Expected a table at the root.",
    );
  }

  const record = raw as Record<string, unknown>;

  for (const key of Object.keys(record)) {
    if (!ALLOWED_KEYS.has(key)) {
      throw new NotionToLuaError(`Unknown key "${key}" in ntn-lua.toml.`);
    }
  }

  const config: UserConfigFile = {};

  if ("database_id" in record) {
    config.database_id = assertNonEmptyString(record.database_id, "database_id");
  }

  if ("page_id" in record) {
    config.page_id = assertNonEmptyString(record.page_id, "page_id");
  }

  if ("output" in record) {
    config.output = assertNonEmptyString(record.output, "output");
  }

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

  return config;
}

function resolveConfig(config: UserConfigFile): ResolvedUserConfig {
  return {
    databaseId: config.database_id,
    pageId: config.page_id,
    output: config.output,
    format: config.format ?? true,
    exportTypes: config.export_types ?? true,
    emptyValue: config.empty_value ?? "omit",
    emptyRelation: config.empty_relation ?? "omit",
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
