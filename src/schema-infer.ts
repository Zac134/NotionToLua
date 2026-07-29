import { NotionToLuaError } from "./errors.js";
import { formatArrayRelationPropertyName } from "./relation-array.js";
import {
  inferRelationArrayMeta,
} from "./relation-array-infer.js";
import type {
  InferredNotionSchema,
  InferredNotionType,
  InferredProperty,
  LuauRecord,
  LuauValue,
  RobloxTypeName,
} from "./types.js";
import {
  isLuauTable,
  isStringArray,
  isTypedRobloxValue,
} from "./types.js";
import { formatTypedPropertyName } from "./typed-rich-text.js";

function sortPropertyNames(names: string[]): string[] {
  return [...names].sort((left, right) => left.localeCompare(right, "en"));
}

function classifyValue(
  propertyName: string,
  value: LuauValue,
): InferredNotionType {
  if (value === null) {
    throw new NotionToLuaError(
      `Property "${propertyName}" has an unsupported null value during inference.`,
    );
  }

  if (typeof value === "number") {
    return "number";
  }

  if (typeof value === "boolean") {
    return "checkbox";
  }

  if (typeof value === "string") {
    return "rich_text";
  }

  if (isTypedRobloxValue(value)) {
    return "rich_text";
  }

  if (Array.isArray(value)) {
    if (isStringArray(value)) {
      return "multi_select";
    }

    return "relation";
  }

  if (isLuauTable(value)) {
    if (Object.keys(value).length === 0) {
      throw new NotionToLuaError(
        `Property "${propertyName}" has an empty table value, which is not supported.`,
      );
    }

    throw new NotionToLuaError(
      `Property "${propertyName}" has a nested table value, which is not supported.`,
    );
  }

  throw new NotionToLuaError(
    `Property "${propertyName}" has an unsupported value type.`,
  );
}

const RESERVED_TITLE_PROPERTY_NAME = "Name";

function inferProperty(
  propertyName: string,
  records: LuauRecord[],
): InferredProperty | null {
  if (propertyName === RESERVED_TITLE_PROPERTY_NAME) {
    throw new NotionToLuaError(
      `Property "${propertyName}" conflicts with the reserved title column.`,
    );
  }

  const nonNullValues: LuauValue[] = [];

  for (const record of records) {
    if (!(propertyName in record.properties)) {
      continue;
    }

    const value = record.properties[propertyName];
    if (value !== null) {
      nonNullValues.push(value);
    }
  }

  if (nonNullValues.length === 0) {
    return null;
  }

  let notionType: InferredNotionType | undefined;
  let robloxType: RobloxTypeName | undefined;
  const multiSelectOptions = new Set<string>();

  for (const value of nonNullValues) {
    const classified = classifyValue(propertyName, value);

    if (notionType === undefined) {
      notionType = classified;
    } else if (notionType !== classified) {
      throw new NotionToLuaError(
        `Property "${propertyName}" has mixed value types across records.`,
      );
    }

    if (isTypedRobloxValue(value)) {
      if (robloxType === undefined) {
        robloxType = value.kind;
      } else if (robloxType !== value.kind) {
        throw new NotionToLuaError(
          `Property "${propertyName}" has mixed Roblox value types across records.`,
        );
      }
    } else if (robloxType !== undefined && classified === "rich_text") {
      // Allow string fallback alongside typed values for the same property.
    }

    if (classified === "multi_select" && isStringArray(value)) {
      for (const option of value) {
        multiSelectOptions.add(option);
      }
    }
  }

  const property: InferredProperty = {
    name: propertyName,
    notionType: notionType!,
  };

  if (notionType === "relation") {
    property.relationMeta = inferRelationArrayMeta(propertyName, records);
    property.notionPropertyName = formatArrayRelationPropertyName(propertyName);
  }

  if (robloxType) {
    property.robloxType = robloxType;
    property.notionPropertyName = formatTypedPropertyName(
      propertyName,
      robloxType,
    );
  }

  if (notionType === "multi_select") {
    property.multiSelectOptions = sortPropertyNames([...multiSelectOptions]);
  }

  return property;
}

export function inferNotionSchema(records: LuauRecord[]): InferredNotionSchema {
  for (const record of records) {
    if (record.key.trim() === "") {
      throw new NotionToLuaError(
        "Record key is empty. Each top-level table key must be a non-empty title value.",
      );
    }
  }

  const propertyNames = new Set<string>();

  for (const record of records) {
    for (const propertyName of Object.keys(record.properties)) {
      propertyNames.add(propertyName);
    }
  }

  const properties: InferredProperty[] = [];

  for (const propertyName of sortPropertyNames([...propertyNames])) {
    const inferred = inferProperty(propertyName, records);
    if (inferred) {
      properties.push(inferred);
    }
  }

  return {
    titlePropertyName: "Name",
    properties,
  };
}
