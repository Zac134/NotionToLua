export type LuauPrimitive = string | number | boolean | string[];

export interface LuauTable {
  [key: string]: LuauValue;
}

export type LuauValue = LuauPrimitive | LuauTable | null;

export type LuauKeyFormat = "identifier" | "bracket";

export type EmptyValueMode = "omit" | "nil" | "empty_string";

export type EmptyRelationMode = "omit" | "empty_table";

export interface OutputOptions {
  emptyValue: EmptyValueMode;
  emptyRelation: EmptyRelationMode;
}

export interface LuauRecord {
  key: string;
  keyFormat: LuauKeyFormat;
  properties: Record<string, LuauValue>;
}

export type ExportableProperty = {
  name: string;
  notionType: string;
  relationMeta?: RelationPropertyMeta;
};

export type RelationPropertyMeta =
  | {
      kind: "scalar_dict";
      valueType: string;
    }
  | {
      kind: "nested_dict";
      entryProperties: ExportableProperty[];
    };

export interface GenerateModuleOptions {
  moduleName: string;
  properties: ExportableProperty[];
  exportTypes: boolean;
  outputOptions?: OutputOptions;
}

export const SUPPORTED_PROPERTY_TYPES = new Set([
  "number",
  "checkbox",
  "rich_text",
  "select",
  "multi_select",
  "date",
  "url",
  "formula",
  "status",
]);

const STRING_LIKE_NOTION_TYPES = new Set([
  "rich_text",
  "select",
  "url",
  "date",
  "status",
]);

export function isLuauTable(value: LuauValue): value is LuauTable {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

export function isStringLikeNotionType(notionType: string): boolean {
  return STRING_LIKE_NOTION_TYPES.has(notionType);
}

export function resolveMissingValue(
  emptyValue: EmptyValueMode,
  notionType: string,
): LuauValue | "omit" {
  if (emptyValue === "nil") {
    return null;
  }

  if (emptyValue === "empty_string" && isStringLikeNotionType(notionType)) {
    return "";
  }

  return "omit";
}

export function shouldIncludeMissingProperty(
  emptyValue: EmptyValueMode,
  notionType: string,
): boolean {
  return resolveMissingValue(emptyValue, notionType) !== "omit";
}

export function formatMissingPropertyValue(
  emptyValue: EmptyValueMode,
  notionType: string,
): LuauValue {
  const resolved = resolveMissingValue(emptyValue, notionType);
  return resolved === "omit" ? null : resolved;
}

export function isPropertyValuePresent(
  value: LuauValue,
  emptyValue: EmptyValueMode,
  notionType: string,
): boolean {
  if (value !== null) {
    return true;
  }

  return shouldIncludeMissingProperty(emptyValue, notionType);
}
