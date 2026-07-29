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
        emptyValue: "omit",
        emptyRelation: "omit",
        omitArrayIndex: false,
      });
    });
  });

  it("reads all supported keys from flat ntn-lua.toml (legacy page_id)", () => {
    withTempConfig(
      `database_id = "db-123"
page_id = "page-456"
output = "./out"
format = false
export_types = false
empty_value = "nil"
empty_relation = "empty_table"
omit_array_index = true
`,
      (cwd) => {
        assert.deepEqual(loadUserConfig(cwd), {
          databaseId: "db-123",
          pageId: "page-456",
          output: "./out",
          format: false,
          exportTypes: false,
          emptyValue: "nil",
          emptyRelation: "empty_table",
          omitArrayIndex: true,
        });
      },
    );
  });

  it("reads all supported keys from sectioned ntn-lua.toml", () => {
    withTempConfig(
      `[source]
database_id = "db-123"
code_block_parent_page_id = "page-456"

[paths]
output = "./out"

[emit]
format = false
export_types = false
empty_value = "nil"
empty_relation = "empty_table"
omit_array_index = true
`,
      (cwd) => {
        assert.deepEqual(loadUserConfig(cwd), {
          databaseId: "db-123",
          pageId: "page-456",
          output: "./out",
          format: false,
          exportTypes: false,
          emptyValue: "nil",
          emptyRelation: "empty_table",
          omitArrayIndex: true,
        });
      },
    );
  });

  it("reads code_block_parent_page_id from flat ntn-lua.toml", () => {
    withTempConfig(
      `database_id = "db-123"
code_block_parent_page_id = "page-789"
`,
      (cwd) => {
        const config = loadUserConfig(cwd);
        assert.equal(config.databaseId, "db-123");
        assert.equal(config.pageId, "page-789");
      },
    );
  });

  it("throws when both page_id and code_block_parent_page_id are set", () => {
    withTempConfig(
      `page_id = "page-legacy"
code_block_parent_page_id = "page-new"
`,
      (cwd) => {
        assert.throws(
          () => loadUserConfig(cwd),
          (error: unknown) => {
            assert.ok(error instanceof NotionToLuaError);
            assert.match(
              (error as NotionToLuaError).message,
              /Cannot specify both "page_id" and "code_block_parent_page_id"/,
            );
            return true;
          },
        );
      },
    );
  });

  it("throws when section tables and flat keys are mixed", () => {
    withTempConfig(
      `database_id = "db-123"

[emit]
format = false
`,
      (cwd) => {
        assert.throws(
          () => loadUserConfig(cwd),
          (error: unknown) => {
            assert.ok(error instanceof NotionToLuaError);
            assert.match(
              (error as NotionToLuaError).message,
              /Cannot mix section tables and flat keys/,
            );
            return true;
          },
        );
      },
    );
  });

  it("throws for unknown section names", () => {
    withTempConfig(
      `[unknown]
key = "value"
`,
      (cwd) => {
        assert.throws(
          () => loadUserConfig(cwd),
          (error: unknown) => {
            assert.ok(error instanceof NotionToLuaError);
            assert.match(
              (error as NotionToLuaError).message,
              /Unknown key "unknown"/,
            );
            return true;
          },
        );
      },
    );
  });

  it("throws for unknown keys inside a section", () => {
    withTempConfig(
      `[source]
unknown_key = "value"
`,
      (cwd) => {
        assert.throws(
          () => loadUserConfig(cwd),
          (error: unknown) => {
            assert.ok(error instanceof NotionToLuaError);
            assert.match(
              (error as NotionToLuaError).message,
              /Unknown key "unknown_key" in section "\[source\]"/,
            );
            return true;
          },
        );
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

  it("throws for legacy properties table", () => {
    withTempConfig(
      `[properties.Effects]
relation = "embed"
`,
      (cwd) => {
        assert.throws(
          () => loadUserConfig(cwd),
          (error: unknown) => {
            assert.ok(error instanceof NotionToLuaError);
            assert.match(
              (error as NotionToLuaError).message,
              /Unknown key "properties"/,
            );
            return true;
          },
        );
      },
    );
  });

  it("throws for invalid empty_value", () => {
    withTempConfig('empty_value = "missing"\n', (cwd) => {
      assert.throws(
        () => loadUserConfig(cwd),
        (error: unknown) => {
          assert.ok(error instanceof NotionToLuaError);
          assert.match(
            (error as NotionToLuaError).message,
            /Expected "omit", "nil", or "empty_string"/,
          );
          return true;
        },
      );
    });
  });

  it("accepts empty_string empty_value", () => {
    withTempConfig('empty_value = "empty_string"\n', (cwd) => {
      assert.equal(loadUserConfig(cwd).emptyValue, "empty_string");
    });
  });

  it("throws when omit_array_index has an invalid type", () => {
    withTempConfig('omit_array_index = "yes"\n', (cwd) => {
      assert.throws(
        () => loadUserConfig(cwd),
        (error: unknown) => {
          assert.ok(error instanceof NotionToLuaError);
          assert.match(
            (error as NotionToLuaError).message,
            /Invalid type for "omit_array_index"/,
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
