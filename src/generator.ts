import {
  formatLuauKey,
  formatLuauValue,
  indentBlock,
  resolveLuauKeyFormat,
} from "./formatter.js";
import { toPascalCase } from "./module-name.js";
import type {
  EmptyValueMode,
  ExportableProperty,
  GenerateModuleOptions,
  LuauRecord,
  LuauValue,
} from "./types.js";
import {
  isLuauTable,
  isPropertyValuePresent,
  resolveMissingValue,
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

function relationPropertyToLuauType(
  property: ExportableProperty,
): string | null {
  if (!property.relationMeta) {
    return "{ [string]: any }";
  }

  if (property.relationMeta.kind === "scalar_dict") {
    return `{ [string]: ${property.relationMeta.valueType} }`;
  }

  const fieldLines = sortKeys(
    property.relationMeta.entryProperties.map((entryProperty) => entryProperty.name),
  )
    .map((propertyName) => {
      const entryProperty = property.relationMeta?.kind === "nested_dict"
        ? property.relationMeta.entryProperties.find(
            (item) => item.name === propertyName,
          )
        : undefined;
      const luauType = notionTypeToLuauType(entryProperty?.notionType ?? "string");
      const keyFormat = resolveLuauKeyFormat(propertyName);
      return `${formatLuauKey(propertyName, keyFormat)}: ${luauType}?,`;
    })
    .join("\n");

  return `{ [string]: {\n${indentBlock(fieldLines)}\n} }`;
}

function exportablePropertyToLuauType(property: ExportableProperty): string {
  if (property.notionType === "relation") {
    return relationPropertyToLuauType(property) ?? "{ [string]: any }";
  }

  return notionTypeToLuauType(property.notionType);
}

function findExportableProperty(
  properties: ExportableProperty[],
  propertyName: string,
): ExportableProperty | undefined {
  return properties.find((property) => property.name === propertyName);
}

function resolveOutputValue(
  value: LuauValue,
  emptyValue: EmptyValueMode,
  notionType: string,
): LuauValue | "omit" {
  if (value !== null) {
    return value;
  }

  return resolveMissingValue(emptyValue, notionType);
}

function formatRecordBody(
  record: LuauRecord,
  properties: ExportableProperty[],
  emptyValue: EmptyValueMode,
): string {
  const includeNilKeys = emptyValue === "nil";
  const propertyKeys = sortKeys(Object.keys(record.properties)).filter(
    (propertyKey) => {
      const property = findExportableProperty(properties, propertyKey);
      const notionType = property?.notionType ?? "string";
      return isPropertyValuePresent(
        record.properties[propertyKey],
        emptyValue,
        notionType,
      );
    },
  );

  if (propertyKeys.length === 0) {
    return "{}";
  }

  const lines = propertyKeys.map((propertyKey) => {
    const property = findExportableProperty(properties, propertyKey);
    const notionType = property?.notionType ?? "string";
    const keyFormat = resolveLuauKeyFormat(propertyKey);
    const formattedKey = formatLuauKey(propertyKey, keyFormat);
    const outputValue = resolveOutputValue(
      record.properties[propertyKey],
      emptyValue,
      notionType,
    );
    const formattedValue = formatLuauValue(
      outputValue === "omit" ? null : outputValue,
      includeNilKeys,
    );
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
  emptyValue: EmptyValueMode,
  notionType: string,
): boolean {
  if (!(propertyName in record.properties)) {
    return false;
  }

  const value = record.properties[propertyName];

  if (isLuauTable(value)) {
    return Object.keys(value).length > 0;
  }

  return isPropertyValuePresent(value, emptyValue, notionType);
}

function generateEntryType(
  entryTypeName: string,
  properties: ExportableProperty[],
  records: LuauRecord[],
  emptyValue: EmptyValueMode,
): string | null {
  if (properties.length === 0 || records.length === 0) {
    return null;
  }

  const lines = sortKeys(properties.map((property) => property.name))
    .map((propertyName) => {
      const property = findExportableProperty(properties, propertyName);
      const notionType = property?.notionType ?? "string";
      const presentCount = records.filter((record) =>
        isPropertyPresentInRecord(record, propertyName, emptyValue, notionType),
      ).length;

      if (presentCount === 0) {
        return null;
      }

      const luauType = exportablePropertyToLuauType(
        property ?? { name: propertyName, notionType: "string" },
      );
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
  emptyValue: EmptyValueMode,
): string | null {
  const entryTypeName = `${toPascalCase(moduleName)}Entry`;
  const moduleTypeName = toPascalCase(moduleName);
  const entryType = generateEntryType(
    entryTypeName,
    properties,
    records,
    emptyValue,
  );

  if (!entryType) {
    return null;
  }

  const moduleType = generateModuleType(moduleTypeName, entryTypeName, records);
  if (!moduleType) {
    return entryType;
  }

  return `${entryType}\n\n${moduleType}`;
}

function formatModuleTableBody(
  records: LuauRecord[],
  properties: ExportableProperty[],
  emptyValue: EmptyValueMode,
): string {
  const sortedRecords = [...records].sort((left, right) =>
    left.key.localeCompare(right.key, "en"),
  );

  if (sortedRecords.length === 0) {
    return "{}";
  }

  const lines = sortedRecords.map((record) => {
    const formattedKey = formatLuauKey(record.key, record.keyFormat);
    const body = formatRecordBody(record, properties, emptyValue);
    const indentedBody = indentBlock(body).trimStart();
    return `${formattedKey} = ${indentedBody},`;
  });

  return `{\n${indentBlock(lines.join("\n"))}\n}`;
}

export function generateModuleScript(
  records: LuauRecord[],
  options: GenerateModuleOptions,
): string {
  const { moduleName, properties, exportTypes, outputOptions } = options;
  const emptyValue = outputOptions?.emptyValue ?? "omit";
  const moduleTypeName = toPascalCase(moduleName);
  const typeDefinitions = exportTypes
    ? generateTypeDefinitions(moduleName, properties, records, emptyValue)
    : null;
  const tableBody = formatModuleTableBody(records, properties, emptyValue);
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
