import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import { NotionToLuaError } from "../src/errors.js";
import {
  getOutputFilePath,
  sanitizeFileName,
  writeLuauFile,
} from "../src/file-output.js";

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
      const filePath = writeLuauFile(outputDir, "Sample", "return {}");
      assert.equal(filePath, join(outputDir, "Sample.luau"));
      assert.equal(readFileSync(filePath, "utf8"), "return {}");
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it("throws when output directory does not exist", () => {
    assert.throws(
      () => writeLuauFile("/path/does/not/exist", "Sample", "return {}"),
      (error: unknown) => {
        assert.ok(error instanceof NotionToLuaError);
        assert.match(error.message, /出力ディレクトリ/);
        return true;
      },
    );
  });
});
