import type { Client } from "@notionhq/client";
import type {
  CreatePageParameters,
  PropertyConfigurationRequest,
} from "@notionhq/client/build/src/api-endpoints.js";

import { NotionToLuaError } from "./errors.js";
import { extractScalarArrayColumnName } from "./relation-array-infer.js";
import { serializeNotionValue } from "./typed-rich-text.js";
import type {
  InferredNotionSchema,
  InferredProperty,
  LuauRecord,
  LuauValue,
  RelationPropertyMeta,
} from "./types.js";
import { isLuauTable, isStringArray, isTypedRobloxValue } from "./types.js";

type NotionWriteClient = Pick<Client, "databases" | "pages">;

type WriteNotionType = InferredProperty["notionType"] | "title";

type NotionPageProperty = NonNullable<
  CreatePageParameters["properties"]
>[string];

const SCALAR_ARRAY_VALUE_COLUMN = "Value";

export function luauValueToNotionProperty(
  notionType: WriteNotionType,
  value: LuauValue,
): NotionPageProperty {
  if (value === null) {
    throw new NotionToLuaError(
      `Cannot convert null value for property type "${notionType}".`,
    );
  }

  switch (notionType) {
    case "title":
      if (typeof value !== "string") {
        throw new NotionToLuaError("Title property requires a string value.");
      }

      return {
        title: [{ type: "text", text: { content: value } }],
      };
    case "number":
      if (typeof value !== "number") {
        throw new NotionToLuaError("Number property requires a numeric value.");
      }

      return { number: value };
    case "checkbox":
      if (typeof value !== "boolean") {
        throw new NotionToLuaError(
          "Checkbox property requires a boolean value.",
        );
      }

      return { checkbox: value };
    case "rich_text":
      if (isTypedRobloxValue(value)) {
        return {
          rich_text: [
            {
              type: "text",
              text: { content: serializeNotionValue(value) },
            },
          ],
        };
      }

      if (typeof value !== "string") {
        throw new NotionToLuaError(
          "Rich text property requires a string value.",
        );
      }

      return {
        rich_text: [{ type: "text", text: { content: value } }],
      };
    case "multi_select":
      if (!Array.isArray(value) || !isStringArray(value)) {
        throw new NotionToLuaError(
          "Multi-select property requires a string array value.",
        );
      }

      return {
        multi_select: value.map((name) => ({ name })),
      };
    case "relation":
      throw new NotionToLuaError(
        "Relation property values must be created as related pages before linking.",
      );
    default: {
      const exhaustive: never = notionType;
      throw new NotionToLuaError(
        `Unsupported property type "${exhaustive as string}".`,
      );
    }
  }
}

function schemaPropertyToNotionConfig(
  property: InferredProperty,
): PropertyConfigurationRequest {
  switch (property.notionType) {
    case "number":
      return { number: {} };
    case "checkbox":
      return { checkbox: {} };
    case "rich_text":
      return { rich_text: {} };
    case "multi_select":
      return {
        multi_select: {
          options: (property.multiSelectOptions ?? []).map((name) => ({
            name,
          })),
        },
      };
    case "relation":
      if (!property.relatedDataSourceId) {
        throw new NotionToLuaError(
          `Relation property "${property.name}" is missing a linked data source.`,
        );
      }

      return {
        relation: {
          data_source_id: property.relatedDataSourceId,
          type: "single_property",
          single_property: {},
        },
      };
    default: {
      const exhaustive: never = property.notionType;
      throw new NotionToLuaError(
        `Unsupported property type "${exhaustive as string}".`,
      );
    }
  }
}

function buildRelatedDatabaseSchema(
  property: InferredProperty,
): InferredNotionSchema {
  const meta = property.relationMeta;
  if (!meta) {
    throw new NotionToLuaError(
      `Relation property "${property.name}" is missing relation metadata.`,
    );
  }

  if (meta.kind === "scalar_array") {
    return {
      titlePropertyName: "Name",
      properties: [
        {
          name: SCALAR_ARRAY_VALUE_COLUMN,
          notionType: extractScalarArrayColumnName(meta),
        },
      ],
    };
  }

  if (meta.kind === "nested_array") {
    return {
      titlePropertyName: "Name",
      properties: meta.entryProperties.map((entryProperty) => ({
        name: entryProperty.name,
        notionType: entryProperty.notionType as InferredProperty["notionType"],
      })),
    };
  }

  throw new NotionToLuaError(
    `Relation property "${property.name}" has unsupported relation metadata for push.`,
  );
}

function buildDatabaseProperties(
  schema: InferredNotionSchema,
  properties: InferredProperty[],
): Record<string, PropertyConfigurationRequest> {
  const notionProperties: Record<string, PropertyConfigurationRequest> = {
    [schema.titlePropertyName]: { title: {} },
  };

  for (const property of properties) {
    const notionPropertyName = property.notionPropertyName ?? property.name;
    notionProperties[notionPropertyName] = schemaPropertyToNotionConfig(property);
  }

  return notionProperties;
}

function resolveDataSourceId(database: {
  id: string;
  data_sources?: Array<{ id: string }>;
}): string {
  if (!("data_sources" in database) || !database.data_sources) {
    throw new NotionToLuaError(
      "Database was created but data source information is unavailable.",
    );
  }

  if (database.data_sources.length === 0) {
    throw new NotionToLuaError(
      "Database not found or it has no data sources.",
    );
  }

  if (database.data_sources.length > 1) {
    throw new NotionToLuaError(
      "Created database has multiple data sources; expected exactly one.",
    );
  }

  return database.data_sources[0].id;
}

