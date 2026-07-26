import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { NotionToLuaError } from "./errors.js";

function parseEnvLine(line: string): [string, string] | null {
  const trimmed = line.trim();

  if (trimmed.length === 0 || trimmed.startsWith("#")) {
    return null;
  }

  const separatorIndex = trimmed.indexOf("=");

  if (separatorIndex <= 0) {
    return null;
  }

  const key = trimmed.slice(0, separatorIndex).trim();
  let value = trimmed.slice(separatorIndex + 1).trim();

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }

  return [key, value];
}

export function loadEnvFile(path = resolve(process.cwd(), ".env")): void {
  let content: string;

  try {
    content = readFileSync(path, "utf8");
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error.code === "ENOENT" ||
        error.code === "EPERM" ||
        error.code === "EACCES")
    ) {
      return;
    }

    throw error;
  }

  for (const line of content.split(/\r?\n/u)) {
    const parsed = parseEnvLine(line);

    if (!parsed) {
      continue;
    }

    const [key, value] = parsed;

    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

export function requireNotionToken(): string {
  const token = process.env.NOTION_API_TOKEN?.trim();

  if (!token) {
    throw new NotionToLuaError(
      "NOTION_API_TOKEN が設定されていません。.env または環境変数に Integration の Internal Integration Secret を設定してください。",
    );
  }

  return token;
}

export function resolveDatabaseId(options?: {
  flag?: string;
  positional?: string;
}): string | undefined {
  const fromFlag = options?.flag?.trim();
  if (fromFlag) {
    return fromFlag;
  }

  const fromPositional = options?.positional?.trim();
  if (fromPositional) {
    return fromPositional;
  }

  const fromEnv = process.env.NOTION_DATABASE_ID?.trim();
  if (fromEnv) {
    return fromEnv;
  }

  return undefined;
}

export function resolveOutputDir(options?: {
  flag?: string;
}): string | undefined {
  const fromFlag = options?.flag?.trim();
  if (fromFlag) {
    return fromFlag;
  }

  const fromEnv = process.env.NOTION_OUTPUT_DIR?.trim();
  if (fromEnv) {
    return fromEnv;
  }

  return undefined;
}
