import type { LuauKeyFormat, LuauValue } from "./types.js";

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

export function formatLuauValue(value: LuauValue): string {
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

  return formatLuauString(value);
}

export function indentBlock(content: string, spaces = 4): string {
  const padding = " ".repeat(spaces);
  return content
    .split("\n")
    .map((line) => (line.length > 0 ? `${padding}${line}` : line))
    .join("\n");
}
