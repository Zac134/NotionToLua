export type LuauPrimitive = string | number | boolean | string[];

export type LuauValue = LuauPrimitive | null;

export type LuauKeyFormat = "identifier" | "bracket";

export interface LuauRecord {
  key: string;
  keyFormat: LuauKeyFormat;
  properties: Record<string, LuauValue>;
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

export const NAME_PROPERTY = "Name";
