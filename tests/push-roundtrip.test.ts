import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { generateModuleScript } from "../src/generator.js";
import { NotionToLuaError } from "../src/errors.js";
import { parseLuauModule } from "../src/luau-parser.js";
import { inferNotionSchema } from "../src/schema-infer.js";
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

describe("push roundtrip", () => {
  it("preserves record keys and values through generate → parse", () => {
    const records: LuauRecord[] = [
      {
        key: "Sword",
        keyFormat: "identifier",
        properties: {
          count: 10,
          enabled: true,
          label: "sharp",
          tags: ["Fire", "Melee"],
        },
      },
      {
        key: "my-item",
        keyFormat: "bracket",
        properties: {
          count: 3,
          enabled: false,
          label: "special",
          tags: ["Ice"],
        },
      },
    ];

    const source = generateModuleScript(records, {
      moduleName: "weapons",
      properties: sampleProperties,
      exportTypes: true,
    });

    const parsed = parseLuauModule(source);

    assert.equal(parsed.moduleName, "weapons");
    assert.deepEqual(sortRecords(parsed.records), sortRecords(records));
  });

  it("preserves record keys and values without export types", () => {
    const records: LuauRecord[] = [
      {
        key: "Axe",
        keyFormat: "identifier",
        properties: {
          count: 40,
          enabled: true,
        },
      },
    ];

    const source = generateModuleScript(records, {
      moduleName: "weapons",
      properties: sampleProperties,
      exportTypes: false,
    });

    const parsed = parseLuauModule(source);

    assert.equal(parsed.moduleName, "weapons");
    assert.deepEqual(parsed.records, records);
  });

  it("rejects nested relation tables during schema inference", () => {
    const records: LuauRecord[] = [
      {
        key: "Sword",
        keyFormat: "identifier",
        properties: {
          count: 10,
          effects: { Fire: 10, Ice: 5 },
        },
      },
    ];

    const source = generateModuleScript(records, {
      moduleName: "weapons",
      properties: [
        { name: "count", notionType: "number" },
        {
          name: "effects",
          notionType: "relation",
          relationMeta: { kind: "scalar_dict", valueType: "number" },
        },
      ],
      exportTypes: false,
    });

    const parsed = parseLuauModule(source);

    assert.throws(
      () => inferNotionSchema(parsed.records),
      (error: unknown) => {
        assert.ok(error instanceof NotionToLuaError);
        assert.match(
          error.message,
          /Property "effects" has a nested table value/,
        );
        return true;
      },
    );
  });
});
