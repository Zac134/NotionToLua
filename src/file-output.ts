import {
  accessSync,
  constants,
  writeFileSync,
} from "node:fs";
import { basename, dirname, extname, join } from "node:path";

import { NotionToLuaError } from "./errors.js";
import { resolveModuleName } from "./module-name.js";

const LUA_FILE_PATTERN = /\.(?:lua|luau)$/iu;

export function isLuauFilePath(path: string): boolean {
  return LUA_FILE_PATTERN.test(path.trim());
}

export type OutputTarget =
  | {
      kind: "directory";
      directory: string;
    }
  | {
      kind: "file";
      filePath: string;
      moduleName: string;
    };

export function resolveOutputTarget(
  output: string,
  options?: {
    defaultTitle?: string;
    fallbackId?: string;
  },
): OutputTarget {
  const trimmed = output.trim();

  if (isLuauFilePath(trimmed)) {
    const filePath = trimmed;
    const baseName = basename(filePath, extname(filePath));

    return {
      kind: "file",
      filePath,
      moduleName: resolveModuleName(baseName, options?.fallbackId),
    };
  }

  return {
    kind: "directory",
    directory: trimmed,
  };
}

export function sanitizeFileName(title: string, fallbackId?: string): string {
  const sanitized = title
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001F]/gu, "_")
    .replace(/\s+/gu, "_")
    .replace(/_+/gu, "_")
    .replace(/^_+|_+$/gu, "");

  if (sanitized.length > 0) {
    return sanitized;
  }

  return fallbackId?.trim() || "output";
}

export function getOutputFilePath(
  outputDir: string,
  title: string,
  fallbackId?: string,
): string {
  return join(outputDir, `${sanitizeFileName(title, fallbackId)}.luau`);
}

function assertWritableDirectory(directory: string): void {
  try {
    accessSync(directory, constants.W_OK);
  } catch {
    throw new NotionToLuaError(
      `Output directory does not exist or is not writable: ${directory}`,
    );
  }
}

export function writeLuauToPath(filePath: string, content: string): string {
  const directory = dirname(filePath);
  assertWritableDirectory(directory);
  writeFileSync(filePath, content, "utf8");
  return filePath;
}

export function writeLuauFile(
  outputDir: string,
  title: string,
  content: string,
  fallbackId?: string,
): string {
  assertWritableDirectory(outputDir);

  const filePath = getOutputFilePath(outputDir, title, fallbackId);
  writeFileSync(filePath, content, "utf8");

  return filePath;
}
