import {
  formatLuauKey,
  formatLuauValue,
  indentBlock,
  resolveLuauKeyFormat,
} from "./formatter.js";
import { toPascalCase } from "./module-name.js";
import type {
  ExportableProperty,
  GenerateModuleOptions,
  LuauRecord,
} from "./types.js";

function sortKeys(keys: string[]): string[] {
  return [...keys].sort((left, right) => left.localeCompare(right, "en"));
}

function notionTypeToLuauType(notionType: string): string {
  switch (notionType) {
    case "number":
      return "number";
    case "checkbox":
      return "boolean";
    case "multi_select":
      return "{ string }";
    case "formula":
      return "string | number | boolean";
    default:
      return "string";
  }
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

function formatTypePropertyKey(propertyName: string): string {
  const keyFormat = resolveLuauKeyFormat(propertyName);
  return formatLuauKey(propertyName, keyFormat);
}

function isPropertyPresentInRecord(
  record: LuauRecord,
  propertyName: string,
): boolean {
  return (
    propertyName in record.properties &&
    record.properties[propertyName] !== null
  );
}

function generateEntryType(
  entryTypeName: string,
  properties: ExportableProperty[],
  records: LuauRecord[],
): string | null {
  if (properties.length === 0 || records.length === 0) {
    return null;
  }

  const lines = sortKeys(properties.map((property) => property.name))
    .map((propertyName) => {
      const property = properties.find((item) => item.name === propertyName);
      const presentCount = records.filter((record) =>
        isPropertyPresentInRecord(record, propertyName),
      ).length;

      if (presentCount === 0) {
        return null;
      }

      const luauType = notionTypeToLuauType(property?.notionType ?? "string");
      const optionalSuffix = presentCount < records.length ? "?" : "";

      return `${formatTypePropertyKey(propertyName)}: ${luauType}${optionalSuffix},`;
    })
    .filter((line): line is string => line !== null);

  if (lines.length === 0) {
    return null;
  }

  return `export type ${entryTypeName} = {\n${indentBlock(lines.join("\n"))}\n}`;
}

function generateModuleType(
  moduleTypeName: string,
  entryTypeName: string,
  records: LuauRecord[],
): string | null {
  if (records.length === 0) {
    return `export type ${moduleTypeName} = {\n}`;
  }

  const sortedRecords = [...records].sort((left, right) =>
    left.key.localeCompare(right.key, "en"),
  );

  const lines = sortedRecords.map((record) => {
    const formattedKey = formatLuauKey(record.key, record.keyFormat);
    return `${formattedKey}: ${entryTypeName},`;
  });

  return `export type ${moduleTypeName} = {\n${indentBlock(lines.join("\n"))}\n}`;
}

function generateTypeDefinitions(
  moduleName: string,
  properties: ExportableProperty[],
  records: LuauRecord[],
): string | null {
  const entryTypeName = `${toPascalCase(moduleName)}Entry`;
  const moduleTypeName = toPascalCase(moduleName);
  const entryType = generateEntryType(entryTypeName, properties, records);

  if (!entryType) {
    return null;
  }

  const moduleType = generateModuleType(moduleTypeName, entryTypeName, records);
  if (!moduleType) {
    return entryType;
  }

  return `${entryType}\n\n${moduleType}`;
}

function formatModuleTableBody(records: LuauRecord[]): string {
  const sortedRecords = [...records].sort((left, right) =>
    left.key.localeCompare(right.key, "en"),
  );

  if (sortedRecords.length === 0) {
    return "{}";
  }

  const lines = sortedRecords.map((record) => {
    const formattedKey = formatLuauKey(record.key, record.keyFormat);
    const body = formatRecordBody(record);
    const indentedBody = indentBlock(body).trimStart();
    return `${formattedKey} = ${indentedBody},`;
  });

  return `{\n${indentBlock(lines.join("\n"))}\n}`;
}

export function generateModuleScript(
  records: LuauRecord[],
  options: GenerateModuleOptions,
): string {
  const { moduleName, properties, exportTypes } = options;
  const moduleTypeName = toPascalCase(moduleName);
  const typeDefinitions = exportTypes
    ? generateTypeDefinitions(moduleName, properties, records)
    : null;
  const tableBody = formatModuleTableBody(records);
  const typeAnnotation =
    exportTypes && typeDefinitions ? `: ${moduleTypeName}` : "";
  const sections = [
    typeDefinitions,
    `local ${moduleName}${typeAnnotation} = ${tableBody}`,
    "",
    `return ${moduleName}`,
  ].filter((section) => section !== null && section.length > 0);

  return `${sections.join("\n")}\n`;
}

export interface ModuleGenerator {
  generate(records: LuauRecord[], options: GenerateModuleOptions): string;
}

export const defaultModuleGenerator: ModuleGenerator = {
  generate: generateModuleScript,
};
