import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import { NotionToLuaError } from "../src/errors.js";
import { NTN_LUA_TOML_TEMPLATE, initConfig } from "../src/init.js";

describe("initConfig", () => {
  it("creates ntn-lua.toml from the template", () => {
    const cwd = mkdtempSync(join(tmpdir(), "ntn-lua-init-"));

    try {
      const configPath = initConfig(cwd);

      assert.equal(configPath, join(cwd, "ntn-lua.toml"));
      assert.ok(existsSync(configPath));
      assert.equal(readFileSync(configPath, "utf8"), NTN_LUA_TOML_TEMPLATE);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("throws when ntn-lua.toml already exists", () => {
    const cwd = mkdtempSync(join(tmpdir(), "ntn-lua-init-"));

    try {
      initConfig(cwd);

      assert.throws(
        () => initConfig(cwd),
        (error: unknown) => {
          assert.ok(error instanceof NotionToLuaError);
          assert.match(
            (error as NotionToLuaError).message,
            /ntn-lua\.toml already exists/,
          );
          return true;
        },
      );
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});