async function createRelatedDatabase(
  notion: NotionWriteClient,
  args: {
    pageId: string;
    databaseTitle: string;
    schema: InferredNotionSchema;
  },
): Promise<{ databaseId: string; dataSourceId: string }> {
  const database = await notion.databases.create({
    parent: { type: "page_id", page_id: args.pageId },
    title: [{ type: "text", text: { content: args.databaseTitle } }],
    initial_data_source: {
      properties: buildDatabaseProperties(args.schema, args.schema.properties),
    },
  });

  return {
    databaseId: database.id,
    dataSourceId: resolveDataSourceId(database),
  };
}

function buildChildPageProperties(
  meta: RelationPropertyMeta,
  value: LuauValue,
): Record<string, NotionPageProperty> {
  const properties: Record<string, NotionPageProperty> = {};

  if (meta.kind === "scalar_array") {
    properties[SCALAR_ARRAY_VALUE_COLUMN] = luauValueToNotionProperty(
      extractScalarArrayColumnName(meta),
      value,
    );
    return properties;
  }

  if (meta.kind === "nested_array") {
    if (!isLuauTable(value)) {
      throw new NotionToLuaError(
        "Nested array relation entries must be tables.",
      );
    }

    const entryTable: Record<string, LuauValue> = value;

    for (const entryProperty of meta.entryProperties) {
      if (!(entryProperty.name in entryTable)) {
        continue;
      }

      const entryValue = entryTable[entryProperty.name];
      if (entryValue === null) {
        continue;
      }

      properties[entryProperty.name] = luauValueToNotionProperty(
        entryProperty.notionType as InferredProperty["notionType"],
        entryValue,
      );
    }

    return properties;
  }

  throw new NotionToLuaError(
    "Unsupported relation metadata for child page creation.",
  );
}

async function createRelatedPagesForArrayRelation(
  notion: NotionWriteClient,
  args: {
    dataSourceId: string;
    relationMeta: RelationPropertyMeta;
    values: LuauValue[];
  },
): Promise<string[]> {
  const relatedPageIds: string[] = [];

  for (let index = 0; index < args.values.length; index += 1) {
    const childPage = await notion.pages.create({
      parent: { type: "data_source_id", data_source_id: args.dataSourceId },
      properties: {
        Name: luauValueToNotionProperty("title", String(index + 1)),
        ...buildChildPageProperties(args.relationMeta, args.values[index]!),
      },
    });

    relatedPageIds.push(childPage.id);
  }

  return relatedPageIds;
}

export async function createDatabaseFromSchema(
  notion: NotionWriteClient,
  args: {
    pageId: string;
    databaseTitle: string;
    schema: InferredNotionSchema;
  },
): Promise<{
  databaseId: string;
  dataSourceId: string;
  properties: InferredProperty[];
}> {
  const resolvedProperties: InferredProperty[] = [];

  for (const property of args.schema.properties) {
    if (property.notionType === "relation" && property.relationMeta) {
      const relatedDatabase = await createRelatedDatabase(notion, {
        pageId: args.pageId,
        databaseTitle: `${args.databaseTitle} - ${property.name}`,
        schema: buildRelatedDatabaseSchema(property),
      });

      resolvedProperties.push({
        ...property,
        relatedDataSourceId: relatedDatabase.dataSourceId,
      });
      continue;
    }

    resolvedProperties.push(property);
  }

  const database = await notion.databases.create({
    parent: { type: "page_id", page_id: args.pageId },
    title: [{ type: "text", text: { content: args.databaseTitle } }],
    initial_data_source: {
      properties: buildDatabaseProperties(args.schema, resolvedProperties),
    },
  });

  return {
    databaseId: database.id,
    dataSourceId: resolveDataSourceId(database),
    properties: resolvedProperties,
  };
}

export async function insertRecords(
  notion: NotionWriteClient,
  args: {
    dataSourceId: string;
    titlePropertyName: "Name";
    properties: InferredProperty[];
    records: LuauRecord[];
  },
): Promise<{ insertedCount: number }> {
  let insertedCount = 0;

  for (const record of args.records) {
    const pageProperties: NonNullable<CreatePageParameters["properties"]> = {
      [args.titlePropertyName]: luauValueToNotionProperty("title", record.key),
    };

    for (const property of args.properties) {
      if (!(property.name in record.properties)) {
        continue;
      }

      const value = record.properties[property.name];
      if (value === null) {
        continue;
      }

      const notionPropertyName = property.notionPropertyName ?? property.name;

      if (
        property.notionType === "relation" &&
        property.relationMeta &&
        property.relatedDataSourceId
      ) {
        if (!Array.isArray(value) || isStringArray(value)) {
          throw new NotionToLuaError(
            `Relation property "${property.name}" requires a Luau array value.`,
          );
        }

        const relatedPageIds = await createRelatedPagesForArrayRelation(notion, {
          dataSourceId: property.relatedDataSourceId,
          relationMeta: property.relationMeta,
          values: value,
        });

        pageProperties[notionPropertyName] = {
          relation: relatedPageIds.map((id) => ({ id })),
        };
        continue;
      }

      pageProperties[notionPropertyName] = luauValueToNotionProperty(
        property.notionType,
        value,
      );
    }

    await notion.pages.create({
      parent: { type: "data_source_id", data_source_id: args.dataSourceId },
      properties: pageProperties,
    });

    insertedCount += 1;
  }

  return { insertedCount };
}
