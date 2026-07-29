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
  return [...records].sort((left, right) =>
    left.key.localeCompare(right.key, "en"),
  );
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

  it("preserves typed Roblox values through generate → parse → infer", () => {
    const records: LuauRecord[] = [
      {
        key: "SpawnA",
        keyFormat: "identifier",
        properties: {
          Position: { kind: "Vector3", x: 10, y: 5, z: -20 },
          Tint: { kind: "Color3", r: 255, g: 128, b: 0 },
        },
      },
    ];

    const properties: ExportableProperty[] = [
      {
        name: "Position",
        notionType: "rich_text",
        robloxType: "Vector3",
        notionPropertyName: "Position [Vector3]",
      },
      {
        name: "Tint",
        notionType: "rich_text",
        robloxType: "Color3",
        notionPropertyName: "Tint [Color3]",
      },
    ];

    const source = generateModuleScript(records, {
      moduleName: "Spawns",
      properties,
      exportTypes: true,
    });

    const parsed = parseLuauModule(source);
    const schema = inferNotionSchema(parsed.records);

    assert.deepEqual(schema.properties, [
      {
        name: "Position",
        notionType: "rich_text",
        robloxType: "Vector3",
        notionPropertyName: "Position [Vector3]",
      },
      {
        name: "Tint",
        notionType: "rich_text",
        robloxType: "Color3",
        notionPropertyName: "Tint [Color3]",
      },
    ]);
    assert.deepEqual(sortRecords(parsed.records), sortRecords(records));
  });

  it("preserves CFrame values followed by other properties through generate → parse → infer", () => {
    const records: LuauRecord[] = [
      {
        key: "SpawnA",
        keyFormat: "identifier",
        properties: {
          Pose: {
            kind: "CFrame",
            px: 10,
            py: 5,
            pz: -20,
            rx: 0,
            ry: 90,
            rz: 0,
          },
          Speed: 5,
        },
      },
    ];

    const properties: ExportableProperty[] = [
      {
        name: "Pose",
        notionType: "rich_text",
        robloxType: "CFrame",
        notionPropertyName: "Pose [CFrame]",
      },
      {
        name: "Speed",
        notionType: "number",
      },
    ];

    const source = generateModuleScript(records, {
      moduleName: "Spawns",
      properties,
      exportTypes: true,
    });

    const parsed = parseLuauModule(source);
    const schema = inferNotionSchema(parsed.records);

    assert.deepEqual(schema.properties, [
      {
        name: "Pose",
        notionType: "rich_text",
        robloxType: "CFrame",
        notionPropertyName: "Pose [CFrame]",
      },
      {
        name: "Speed",
        notionType: "number",
      },
    ]);
    assert.deepEqual(sortRecords(parsed.records), sortRecords(records));
  });

  it("preserves array relation values through generate → parse → infer", () => {
    const records: LuauRecord[] = [
      {
        key: "Sword",
        keyFormat: "identifier",
        properties: {
          Items: [{ Damage: 10 }, { Damage: 20 }],
        },
      },
    ];

    const properties: ExportableProperty[] = [
      {
        name: "Items",
        notionType: "relation",
        notionPropertyName: "Items [Array]",
        relationMeta: {
          kind: "nested_array",
          entryProperties: [{ name: "Damage", notionType: "number" }],
        },
      },
    ];

    const source = generateModuleScript(records, {
      moduleName: "Weapons",
      properties,
      exportTypes: false,
    });

    const parsed = parseLuauModule(source);
    const schema = inferNotionSchema(parsed.records);

    assert.equal(schema.properties[0]?.notionPropertyName, "Items [Array]");
    assert.equal(schema.properties[0]?.relationMeta?.kind, "nested_array");
    assert.deepEqual(parsed.records[0]?.properties.Items, [
      { Damage: 10 },
      { Damage: 20 },
    ]);
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
