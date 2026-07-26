import type { Client } from "@notionhq/client";
import type {
  CreatePageParameters,
  PropertyConfigurationRequest,
} from "@notionhq/client/build/src/api-endpoints.js";

import { NotionToLuaError } from "./errors.js";
import type {
  InferredNotionSchema,
  InferredProperty,
  LuauRecord,
  LuauValue,
} from "./types.js";

type NotionWriteClient = Pick<Client, "databases" | "pages">;

type WriteNotionType = InferredProperty["notionType"] | "title";

type NotionPageProperty = NonNullable<
  CreatePageParameters["properties"]
>[string];

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
      if (typeof value !== "string") {
        throw new NotionToLuaError(
          "Rich text property requires a string value.",
        );
      }

      return {
        rich_text: [{ type: "text", text: { content: value } }],
      };
    case "multi_select":
      if (!Array.isArray(value)) {
        throw new NotionToLuaError(
          "Multi-select property requires a string array value.",
        );
      }

      return {
        multi_select: value.map((name) => ({ name })),
      };
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
    default: {
      const exhaustive: never = property.notionType;
      throw new NotionToLuaError(
        `Unsupported property type "${exhaustive as string}".`,
      );
    }
  }
}

function buildDatabaseProperties(
  schema: InferredNotionSchema,
): Record<string, PropertyConfigurationRequest> {
  const properties: Record<string, PropertyConfigurationRequest> = {
    [schema.titlePropertyName]: { title: {} },
  };

  for (const property of schema.properties) {
    properties[property.name] = schemaPropertyToNotionConfig(property);
  }

  return properties;
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

export async function createDatabaseFromSchema(
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
      properties: buildDatabaseProperties(args.schema),
    },
  });

  return {
    databaseId: database.id,
    dataSourceId: resolveDataSourceId(database),
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

      pageProperties[property.name] = luauValueToNotionProperty(
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
