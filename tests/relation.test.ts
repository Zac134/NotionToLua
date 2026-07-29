import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type {
  DataSourceObjectResponse,
  PageObjectResponse,
} from "@notionhq/client/build/src/api-endpoints.js";

import { NotionToLuaError } from "../src/errors.js";
import { formatLuauValue } from "../src/formatter.js";
import { generateModuleScript } from "../src/generator.js";
import {
  createRelationResolutionContext,
  resolveEmbeddedRelationsForRecords,
} from "../src/relation.js";
import type { LuauRecord } from "../src/types.js";

const DEFAULT_TITLE_PROPERTY = "Name";

function createRichText(text: string) {
  return [
    {
      type: "text" as const,
      text: { content: text, link: null },
      annotations: {
        bold: false,
        italic: false,
        strikethrough: false,
        underline: false,
        code: false,
        color: "default" as const,
      },
      plain_text: text,
      href: null,
    },
  ];
}

function createPage(
  id: string,
  name: string,
  properties: PageObjectResponse["properties"] = {},
  titleProperty = DEFAULT_TITLE_PROPERTY,
): PageObjectResponse {
  return {
    object: "page",
    id,
    created_time: "2024-01-01T00:00:00.000Z",
    last_edited_time: "2024-01-01T00:00:00.000Z",
    created_by: { object: "user", id: "user-id" },
    last_edited_by: { object: "user", id: "user-id" },
    cover: null,
    icon: null,
    parent: { type: "database_id", database_id: "database-id" },
    archived: false,
    in_trash: false,
    is_locked: false,
    properties: {
      [titleProperty]: {
        id: "title-id",
        type: "title",
        title: createRichText(name),
      },
      ...properties,
    },
    url: `https://www.notion.so/${id}`,
    public_url: null,
  };
}

function createDataSource(
  id: string,
  properties: DataSourceObjectResponse["properties"],
  titleProperty = DEFAULT_TITLE_PROPERTY,
): DataSourceObjectResponse {
  return {
    object: "data_source",
    id,
    cover: null,
    icon: null,
    created_time: "2024-01-01T00:00:00.000Z",
    created_by: { object: "user", id: "user-id" },
    last_edited_by: { object: "user", id: "user-id" },
    title: createRichText("Test DB"),
    description: [],
    is_inline: false,
    properties: {
      [titleProperty]: {
        id: "title-id",
        name: titleProperty,
        type: "title",
        title: {},
        description: null,
      },
      ...properties,
    },
    parent: { type: "database_id", database_id: "database-id" },
    database_parent: { type: "page_id", page_id: "parent-page-id" },
    url: `https://www.notion.so/${id}`,
    public_url: null,
    archived: false,
    in_trash: false,
  };
}

