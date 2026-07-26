import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { generateModuleScript } from "../src/generator.js";
import { NotionToLuaError } from "../src/errors.js";
import { parseLuauModule } from "../src/luau-parser.js";
import type { ExportableProperty, LuauRecord } from "../src/types.js";

const sampleProperties: ExportableProperty[] = [
  { name: "count", notionType: "number" },
  { name: "enabled", notionType: "checkbox" },
  { name: "label", notionType: "rich_text" },
  { name: "tags", notionType: "multi_select" },
];

function sortRecords(records: LuauRecord[]): LuauRecord[] {
  return [...records].sort((left, right) => left.key.localeCompare(right.key, "en"));
}

describe("parseLuauModule", () => {
  it("parses an empty module without export types", () => {
    const source = `local testModule = {}
return testModule
`;

    const parsed = parseLuauModule(source);

    assert.equal(parsed.moduleName, "testModule");
    assert.deepEqual(parsed.records, []);
  });

  it("parses multiple records with primitive properties", () => {
    const source = `local weapons = {
    Sword = {
        count = 1,
        enabled = true,
        label = "sharp",
    },
    Axe = {
        count = 2,
        enabled = false,
    },
}
return weapons
`;

    const parsed = parseLuauModule(source);

    assert.equal(parsed.moduleName, "weapons");
    assert.deepEqual(sortRecords(parsed.records), sortRecords([
      {
        key: "Axe",
        keyFormat: "identifier",
        properties: {
          count: 2,
          enabled: false,
        },
      },
      {
        key: "Sword",
        keyFormat: "identifier",
        properties: {
          count: 1,
          enabled: true,
          label: "sharp",
        },
      },
    ]));
  });

  it("parses bracket record keys", () => {
    const source = `local testModule = {
    ["my-item"] = {
        label = "test",
    },
}
return testModule
`;

    const parsed = parseLuauModule(source);

    assert.deepEqual(parsed.records, [
      {
        key: "my-item",
        keyFormat: "bracket",
        properties: {
          label: "test",
        },
      },
    ]);
  });

  it("parses bracket property keys and escaped strings", () => {
    const source = `local testModule = {
    ItemA = {
        ["my-prop"] = "value",
        quote = "say \\"hi\\"",
        newline = "line\\nbreak",
    },
}
return testModule
`;

    const parsed = parseLuauModule(source);

    assert.deepEqual(parsed.records[0]?.properties, {
      "my-prop": "value",
      quote: 'say "hi"',
      newline: "line\nbreak",
    });
  });

  it("parses multi_select arrays as string[]", () => {
    const source = `local testModule = {
    ItemA = {
        tags = { "alpha", "beta" },
    },
}
return testModule
`;

    const parsed = parseLuauModule(source);

    assert.deepEqual(parsed.records[0]?.properties.tags, ["alpha", "beta"]);
  });

  it("parses nested dict property values", () => {
    const source = `local testModule = {
    ItemA = {
        nested = {
            inner = 1,
            flag = true,
        },
    },
}
return testModule
`;

    const parsed = parseLuauModule(source);

    assert.deepEqual(parsed.records[0]?.properties.nested, {
      inner: 1,
      flag: true,
    });
  });

  it("parses nil values", () => {
    const source = `local testModule = {
    ItemA = {
        label = nil,
    },
}
return testModule
`;

    const parsed = parseLuauModule(source);

    assert.equal(parsed.records[0]?.properties.label, null);
  });

  it("skips export type blocks and parses typed local assignment", () => {
    const source = `export type TestModuleEntry = {
    count: number,
}

export type TestModule = {
    ItemA: TestModuleEntry,
}

local testModule: TestModule = {
    ItemA = {
        count = 42,
    },
}
return testModule
`;

    const parsed = parseLuauModule(source);

    assert.equal(parsed.moduleName, "testModule");
    assert.deepEqual(parsed.records, [
      {
        key: "ItemA",
        keyFormat: "identifier",
        properties: {
          count: 42,
        },
      },
    ]);
  });

  it("parses generator output without export types", () => {
    const records: LuauRecord[] = [
      {
        key: "ItemA",
        keyFormat: "identifier",
        properties: {
          count: 1,
          enabled: true,
        },
      },
    ];
    const source = generateModuleScript(records, {
      moduleName: "testModule",
      properties: sampleProperties,
      exportTypes: false,
    });

    const parsed = parseLuauModule(source);

    assert.equal(parsed.moduleName, "testModule");
    assert.deepEqual(parsed.records, records);
  });

  it("parses generator output with export types", () => {
    const records: LuauRecord[] = [
      {
        key: "my-item",
        keyFormat: "bracket",
        properties: {
          label: "test",
          tags: ["a", "b"],
        },
      },
    ];
    const source = generateModuleScript(records, {
      moduleName: "testModule",
      properties: sampleProperties,
      exportTypes: true,
    });

    const parsed = parseLuauModule(source);

    assert.equal(parsed.moduleName, "testModule");
    assert.deepEqual(parsed.records, records);
  });

  it("throws when return name does not match local name", () => {
    const source = `local testModule = {}
return otherModule
`;

    assert.throws(
      () => parseLuauModule(source),
      (error: unknown) => {
        assert.ok(error instanceof NotionToLuaError);
        assert.match((error as NotionToLuaError).message, /does not match/);
        return true;
      },
    );
  });

  it("throws when multiple local assignments are present", () => {
    const source = `local first = {}
local second = {}
return first
`;

    assert.throws(
      () => parseLuauModule(source),
      (error: unknown) => {
        assert.ok(error instanceof NotionToLuaError);
        assert.match((error as NotionToLuaError).message, /single local/);
        return true;
      },
    );
  });

  it("throws when local assignment is missing", () => {
    const source = `return testModule
`;

    assert.throws(
      () => parseLuauModule(source),
      (error: unknown) => {
        assert.ok(error instanceof NotionToLuaError);
        assert.match((error as NotionToLuaError).message, /local module table/);
        return true;
      },
    );
  });

  it("throws when return statement is missing", () => {
    const source = `local testModule = {}
`;

    assert.throws(
      () => parseLuauModule(source),
      (error: unknown) => {
        assert.ok(error instanceof NotionToLuaError);
        assert.match((error as NotionToLuaError).message, /return statement/);
        return true;
      },
    );
  });

  it("throws on mixed keyed and unkeyed table entries", () => {
    const source = `local testModule = {
    ItemA = {
        tags = { "alpha", key = "beta" },
    },
}
return testModule
`;

    assert.throws(
      () => parseLuauModule(source),
      (error: unknown) => {
        assert.ok(error instanceof NotionToLuaError);
        assert.match((error as NotionToLuaError).message, /Mixed keyed and unkeyed/);
        return true;
      },
    );
  });

  it("throws on invalid syntax outside the supported dialect", () => {
    const source = `require("Module")
local testModule = {}
return testModule
`;

    assert.throws(
      () => parseLuauModule(source),
      (error: unknown) => error instanceof NotionToLuaError,
    );
  });
});
