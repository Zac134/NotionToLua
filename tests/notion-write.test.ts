import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { NotionToLuaError } from "../src/errors.js";
import {
  createDatabaseFromSchema,
  insertRecords,
  luauValueToNotionProperty,
} from "../src/notion-write.js";
import type { InferredNotionSchema, LuauRecord } from "../src/types.js";

function record(
  key: string,
  properties: LuauRecord["properties"],
): LuauRecord {
  return {
    key,
    keyFormat: "identifier",
    properties,
  };
}

describe("luauValueToNotionProperty", () => {
  it("converts title", () => {
    assert.deepEqual(luauValueToNotionProperty("title", "Sword"), {
      title: [{ type: "text", text: { content: "Sword" } }],
    });
  });

  it("converts number", () => {
    assert.deepEqual(luauValueToNotionProperty("number", 10), {
      number: 10,
    });
  });

  it("converts checkbox", () => {
    assert.deepEqual(luauValueToNotionProperty("checkbox", true), {
      checkbox: true,
    });
    assert.deepEqual(luauValueToNotionProperty("checkbox", false), {
      checkbox: false,
    });
  });

  it("converts rich_text", () => {
    assert.deepEqual(luauValueToNotionProperty("rich_text", "sharp"), {
      rich_text: [{ type: "text", text: { content: "sharp" } }],
    });
  });

  it("converts multi_select", () => {
    assert.deepEqual(
      luauValueToNotionProperty("multi_select", ["Fire", "Melee"]),
      {
        multi_select: [{ name: "Fire" }, { name: "Melee" }],
      },
    );
  });

  it("throws on null values", () => {
    assert.throws(
      () => luauValueToNotionProperty("number", null),
      (error: unknown) => {
        assert.ok(error instanceof NotionToLuaError);
        assert.match(error.message, /null value/);
        return true;
      },
    );
  });
});

describe("createDatabaseFromSchema", () => {
  const schema: InferredNotionSchema = {
    titlePropertyName: "Name",
    properties: [
      { name: "damage", notionType: "number" },
      { name: "enabled", notionType: "checkbox" },
      { name: "description", notionType: "rich_text" },
      {
        name: "tags",
        notionType: "multi_select",
        multiSelectOptions: ["Fire", "Ice"],
      },
    ],
  };

  it("creates a database with Name and inferred properties", async () => {
    let createArgs: unknown;

    const notion = {
      databases: {
        create: async (args: unknown) => {
          createArgs = args;
          return {
            id: "database-id",
            data_sources: [{ id: "data-source-id", name: "Test DB" }],
          };
        },
      },
    };

    const result = await createDatabaseFromSchema(notion as never, {
      pageId: "parent-page-id",
      databaseTitle: "Items",
      schema,
    });

    assert.deepEqual(result, {
      databaseId: "database-id",
      dataSourceId: "data-source-id",
    });
    assert.deepEqual(createArgs, {
      parent: { type: "page_id", page_id: "parent-page-id" },
      title: [{ type: "text", text: { content: "Items" } }],
      initial_data_source: {
        properties: {
          Name: { title: {} },
          damage: { number: {} },
          enabled: { checkbox: {} },
          description: { rich_text: {} },
          tags: {
            multi_select: {
              options: [{ name: "Fire" }, { name: "Ice" }],
            },
          },
        },
      },
    });
  });

  it("throws when the database has no data sources", async () => {
    const notion = {
      databases: {
        create: async () => ({
          id: "database-id",
          data_sources: [],
        }),
      },
    };

    await assert.rejects(
      () =>
        createDatabaseFromSchema(notion as never, {
          pageId: "parent-page-id",
          databaseTitle: "Items",
          schema,
        }),
      (error: unknown) => {
        assert.ok(error instanceof NotionToLuaError);
        assert.match(error.message, /no data sources/);
        return true;
      },
    );
  });

  it("throws when the database has multiple data sources", async () => {
    const notion = {
      databases: {
        create: async () => ({
          id: "database-id",
          data_sources: [
            { id: "data-source-a", name: "A" },
            { id: "data-source-b", name: "B" },
          ],
        }),
      },
    };

    await assert.rejects(
      () =>
        createDatabaseFromSchema(notion as never, {
          pageId: "parent-page-id",
          databaseTitle: "Items",
          schema,
        }),
      (error: unknown) => {
        assert.ok(error instanceof NotionToLuaError);
        assert.match(error.message, /multiple data sources/);
        return true;
      },
    );
  });
});

describe("insertRecords", () => {
  const properties = [
    { name: "damage", notionType: "number" as const },
    { name: "enabled", notionType: "checkbox" as const },
    { name: "description", notionType: "rich_text" as const },
    {
      name: "tags",
      notionType: "multi_select" as const,
      multiSelectOptions: ["Fire", "Ice"],
    },
  ];

  it("creates pages with Name and non-null properties only", async () => {
    const createdPages: unknown[] = [];

    const notion = {
      pages: {
        create: async (args: unknown) => {
          createdPages.push(args);
          return { id: `page-${createdPages.length}` };
        },
      },
    };

    const result = await insertRecords(notion as never, {
      dataSourceId: "data-source-id",
      titlePropertyName: "Name",
      properties,
      records: [
        record("Sword", {
          damage: 10,
          enabled: true,
          description: "sharp",
          tags: ["Fire"],
          notes: null,
        }),
        record("Bow", {
          damage: 5,
          enabled: false,
          description: null,
        }),
      ],
    });

    assert.equal(result.insertedCount, 2);
    assert.deepEqual(createdPages, [
      {
        parent: { type: "data_source_id", data_source_id: "data-source-id" },
        properties: {
          Name: {
            title: [{ type: "text", text: { content: "Sword" } }],
          },
          damage: { number: 10 },
          enabled: { checkbox: true },
          description: {
            rich_text: [{ type: "text", text: { content: "sharp" } }],
          },
          tags: { multi_select: [{ name: "Fire" }] },
        },
      },
      {
        parent: { type: "data_source_id", data_source_id: "data-source-id" },
        properties: {
          Name: {
            title: [{ type: "text", text: { content: "Bow" } }],
          },
          damage: { number: 5 },
          enabled: { checkbox: false },
        },
      },
    ]);
  });

  it("returns zero when no records are provided", async () => {
    const notion = {
      pages: {
        create: async () => {
          throw new Error("pages.create should not be called");
        },
      },
    };

    const result = await insertRecords(notion as never, {
      dataSourceId: "data-source-id",
      titlePropertyName: "Name",
      properties,
      records: [],
    });

    assert.equal(result.insertedCount, 0);
  });
});
