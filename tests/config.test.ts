import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import { loadUserConfig } from "../src/config.js";
import { NotionToLuaError } from "../src/errors.js";

function withTempConfig(
  content: string | null,
  run: (cwd: string) => void,
): void {
  const cwd = mkdtempSync(join(tmpdir(), "ntn-lua-config-"));

  try {
    if (content !== null) {
      writeFileSync(join(cwd, "ntn-lua.toml"), content, "utf8");
    }

    run(cwd);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

describe("loadUserConfig", () => {
  it("returns defaults when ntn-lua.toml is missing", () => {
    withTempConfig(null, (cwd) => {
      assert.deepEqual(loadUserConfig(cwd), {
        format: true,
        exportTypes: true,
      });
    });
  });

  it("reads all supported keys from ntn-lua.toml", () => {
    withTempConfig(
      `database_id = "db-123"
page_id = "page-456"
output = "./out"
format = false
export_types = false
`,
      (cwd) => {
        assert.deepEqual(loadUserConfig(cwd), {
          databaseId: "db-123",
          pageId: "page-456",
          output: "./out",
          format: false,
          exportTypes: false,
        });
      },
    );
  });

  it("throws for unknown keys", () => {
    withTempConfig('unknown_key = "value"\n', (cwd) => {
      assert.throws(
        () => loadUserConfig(cwd),
        (error: unknown) => {
          assert.ok(error instanceof NotionToLuaError);
          assert.match(
            (error as NotionToLuaError).message,
            /Unknown key "unknown_key"/,
          );
          return true;
        },
      );
    });
  });

  it("throws when format has an invalid type", () => {
    withTempConfig('format = "yes"\n', (cwd) => {
      assert.throws(
        () => loadUserConfig(cwd),
        (error: unknown) => {
          assert.ok(error instanceof NotionToLuaError);
          assert.match(
            (error as NotionToLuaError).message,
            /Invalid type for "format"/,
          );
          return true;
        },
      );
    });
  });

  it("throws when database_id is empty", () => {
    withTempConfig('database_id = ""\n', (cwd) => {
      assert.throws(
        () => loadUserConfig(cwd),
        (error: unknown) => {
          assert.ok(error instanceof NotionToLuaError);
          assert.match(
            (error as NotionToLuaError).message,
            /Invalid value for "database_id"/,
          );
          return true;
        },
      );
    });
  });

  it("throws when output is whitespace only", () => {
    withTempConfig('output = "   "\n', (cwd) => {
      assert.throws(
        () => loadUserConfig(cwd),
        (error: unknown) => {
          assert.ok(error instanceof NotionToLuaError);
          assert.match(
            (error as NotionToLuaError).message,
            /Invalid value for "output"/,
          );
          return true;
        },
      );
    });
  });

  it("throws when ntn-lua.toml is invalid TOML", () => {
    withTempConfig("[[[\n", (cwd) => {
      assert.throws(
        () => loadUserConfig(cwd),
        (error: unknown) => {
          assert.ok(error instanceof NotionToLuaError);
          assert.match(
            (error as NotionToLuaError).message,
            /Failed to parse ntn-lua\.toml/,
          );
          return true;
        },
      );
    });
  });
});