describe("formatLuauValue nested tables", () => {
  it("formats scalar dictionaries", () => {
    const output = formatLuauValue({
      Fire: 10,
      Ice: 5,
    });

    assert.match(output, /Fire = 10,/);
    assert.match(output, /Ice = 5,/);
  });

  it("formats nested dictionaries", () => {
    const output = formatLuauValue({
      Fire: {
        Power: 10,
        Duration: 3,
      },
    });

    assert.match(output, /Fire = \{/);
    assert.match(output, /Power = 10,/);
    assert.match(output, /Duration = 3,/);
  });

  it("formats sequence arrays", () => {
    const output = formatLuauValue([
      { Damage: 10 },
      { Damage: 20 },
    ]);

    assert.match(output, /Damage = 10,/);
    assert.match(output, /Damage = 20,/);
  });

  it("includes nil keys when requested", () => {
    const output = formatLuauValue({ Fire: null }, true);
    assert.match(output, /Fire = nil,/);
  });
});

describe("resolveEmbeddedRelationsForRecords", () => {
  it("embeds scalar relation dictionaries", async () => {
    const effectsDataSource = createDataSource("effects-ds", {
      Power: {
        id: "power",
        name: "Power",
        type: "number",
        number: { format: "number" },
        description: null,
      },
    });

    const weaponsDataSource = createDataSource("weapons-ds", {
      Damage: {
        id: "damage",
        name: "Damage",
        type: "number",
        number: { format: "number" },
        description: null,
      },
      Effects: {
        id: "effects",
        name: "Effects",
        type: "relation",
        relation: {
          database_id: "effects-db",
          data_source_id: "effects-ds",
        },
        description: null,
      },
    });

    const firePage = createPage("fire-page", "Fire", {
      Power: { id: "power", type: "number", number: 10 },
    });
    const icePage = createPage("ice-page", "Ice", {
      Power: { id: "power", type: "number", number: 5 },
    });
    const swordPage = createPage("sword-page", "Sword", {
      Damage: { id: "damage", type: "number", number: 12 },
      Effects: {
        id: "effects",
        type: "relation",
        relation: [
          { id: "fire-page" },
          { id: "ice-page" },
        ],
        has_more: false,
      },
    });

    const records: LuauRecord[] = [
      {
        key: "Sword",
        keyFormat: "identifier",
        properties: { Damage: 12 },
      },
    ];

    const notion = {
      databases: {
        retrieve: async () => ({
          data_sources: [{ id: "effects-ds" }],
        }),
      },
      dataSources: {
        retrieve: async ({ data_source_id }: { data_source_id: string }) => {
          if (data_source_id === "effects-ds") {
            return effectsDataSource;
          }

          return weaponsDataSource;
        },
      },
      pages: {
        retrieve: async ({ page_id }: { page_id: string }) => {
          if (page_id === "fire-page") {
            return firePage;
          }

          if (page_id === "ice-page") {
            return icePage;
          }

          return swordPage;
        },
      },
    };

    const context = createRelationResolutionContext(
      notion as never,
      {
        format: true,
        exportTypes: true,
        emptyValue: "omit",
        emptyRelation: "omit",
      },
      [swordPage],
    );

    const properties = await resolveEmbeddedRelationsForRecords(
      context,
      records,
      [swordPage],
      weaponsDataSource,
    );

    assert.deepEqual(records[0]?.properties.Effects, {
      Fire: 10,
      Ice: 5,
    });

    const effectsProperty = properties.find(
      (property) => property.name === "Effects",
    );
    assert.equal(effectsProperty?.relationMeta?.kind, "scalar_dict");
    assert.equal(
      effectsProperty?.relationMeta?.kind === "scalar_dict"
        ? effectsProperty.relationMeta.valueType
        : undefined,
      "number",
    );
  });

  it("embeds array relations sorted by numeric titles", async () => {
    const itemDataSource = createDataSource("items-ds", {
      Damage: {
        id: "damage",
        name: "Damage",
        type: "number",
        number: { format: "number" },
        description: null,
      },
    });

    const weaponsDataSource = createDataSource("weapons-ds", {
      "Items [Array]": {
        id: "items",
        name: "Items [Array]",
        type: "relation",
        relation: {
          database_id: "items-db",
          data_source_id: "items-ds",
        },
        description: null,
      },
    });

    const itemTwo = createPage("item-2", "2", {
      Damage: { id: "damage", type: "number", number: 20 },
    });
    const itemTen = createPage("item-10", "10", {
      Damage: { id: "damage", type: "number", number: 100 },
    });
    const swordPage = createPage("sword-page", "Sword", {
      "Items [Array]": {
        id: "items",
        type: "relation",
        relation: [{ id: "item-10" }, { id: "item-2" }],
        has_more: false,
      },
    });

    const records: LuauRecord[] = [
      {
        key: "Sword",
        keyFormat: "identifier",
        properties: {},
      },
    ];

    const notion = {
      databases: {
        retrieve: async () => ({
          data_sources: [{ id: "items-ds" }],
        }),
      },
      dataSources: {
        retrieve: async ({ data_source_id }: { data_source_id: string }) => {
          if (data_source_id === "items-ds") {
            return itemDataSource;
          }

          return weaponsDataSource;
        },
      },
      pages: {
        retrieve: async ({ page_id }: { page_id: string }) => {
          if (page_id === "item-2") {
            return itemTwo;
          }

          if (page_id === "item-10") {
            return itemTen;
          }

          return swordPage;
        },
      },
    };

    const context = createRelationResolutionContext(
      notion as never,
      {
        format: true,
        exportTypes: true,
        emptyValue: "omit",
        emptyRelation: "omit",
      },
      [swordPage],
    );

    const properties = await resolveEmbeddedRelationsForRecords(
      context,
      records,
      [swordPage],
      weaponsDataSource,
    );

    assert.deepEqual(records[0]?.properties.Items, [20, 100]);

    const itemsProperty = properties.find((property) => property.name === "Items");
    assert.equal(itemsProperty?.notionPropertyName, "Items [Array]");
    assert.equal(itemsProperty?.relationMeta?.kind, "scalar_array");
  });

  it("omits empty relations by default", async () => {
    const weaponsDataSource = createDataSource("weapons-ds", {
      Effects: {
        id: "effects",
        name: "Effects",
        type: "relation",
        relation: {
          database_id: "effects-db",
          data_source_id: "effects-ds",
        },
        description: null,
      },
    });

    const swordPage = createPage("sword-page", "Sword", {
      Effects: {
        id: "effects",
        type: "relation",
        relation: [],
        has_more: false,
      },
    });

    const records: LuauRecord[] = [
      {
        key: "Sword",
        keyFormat: "identifier",
        properties: {},
      },
    ];

    const context = createRelationResolutionContext(
      { pages: { retrieve: async () => swordPage } } as never,
      {
        format: true,
        exportTypes: true,
        emptyValue: "omit",
        emptyRelation: "omit",
      },
      [swordPage],
    );

    await resolveEmbeddedRelationsForRecords(
      context,
      records,
      [swordPage],
      weaponsDataSource,
    );

    assert.equal("Effects" in (records[0]?.properties ?? {}), false);
  });

  it("outputs empty tables when empty_relation is empty_table", async () => {
    const weaponsDataSource = createDataSource("weapons-ds", {
      Effects: {
        id: "effects",
        name: "Effects",
        type: "relation",
        relation: {
          database_id: "effects-db",
          data_source_id: "effects-ds",
        },
        description: null,
      },
    });

    const swordPage = createPage("sword-page", "Sword", {
      Effects: {
        id: "effects",
        type: "relation",
        relation: [],
        has_more: false,
      },
    });

    const records: LuauRecord[] = [
      {
        key: "Sword",
        keyFormat: "identifier",
        properties: {},
      },
    ];

    const context = createRelationResolutionContext(
      { pages: { retrieve: async () => swordPage } } as never,
      {
        format: true,
        exportTypes: true,
        emptyValue: "omit",
        emptyRelation: "empty_table",
      },
      [swordPage],
    );

    await resolveEmbeddedRelationsForRecords(
      context,
      records,
      [swordPage],
      weaponsDataSource,
    );

    assert.deepEqual(records[0]?.properties.Effects, {});
  });

  it("throws on circular relations", async () => {
    const effectsDataSource = createDataSource("effects-ds", {
      Power: {
        id: "power",
        name: "Power",
        type: "number",
        number: { format: "number" },
        description: null,
      },
    });

    const dataSource = createDataSource("weapons-ds", {
      Effects: {
        id: "effects",
        name: "Effects",
        type: "relation",
        relation: {
          database_id: "effects-db",
          data_source_id: "effects-ds",
        },
        description: null,
      },
    });

    const page = createPage("page-a", "Sword", {
      Effects: {
        id: "effects",
        type: "relation",
        relation: [{ id: "page-a" }],
        has_more: false,
      },
    });

    const records: LuauRecord[] = [
      {
        key: "Sword",
        keyFormat: "identifier",
        properties: {},
      },
    ];

    const context = createRelationResolutionContext(
      {
        databases: {
          retrieve: async () => ({
            data_sources: [{ id: "effects-ds" }],
          }),
        },
        dataSources: {
          retrieve: async () => effectsDataSource,
        },
        pages: { retrieve: async () => page },
      } as never,
      {
        format: true,
        exportTypes: true,
        emptyValue: "omit",
        emptyRelation: "omit",
      },
      [page],
    );

    await assert.rejects(
      () =>
        resolveEmbeddedRelationsForRecords(
          context,
          records,
          [page],
          dataSource,
        ),
      (error: unknown) => {
        assert.ok(error instanceof NotionToLuaError);
        assert.match(error.message, /Circular relation detected/);
        return true;
      },
    );
  });
});

describe("generateModuleScript relation types", () => {
  it("emits scalar dictionary types for embedded relations", () => {
    const records: LuauRecord[] = [
      {
        key: "Sword",
        keyFormat: "identifier",
        properties: {
          Damage: 12,
          Effects: {
            Fire: 10,
            Ice: 5,
          },
        },
      },
    ];

    const output = generateModuleScript(records, {
      moduleName: "Weapons",
      properties: [
        { name: "Damage", notionType: "number" },
        {
          name: "Effects",
          notionType: "relation",
          relationMeta: { kind: "scalar_dict", valueType: "number" },
        },
      ],
      exportTypes: true,
    });

    assert.match(output, /Effects: \{ \[string\]: number \}/);
    assert.match(output, /Fire = 10,/);
    assert.match(output, /Ice = 5,/);
  });

  it("emits nil values when empty_value is nil", () => {
    const records: LuauRecord[] = [
      {
        key: "Sword",
        keyFormat: "identifier",
        properties: {
          Damage: 12,
          Notes: null,
        },
      },
    ];

    const output = generateModuleScript(records, {
      moduleName: "Weapons",
      properties: [
        { name: "Damage", notionType: "number" },
        { name: "Notes", notionType: "rich_text" },
      ],
      exportTypes: true,
      outputOptions: {
        emptyValue: "nil",
        emptyRelation: "omit",
      },
    });

    assert.match(output, /Notes = nil,/);
  });

  it("emits empty strings for string-like properties when empty_value is empty_string", () => {
    const records: LuauRecord[] = [
      {
        key: "Sword",
        keyFormat: "identifier",
        properties: {
          Notes: null,
          Power: null,
        },
      },
    ];

    const output = generateModuleScript(records, {
      moduleName: "Weapons",
      properties: [
        { name: "Notes", notionType: "rich_text" },
        { name: "Power", notionType: "number" },
      ],
      exportTypes: true,
      outputOptions: {
        emptyValue: "empty_string",
        emptyRelation: "omit",
      },
    });

    assert.match(output, /Notes = "",/);
    assert.doesNotMatch(output, /Power =/);
  });
});
