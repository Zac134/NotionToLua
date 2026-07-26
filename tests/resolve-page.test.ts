import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { DataSourceObjectResponse } from "@notionhq/client/build/src/api-endpoints.js";

import { NotionToLuaError } from "../src/errors.js";
import { resolvePageId } from "../src/resolve-page.js";

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

function createDataSource(
  databaseParent: DataSourceObjectResponse["database_parent"],
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
    properties: {},
    parent: { type: "database_id", database_id: "database-id" },
    database_parent: databaseParent,
    url: "https://www.notion.so/data-source-id",
    public_url: null,
    archived: false,
    in_trash: false,
  };
}

describe("resolvePageId", () => {
  it("returns page-id override when provided", async () => {
    const dataSource = createDataSource({
      type: "page_id",
      page_id: "parent-page-id",
    });

    const pageId = await resolvePageId(
      { blocks: { retrieve: async () => ({}) } } as never,
      dataSource,
      "override-page-id",
    );

    assert.equal(pageId, "override-page-id");
  });

  it("returns database_parent.page_id when available", async () => {
    const dataSource = createDataSource({
      type: "page_id",
      page_id: "parent-page-id",
    });

    const pageId = await resolvePageId(
      { blocks: { retrieve: async () => ({}) } } as never,
      dataSource,
    );

    assert.equal(pageId, "parent-page-id");
  });

  it("walks block parents until a page is found", async () => {
    const dataSource = createDataSource({
      type: "block_id",
      block_id: "block-1",
    });

    const pageId = await resolvePageId(
      {
        blocks: {
          retrieve: async ({ block_id }: { block_id: string }) => {
            if (block_id === "block-1") {
              return {
                parent: { type: "block_id", block_id: "block-2" },
              };
            }

            return {
              parent: { type: "page_id", page_id: "resolved-page-id" },
            };
          },
        },
      } as never,
      dataSource,
    );

    assert.equal(pageId, "resolved-page-id");
  });

  it("throws for workspace databases", async () => {
    const dataSource = createDataSource({
      type: "workspace",
      workspace: true,
    });

    await assert.rejects(
      () =>
        resolvePageId(
          { blocks: { retrieve: async () => ({}) } } as never,
          dataSource,
        ),
      (error: unknown) => {
        assert.ok(error instanceof NotionToLuaError);
        assert.match(error.message, /ワークスペース直下/);
        return true;
      },
    );
  });

  it("throws when block parent cannot be resolved", async () => {
    const dataSource = createDataSource({
      type: "block_id",
      block_id: "block-1",
    });

    await assert.rejects(
      () =>
        resolvePageId(
          {
            blocks: {
              retrieve: async () => ({
                parent: { type: "workspace", workspace: true },
              }),
            },
          } as never,
          dataSource,
        ),
      (error: unknown) => {
        assert.ok(error instanceof NotionToLuaError);
        assert.match(error.message, /ワークスペース直下/);
        return true;
      },
    );
  });
});
