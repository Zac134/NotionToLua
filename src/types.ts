export type LuauPrimitive = string | number | boolean | string[];

export type LuauValue = LuauPrimitive | null;

export type LuauKeyFormat = "identifier" | "bracket";

export interface LuauRecord {
  key: string;
  keyFormat: LuauKeyFormat;
  properties: Record<string, LuauValue>;
}

export interface GenerateLuauInput {
  pageId: string;
  databaseId: string;
}

export interface ToolSuccessResult {
  success: true;
  message: string;
  recordCount: number;
  codeBlockAction: "updated" | "created";
  error: null;
}

export interface ToolErrorResult {
  success: false;
  message: string;
  recordCount: null;
  codeBlockAction: null;
  error: string;
}

export type ToolResult = ToolSuccessResult | ToolErrorResult;

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
