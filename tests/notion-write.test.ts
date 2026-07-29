import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { NotionToLuaError } from "../src/errors.js";
import {
  createDatabaseFromSchema,
  insertRecords,
  luauValueToNotionProperty,
} from "../src/notion-write.js";
import { serializeNotionValue } from "../src/typed-rich-text.js";
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

  it("converts TypedRobloxValue to serialized rich_text", () => {
    const value = { kind: "Vector3", x: 1, y: 2, z: 3 } as const;

    assert.deepEqual(luauValueToNotionProperty("rich_text", value), {
      rich_text: [
        {
          type: "text",
          text: { content: serializeNotionValue(value) },
        },
      ],
    });
  });

  it("throws on type mismatch for number", () => {
    assert.throws(
      () => luauValueToNotionProperty("number", "not a number"),
      (error: unknown) => {
        assert.ok(error instanceof NotionToLuaError);
        assert.match(error.message, /numeric value/);
        return true;
      },
    );
  });

  it("throws on type mismatch for rich_text", () => {
    assert.throws(
      () => luauValueToNotionProperty("rich_text", 42),
      (error: unknown) => {
        assert.ok(error instanceof NotionToLuaError);
        assert.match(error.message, /string value/);
        return true;
      },
    );
  });

  it("throws for relation notionType", () => {
    assert.throws(
      () => luauValueToNotionProperty("relation", []),
      (error: unknown) => {
        assert.ok(error instanceof NotionToLuaError);
        assert.match(
          error.message,
          /Relation property values must be created as related pages/,
        );
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

    assert.equal(result.databaseId, "database-id");
    assert.equal(result.dataSourceId, "data-source-id");
    assert.equal(result.properties.length, 4);
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

  it("throws when create response omits data_sources", async () => {
    const notion = {
      databases: {
        create: async () => ({
          id: "database-id",
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
        assert.match(error.message, /data source information is unavailable/);
        return true;
      },
    );
  });

  it("creates related database for scalar_array relation", async () => {
    const createCalls: unknown[] = [];
    let callIndex = 0;

    const notion = {
      databases: {
        create: async (args: unknown) => {
          createCalls.push(args);
          callIndex += 1;

          if (callIndex === 1) {
            return {
              id: "related-database-id",
              data_sources: [
                { id: "related-data-source-id", name: "Items - effects" },
              ],
            };
          }

          return {
            id: "parent-database-id",
            data_sources: [{ id: "parent-data-source-id", name: "Items" }],
          };
        },
      },
    };

    const relationSchema: InferredNotionSchema = {
      titlePropertyName: "Name",
      properties: [
        { name: "damage", notionType: "number" },
        {
          name: "effects",
          notionType: "relation",
          relationMeta: { kind: "scalar_array", valueType: "number" },
        },
      ],
    };

    const result = await createDatabaseFromSchema(notion as never, {
      pageId: "parent-page-id",
      databaseTitle: "Items",
      schema: relationSchema,
    });

    assert.equal(createCalls.length, 2);
    assert.deepEqual(createCalls[0], {
      parent: { type: "page_id", page_id: "parent-page-id" },
      title: [{ type: "text", text: { content: "Items - effects" } }],
      initial_data_source: {
        properties: {
          Name: { title: {} },
          Value: { number: {} },
        },
      },
    });
    assert.deepEqual(createCalls[1], {
      parent: { type: "page_id", page_id: "parent-page-id" },
      title: [{ type: "text", text: { content: "Items" } }],
      initial_data_source: {
        properties: {
          Name: { title: {} },
          damage: { number: {} },
          effects: {
            relation: {
              data_source_id: "related-data-source-id",
              type: "single_property",
              single_property: {},
            },
          },
        },
      },
    });
    assert.equal(result.databaseId, "parent-database-id");
    assert.equal(result.dataSourceId, "parent-data-source-id");
    assert.equal(result.properties[1]?.relatedDataSourceId, "related-data-source-id");
  });

  it("creates related database for nested_array relation", async () => {
    const createCalls: unknown[] = [];
    let callIndex = 0;

    const notion = {
      databases: {
        create: async (args: unknown) => {
          createCalls.push(args);
          callIndex += 1;

          if (callIndex === 1) {
            return {
              id: "related-database-id",
              data_sources: [
                { id: "related-data-source-id", name: "Items - items" },
              ],
            };
          }

          return {
            id: "parent-database-id",
            data_sources: [{ id: "parent-data-source-id", name: "Items" }],
          };
        },
      },
    };

    const relationSchema: InferredNotionSchema = {
      titlePropertyName: "Name",
      properties: [
        {
          name: "items",
          notionType: "relation",
          relationMeta: {
            kind: "nested_array",
            entryProperties: [
              { name: "label", notionType: "rich_text" },
              { name: "amount", notionType: "number" },
            ],
          },
        },
      ],
    };

    const result = await createDatabaseFromSchema(notion as never, {
      pageId: "parent-page-id",
      databaseTitle: "Items",
      schema: relationSchema,
    });

    assert.equal(createCalls.length, 2);
    assert.deepEqual(createCalls[0], {
      parent: { type: "page_id", page_id: "parent-page-id" },
      title: [{ type: "text", text: { content: "Items - items" } }],
      initial_data_source: {
        properties: {
          Name: { title: {} },
          label: { rich_text: {} },
          amount: { number: {} },
        },
      },
    });
    assert.deepEqual(createCalls[1], {
      parent: { type: "page_id", page_id: "parent-page-id" },
      title: [{ type: "text", text: { content: "Items" } }],
      initial_data_source: {
        properties: {
          Name: { title: {} },
          items: {
            relation: {
              data_source_id: "related-data-source-id",
              type: "single_property",
              single_property: {},
            },
          },
        },
      },
    });
    assert.equal(result.properties[0]?.relatedDataSourceId, "related-data-source-id");
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

  const relationProperties = [
    {
      name: "effects",
      notionType: "relation" as const,
      relationMeta: { kind: "scalar_array", valueType: "number" } as const,
      relatedDataSourceId: "related-data-source-id",
    },
  ];

  it("creates child pages and links scalar_array relation on parent", async () => {
    const createdPages: unknown[] = [];
    let pageIndex = 0;

    const notion = {
      pages: {
        create: async (args: unknown) => {
          createdPages.push(args);
          pageIndex += 1;
          return { id: `page-${pageIndex}` };
        },
      },
    };

    const result = await insertRecords(notion as never, {
      dataSourceId: "parent-data-source-id",
      titlePropertyName: "Name",
      properties: relationProperties,
      records: [
        record("Sword", {
          effects: [10, 20],
        }),
      ],
    });

    assert.equal(result.insertedCount, 1);
    assert.equal(createdPages.length, 3);
    assert.deepEqual(createdPages[0], {
      parent: {
        type: "data_source_id",
        data_source_id: "related-data-source-id",
      },
      properties: {
        Name: {
          title: [{ type: "text", text: { content: "1" } }],
        },
        Value: { number: 10 },
      },
    });
    assert.deepEqual(createdPages[1], {
      parent: {
        type: "data_source_id",
        data_source_id: "related-data-source-id",
      },
      properties: {
        Name: {
          title: [{ type: "text", text: { content: "2" } }],
        },
        Value: { number: 20 },
      },
    });
    assert.deepEqual(createdPages[2], {
      parent: {
        type: "data_source_id",
        data_source_id: "parent-data-source-id",
      },
      properties: {
        Name: {
          title: [{ type: "text", text: { content: "Sword" } }],
        },
        effects: {
          relation: [{ id: "page-1" }, { id: "page-2" }],
        },
      },
    });
  });

  it("creates child pages and links nested_array relation on parent", async () => {
    const createdPages: unknown[] = [];
    let pageIndex = 0;

    const notion = {
      pages: {
        create: async (args: unknown) => {
          createdPages.push(args);
          pageIndex += 1;
          return { id: `page-${pageIndex}` };
        },
      },
    };

    const nestedRelationProperties = [
      {
        name: "items",
        notionType: "relation" as const,
        relationMeta: {
          kind: "nested_array",
          entryProperties: [
            { name: "label", notionType: "rich_text" },
            { name: "amount", notionType: "number" },
          ],
        } as const,
        relatedDataSourceId: "related-data-source-id",
      },
    ];

    const result = await insertRecords(notion as never, {
      dataSourceId: "parent-data-source-id",
      titlePropertyName: "Name",
      properties: nestedRelationProperties,
      records: [
        record("Chest", {
          items: [
            { label: "Gold", amount: 100 },
            { label: "Silver", amount: 50 },
          ],
        }),
      ],
    });

    assert.equal(result.insertedCount, 1);
    assert.equal(createdPages.length, 3);
    assert.deepEqual(createdPages[0], {
      parent: {
        type: "data_source_id",
        data_source_id: "related-data-source-id",
      },
      properties: {
        Name: {
          title: [{ type: "text", text: { content: "1" } }],
        },
        label: {
          rich_text: [{ type: "text", text: { content: "Gold" } }],
        },
        amount: { number: 100 },
      },
    });
    assert.deepEqual(createdPages[1], {
      parent: {
        type: "data_source_id",
        data_source_id: "related-data-source-id",
      },
      properties: {
        Name: {
          title: [{ type: "text", text: { content: "2" } }],
        },
        label: {
          rich_text: [{ type: "text", text: { content: "Silver" } }],
        },
        amount: { number: 50 },
      },
    });
    assert.deepEqual(createdPages[2], {
      parent: {
        type: "data_source_id",
        data_source_id: "parent-data-source-id",
      },
      properties: {
        Name: {
          title: [{ type: "text", text: { content: "Chest" } }],
        },
        items: {
          relation: [{ id: "page-1" }, { id: "page-2" }],
        },
      },
    });
  });

  it("throws when relation value is a string array", async () => {
    const notion = {
      pages: {
        create: async () => {
          throw new Error("pages.create should not be called");
        },
      },
    };

    await assert.rejects(
      () =>
        insertRecords(notion as never, {
          dataSourceId: "parent-data-source-id",
          titlePropertyName: "Name",
          properties: relationProperties,
          records: [
            record("Sword", {
              effects: ["Fire", "Ice"],
            }),
          ],
        }),
      (error: unknown) => {
        assert.ok(error instanceof NotionToLuaError);
        assert.match(error.message, /requires a Luau array value/);
        return true;
      },
    );
  });

  it("throws when relation value is not an array", async () => {
    const notion = {
      pages: {
        create: async () => {
          throw new Error("pages.create should not be called");
        },
      },
    };

    await assert.rejects(
      () =>
        insertRecords(notion as never, {
          dataSourceId: "parent-data-source-id",
          titlePropertyName: "Name",
          properties: relationProperties,
          records: [
            record("Sword", {
              effects: 10,
            }),
          ],
        }),
      (error: unknown) => {
        assert.ok(error instanceof NotionToLuaError);
        assert.match(error.message, /requires a Luau array value/);
        return true;
      },
    );
  });
});
