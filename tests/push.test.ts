import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import { NotionToLuaError } from "../src/errors.js";
import { pushLuauFile } from "../src/push.js";

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
});
