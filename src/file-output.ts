import { accessSync, constants, writeFileSync } from "node:fs";
import { join } from "node:path";

import { NotionToLuaError } from "./errors.js";

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

export function writeLuauFile(
  outputDir: string,
  title: string,
  content: string,
  fallbackId?: string,
): string {
  try {
    accessSync(outputDir, constants.W_OK);
  } catch {
    throw new NotionToLuaError(
      `出力ディレクトリが存在しないか、書き込み権限がありません: ${outputDir}`,
    );
  }

  const filePath = getOutputFilePath(outputDir, title, fallbackId);
  writeFileSync(filePath, content, "utf8");

  return filePath;
}
