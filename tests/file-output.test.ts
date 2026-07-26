import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import { NotionToLuaError } from "../src/errors.js";
import {
  getOutputFilePath,
  isLuauFilePath,
  resolveOutputTarget,
  sanitizeFileName,
  writeLuauFile,
  writeLuauToPath,
} from "../src/file-output.js";

describe("isLuauFilePath", () => {
  it("detects lua and luau file paths", () => {
    assert.equal(isLuauFilePath("./output/test.luau"), true);
    assert.equal(isLuauFilePath("./output/test.lua"), true);
    assert.equal(isLuauFilePath("./output"), false);
  });
});

describe("resolveOutputTarget", () => {
  it("returns file target for lua paths", () => {
    assert.deepEqual(resolveOutputTarget("./output/Weapons.luau"), {
      kind: "file",
      filePath: "./output/Weapons.luau",
      moduleName: "Weapons",
    });
  });

  it("returns directory target for non-file paths", () => {
    assert.deepEqual(resolveOutputTarget("./output"), {
      kind: "directory",
      directory: "./output",
    });
  });
});

describe("sanitizeFileName", () => {
  it("replaces invalid characters and whitespace", () => {
    assert.equal(sanitizeFileName("My DB/Items"), "My_DB_Items");
    assert.equal(sanitizeFileName("  spaced  "), "spaced");
  });

  it("falls back to fallbackId when title is empty after sanitization", () => {
    assert.equal(sanitizeFileName("   "), "output");
    assert.equal(sanitizeFileName("***"), "output");
    assert.equal(sanitizeFileName("   ", "data-source-id"), "data-source-id");
    assert.equal(sanitizeFileName("***", "data-source-id"), "data-source-id");
  });
});

describe("getOutputFilePath", () => {
  it("builds a .luau file path from title", () => {
    assert.equal(
      getOutputFilePath("/tmp/out", "Test DB"),
      join("/tmp/out", "Test_DB.luau"),
    );
  });
});

describe("writeLuauFile", () => {
  it("writes to an existing directory", () => {
    const outputDir = mkdtempSync(join(tmpdir(), "ntn-lua-"));
    try {
      const filePath = writeLuauFile(outputDir, "Sample", "local Sample = {}");
      assert.equal(filePath, join(outputDir, "Sample.luau"));
      assert.equal(readFileSync(filePath, "utf8"), "local Sample = {}");
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it("throws when output directory does not exist", () => {
    assert.throws(
      () => writeLuauFile("/path/does/not/exist", "Sample", "local Sample = {}"),
      (error: unknown) => {
        assert.ok(error instanceof NotionToLuaError);
        assert.match(error.message, /output directory/i);
        return true;
      },
    );
  });
});

describe("writeLuauToPath", () => {
  it("writes to an explicit file path", () => {
    const outputDir = mkdtempSync(join(tmpdir(), "ntn-lua-"));
    const filePath = join(outputDir, "CustomName.luau");
    try {
      const writtenPath = writeLuauToPath(filePath, "local CustomName = {}");
      assert.equal(writtenPath, filePath);
      assert.equal(readFileSync(filePath, "utf8"), "local CustomName = {}");
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });
});
