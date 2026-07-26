import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type {
  DataSourceObjectResponse,
  PageObjectResponse,
} from "@notionhq/client/build/src/api-endpoints.js";

import { NotionToLuaError } from "../src/errors.js";
import {
  convertPropertyValue,
  extractTitleKey,
  pagesToLuauRecords,
  resolveTitlePropertyName,
} from "../src/notion.js";

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
  name: string,
  properties: PageObjectResponse["properties"] = {},
  titleProperty = DEFAULT_TITLE_PROPERTY,
): PageObjectResponse {
  return {
    object: "page",
    id: "page-id",
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
    url: "https://www.notion.so/page-id",
    public_url: null,
  };
}

function createDataSource(
  properties: DataSourceObjectResponse["properties"],
  titleProperty = DEFAULT_TITLE_PROPERTY,
): DataSourceObjectResponse {
  return {
    object: "data_source",
    id: "data-source-id",
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
    url: "https://www.notion.so/data-source-id",
    public_url: null,
    archived: false,
    in_trash: false,
  };
}

describe("convertPropertyValue", () => {
  it("converts number", () => {
    assert.equal(
      convertPropertyValue({ id: "n", type: "number", number: 42 }),
      42,
    );
    assert.equal(
      convertPropertyValue({ id: "n", type: "number", number: null }),
      null,
    );
  });

  it("converts checkbox", () => {
    assert.equal(
      convertPropertyValue({ id: "c", type: "checkbox", checkbox: true }),
      true,
    );
    assert.equal(
      convertPropertyValue({ id: "c", type: "checkbox", checkbox: false }),
      false,
    );
  });

  it("converts rich_text", () => {
    assert.equal(
      convertPropertyValue({
        id: "t",
        type: "rich_text",
        rich_text: createRichText("hello"),
      }),
      "hello",
    );
    assert.equal(
      convertPropertyValue({ id: "t", type: "rich_text", rich_text: [] }),
      null,
    );
  });

  it("converts select", () => {
    assert.equal(
      convertPropertyValue({
        id: "s",
        type: "select",
        select: { id: "opt-1", name: "Option A", color: "blue" },
      }),
      "Option A",
    );
    assert.equal(
      convertPropertyValue({ id: "s", type: "select", select: null }),
      null,
    );
  });

  it("converts multi_select", () => {
    assert.deepEqual(
      convertPropertyValue({
        id: "ms",
        type: "multi_select",
        multi_select: [
          { id: "a", name: "Alpha", color: "green" },
          { id: "b", name: "Beta", color: "red" },
        ],
      }),
      ["Alpha", "Beta"],
    );
    assert.equal(
      convertPropertyValue({
        id: "ms",
        type: "multi_select",
        multi_select: [],
      }),
      null,
    );
  });

  it("converts date", () => {
    assert.equal(
      convertPropertyValue({
        id: "d",
        type: "date",
        date: { start: "2024-01-01", end: null, time_zone: null },
      }),
      "2024-01-01",
    );
    assert.equal(
      convertPropertyValue({ id: "d", type: "date", date: null }),
      null,
    );
  });

  it("converts url", () => {
    assert.equal(
      convertPropertyValue({
        id: "u",
        type: "url",
        url: "https://example.com",
      }),
      "https://example.com",
    );
    assert.equal(
      convertPropertyValue({ id: "u", type: "url", url: null }),
      null,
    );
  });

  it("converts formula variants", () => {
    assert.equal(
      convertPropertyValue({
        id: "f",
        type: "formula",
        formula: { type: "string", string: "text" },
      }),
      "text",
    );
    assert.equal(
      convertPropertyValue({
        id: "f",
        type: "formula",
        formula: { type: "number", number: 7 },
      }),
      7,
    );
    assert.equal(
      convertPropertyValue({
        id: "f",
        type: "formula",
        formula: { type: "boolean", boolean: true },
      }),
      true,
    );
    assert.equal(
      convertPropertyValue({
        id: "f",
        type: "formula",
        formula: {
          type: "date",
          date: { start: "2024-06-01", end: null, time_zone: null },
        },
      }),
      "2024-06-01",
    );
  });

  it("converts status", () => {
    assert.equal(
      convertPropertyValue({
        id: "st",
        type: "status",
        status: { id: "done", name: "Done", color: "green" },
      }),
      "Done",
    );
    assert.equal(
      convertPropertyValue({ id: "st", type: "status", status: null }),
      null,
    );
  });

  it("returns undefined for unsupported property types", () => {
    assert.equal(
      convertPropertyValue({
        id: "title",
        type: "title",
        title: createRichText("ignored"),
      }),
      undefined,
    );
    assert.equal(
      convertPropertyValue({
        id: "rel",
        type: "relation",
        relation: [],
        has_more: false,
      }),
      undefined,
    );
  });
});

