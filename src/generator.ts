import {
  formatLuauKey,
  formatLuauValue,
  indentBlock,
  resolveLuauKeyFormat,
} from "./formatter.js";
import type { LuauRecord } from "./types.js";

function sortKeys(keys: string[]): string[] {
  return [...keys].sort((left, right) => left.localeCompare(right, "en"));
}

function formatRecordBody(record: LuauRecord): string {
  const propertyKeys = sortKeys(
    Object.keys(record.properties).filter(
      (key) => record.properties[key] !== null,
    ),
  );

  if (propertyKeys.length === 0) {
    return "{}";
  }

  const lines = propertyKeys.map((propertyKey) => {
    const keyFormat = resolveLuauKeyFormat(propertyKey);
    const formattedKey = formatLuauKey(propertyKey, keyFormat);
    const formattedValue = formatLuauValue(record.properties[propertyKey]);
    return `${formattedKey} = ${formattedValue},`;
  });

  return `{\n${indentBlock(lines.join("\n"))}\n}`;
}

export function generateModuleScript(records: LuauRecord[]): string {
  const sortedRecords = [...records].sort((left, right) =>
    left.key.localeCompare(right.key, "en"),
  );

  if (sortedRecords.length === 0) {
    return "return {\n}";
  }

  const lines = sortedRecords.map((record) => {
    const formattedKey = formatLuauKey(record.key, record.keyFormat);
    const body = formatRecordBody(record);
    const indentedBody = indentBlock(body).trimStart();
    return `${formattedKey} = ${indentedBody},`;
  });

  return `return {\n${indentBlock(lines.join("\n"))}\n}`;
}

export interface ModuleGenerator {
  generate(records: LuauRecord[]): string;
}

export const defaultModuleGenerator: ModuleGenerator = {
  generate: generateModuleScript,
};
