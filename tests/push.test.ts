import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import { NotionToLuaError } from "../src/errors.js";
import { pushLuauFile } from "../src/push.js";

const minimalModuleScript = `local Items = {
    Sword = { damage = 10 },
}
return Items
`;

function createTempLuauFile(source: string = minimalModuleScript): {
  directory: string;
  filePath: string;
} {
  const directory = mkdtempSync(join(tmpdir(), "ntn-lua-push-"));
  const filePath = join(directory, "Items.luau");
  writeFileSync(filePath, source, "utf8");
  return { directory, filePath };
}

describe("pushLuauFile", () => {
  it("throws when the Luau file does not exist", async () => {
    await assert.rejects(
      () =>
        pushLuauFile(
          { databases: { create: async () => ({}) }, pages: { create: async () => ({}) } } as never,
          { filePath: "/tmp/ntn-lua-missing-file.luau", pageId: "page-id" },
        ),
      (error: unknown) => {
        assert.ok(error instanceof NotionToLuaError);
        assert.match(error.message, /Luau file not found/);
        return true;
      },
    );
  });

  it("throws when the input path is a directory", async () => {
    const directory = mkdtempSync(join(tmpdir(), "ntn-lua-push-"));

    try {
      await assert.rejects(
        () =>
          pushLuauFile(
            { databases: { create: async () => ({}) }, pages: { create: async () => ({}) } } as never,
            { filePath: directory, pageId: "page-id" },
          ),
        (error: unknown) => {
          assert.ok(error instanceof NotionToLuaError);
          assert.match(error.message, /Expected a file path, got a directory/);
          return true;
        },
      );
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("pushes a valid Luau module and returns push metadata", async () => {
    const { directory, filePath } = createTempLuauFile();

    try {
      const notion = {
        databases: {
          create: async () => ({
            id: "database-id",
            data_sources: [{ id: "data-source-id", name: "Items" }],
          }),
        },
        pages: {
          create: async () => ({ id: "page-id" }),
        },
      };

      const result = await pushLuauFile(notion as never, {
        filePath,
        pageId: "parent-page-id",
      });

      assert.deepEqual(result, {
        moduleName: "Items",
        databaseId: "database-id",
        dataSourceId: "data-source-id",
        recordCount: 1,
      });
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("wraps insert failures with database context", async () => {
    const { directory, filePath } = createTempLuauFile();

    try {
      const notion = {
        databases: {
          create: async () => ({
            id: "database-id",
            data_sources: [{ id: "data-source-id", name: "Items" }],
          }),
        },
        pages: {
          create: async () => {
            throw new Error("Notion API rate limit");
          },
        },
      };

      await assert.rejects(
        () =>
          pushLuauFile(notion as never, {
            filePath,
            pageId: "parent-page-id",
          }),
        (error: unknown) => {
          assert.ok(error instanceof NotionToLuaError);
          assert.match(error.message, /Notion API rate limit/);
          assert.match(error.message, /Database already created: database-id/);
          return true;
        },
      );
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
