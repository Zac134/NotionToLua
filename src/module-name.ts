import { isValidLuauIdentifier } from "./formatter.js";

function sanitizeToIdentifier(name: string, fallbackId?: string): string {
  const sanitized = name
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001F]/gu, "_")
    .replace(/\s+/gu, "_")
    .replace(/_+/gu, "_")
    .replace(/^_+|_+$/gu, "");

  if (sanitized.length > 0) {
    return sanitized;
  }

  return fallbackId?.trim() || "module";
}

export function toPascalCase(moduleName: string): string {
  if (moduleName.length === 0) {
    return "Module";
  }

  return moduleName.charAt(0).toUpperCase() + moduleName.slice(1);
}

export function resolveModuleName(name: string, fallbackId?: string): string {
  const trimmed = name.trim();

  if (isValidLuauIdentifier(trimmed)) {
    return trimmed;
  }

  const sanitized = sanitizeToIdentifier(trimmed, fallbackId);

  if (isValidLuauIdentifier(sanitized)) {
    return sanitized;
  }

  const normalized = sanitized
    .replace(/[^A-Za-z0-9_]/gu, "_")
    .replace(/_+/gu, "_");

  if (normalized.length === 0) {
    return "module";
  }

  if (/^[0-9]/u.test(normalized)) {
    return `_${normalized}`;
  }

  return normalized;
}
