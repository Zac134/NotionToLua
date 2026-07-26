import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveDatabaseId, resolveOutputDir } from "../src/env.js";

describe("resolveDatabaseId", () => {
  it("prefers flag over positional and env", () => {
    assert.equal(
      resolveDatabaseId({
        flag: "from-flag",
        positional: "from-positional",
      }),
      "from-flag",
    );
  });

  it("uses positional when flag is omitted", () => {
    assert.equal(
      resolveDatabaseId({
        positional: "from-positional",
      }),
      "from-positional",
    );
  });

  it("uses NOTION_DATABASE_ID when flag and positional are omitted", () => {
    const previous = process.env.NOTION_DATABASE_ID;
    process.env.NOTION_DATABASE_ID = "from-env";

    try {
      assert.equal(resolveDatabaseId({}), "from-env");
    } finally {
      if (previous === undefined) {
        delete process.env.NOTION_DATABASE_ID;
      } else {
        process.env.NOTION_DATABASE_ID = previous;
      }
    }
  });

  it("returns undefined when nothing is provided", () => {
    const previous = process.env.NOTION_DATABASE_ID;
    delete process.env.NOTION_DATABASE_ID;

    try {
      assert.equal(resolveDatabaseId({}), undefined);
    } finally {
      if (previous !== undefined) {
        process.env.NOTION_DATABASE_ID = previous;
      }
    }
  });
});

describe("resolveOutputDir", () => {
  it("prefers flag over env", () => {
    const previous = process.env.NOTION_OUTPUT_DIR;
    process.env.NOTION_OUTPUT_DIR = "./from-env";

    try {
      assert.equal(resolveOutputDir({ flag: "./from-flag" }), "./from-flag");
    } finally {
      if (previous === undefined) {
        delete process.env.NOTION_OUTPUT_DIR;
      } else {
        process.env.NOTION_OUTPUT_DIR = previous;
      }
    }
  });

  it("uses NOTION_OUTPUT_DIR when flag is omitted", () => {
    const previous = process.env.NOTION_OUTPUT_DIR;
    process.env.NOTION_OUTPUT_DIR = "./from-env";

    try {
      assert.equal(resolveOutputDir({}), "./from-env");
    } finally {
      if (previous === undefined) {
        delete process.env.NOTION_OUTPUT_DIR;
      } else {
        process.env.NOTION_OUTPUT_DIR = previous;
      }
    }
  });

  it("returns undefined when flag and env are omitted", () => {
    const previous = process.env.NOTION_OUTPUT_DIR;
    delete process.env.NOTION_OUTPUT_DIR;

    try {
      assert.equal(resolveOutputDir({}), undefined);
    } finally {
      if (previous !== undefined) {
        process.env.NOTION_OUTPUT_DIR = previous;
      }
    }
  });

  it("treats blank env as unset", () => {
    const previous = process.env.NOTION_OUTPUT_DIR;
    process.env.NOTION_OUTPUT_DIR = "   ";

    try {
      assert.equal(resolveOutputDir({}), undefined);
    } finally {
      if (previous === undefined) {
        delete process.env.NOTION_OUTPUT_DIR;
      } else {
        process.env.NOTION_OUTPUT_DIR = previous;
      }
    }
  });
});