describe("resolveTitlePropertyName", () => {
  it("returns the title property name regardless of column label", () => {
    const dataSource = createDataSource({}, "name");
    assert.equal(resolveTitlePropertyName(dataSource), "name");
  });
});

describe("extractTitleKey", () => {
  it("returns trimmed title value", () => {
    const page = createPage("  ItemA  ");
    assert.equal(extractTitleKey(page, DEFAULT_TITLE_PROPERTY), "ItemA");
  });

  it("works with a non-Name title column", () => {
    const page = createPage("ItemB", {}, "name");
    assert.equal(extractTitleKey(page, "name"), "ItemB");
  });

  it("throws when title is empty", () => {
    const page = createPage("   ");

    assert.throws(
      () => extractTitleKey(page, DEFAULT_TITLE_PROPERTY),
      (error: unknown) => {
        assert.ok(error instanceof NotionToLuaError);
        assert.match(error.message, /title 列/);
        return true;
      },
    );
  });
});

describe("pagesToLuauRecords", () => {
  it("converts supported properties and skips unsupported ones", () => {
    const dataSource = createDataSource({
      Count: {
        id: "count",
        name: "Count",
        type: "number",
        number: { format: "number" },
        description: null,
      },
      Enabled: {
        id: "enabled",
        name: "Enabled",
        type: "checkbox",
        checkbox: {},
        description: null,
      },
      Relation: {
        id: "relation",
        name: "Relation",
        type: "relation",
        relation: {
          database_id: "other-db",
          data_source_id: "other-ds",
        },
        description: null,
      },
    });

    const pages = [
      createPage("ItemA", {
        Count: { id: "count", type: "number", number: 3 },
        Enabled: { id: "enabled", type: "checkbox", checkbox: true },
        Relation: {
          id: "relation",
          type: "relation",
          relation: [],
          has_more: false,
        },
      }),
    ];

    const records = pagesToLuauRecords(pages, dataSource);

    assert.equal(records.length, 1);
    assert.equal(records[0]?.key, "ItemA");
    assert.equal(records[0]?.keyFormat, "identifier");
    assert.deepEqual(records[0]?.properties, {
      Count: 3,
      Enabled: true,
    });
  });

  it("throws when title values are duplicated", () => {
    const dataSource = createDataSource({
      Count: {
        id: "count",
        name: "Count",
        type: "number",
        number: { format: "number" },
        description: null,
      },
    });
    const pages = [createPage("Duplicate"), createPage("Duplicate")];

    assert.throws(
      () => pagesToLuauRecords(pages, dataSource),
      (error: unknown) => {
        assert.ok(error instanceof NotionToLuaError);
        assert.match(error.message, /重複/);
        assert.match(error.message, /Duplicate/);
        return true;
      },
    );
  });

  it("converts records when title column is not named Name", () => {
    const dataSource = createDataSource(
      {
        数値: {
          id: "num",
          name: "数値",
          type: "number",
          number: { format: "number" },
          description: null,
        },
      },
      "name",
    );
    const pages = [
      createPage(
        "ItemC",
        {
          数値: { id: "num", type: "number", number: 5 },
        },
        "name",
      ),
    ];

    const records = pagesToLuauRecords(pages, dataSource);

    assert.equal(records.length, 1);
    assert.equal(records[0]?.key, "ItemC");
    assert.deepEqual(records[0]?.properties, { 数値: 5 });
  });
});
