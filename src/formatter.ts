import type { LuauKeyFormat, LuauTable, LuauValue } from "./types.js";
import { isLuauTable } from "./types.js";

const IDENTIFIER_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function isValidLuauIdentifier(value: string): boolean {
  return IDENTIFIER_PATTERN.test(value);
}

export function resolveLuauKeyFormat(value: string): LuauKeyFormat {
  return isValidLuauIdentifier(value) ? "identifier" : "bracket";
}

export function formatLuauKey(key: string, format: LuauKeyFormat): string {
  if (format === "identifier") {
    return key;
  }

  return `[${formatLuauString(key)}]`;
}

export function formatLuauString(value: string): string {
  const escaped = value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t");

  return `"${escaped}"`;
}

function sortKeys(keys: string[]): string[] {
  return [...keys].sort((left, right) => left.localeCompare(right, "en"));
}

function formatLuauTable(table: LuauTable, includeNilKeys: boolean): string {
  const keys = sortKeys(Object.keys(table)).filter((key) => {
    if (includeNilKeys) {
      return key in table;
    }

    return table[key] !== null;
  });

  if (keys.length === 0) {
    return "{}";
  }

  const lines = keys.map((key) => {
    const keyFormat = resolveLuauKeyFormat(key);
    const formattedKey = formatLuauKey(key, keyFormat);
    const formattedValue = formatLuauValue(table[key], includeNilKeys);
    return `${formattedKey} = ${formattedValue},`;
  });

  return `{\n${indentBlock(lines.join("\n"))}\n}`;
}

export function formatLuauValue(
  value: LuauValue,
  includeNilKeys = false,
): string {
  if (value === null) {
    return "nil";
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return "nil";
    }

    return Number.isInteger(value) ? String(value) : String(value);
  }

  if (Array.isArray(value)) {
    const items = value.map((item) => formatLuauString(item)).join(", ");
    return `{ ${items} }`;
  }

  if (isLuauTable(value)) {
    return formatLuauTable(value, includeNilKeys);
  }

  return formatLuauString(value);
}

export function indentBlock(content: string, spaces = 4): string {
  const padding = " ".repeat(spaces);
  return content
    .split("\n")
    .map((line) => (line.length > 0 ? `${padding}${line}` : line))
    .join("\n");
}
