import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { generateModuleScript } from "../src/generator.js";
import type { ExportableProperty, LuauRecord } from "../src/types.js";

const sampleProperties: ExportableProperty[] = [
  { name: "count", notionType: "number" },
  { name: "enabled", notionType: "checkbox" },
];

function generate(
  records: LuauRecord[],
  moduleName = "testModule",
  properties: ExportableProperty[] = sampleProperties,
): string {
  return generateModuleScript(records, { moduleName, properties });
}

describe("generateModuleScript", () => {
  it("returns an empty module for no records", () => {
    const output = generate([], "testModule", []);

    assert.match(output, /local testModule = \{\}/);
    assert.match(output, /return testModule/);
    assert.doesNotMatch(output, /export type/);
  });

  it("sorts records by key", () => {
    const records: LuauRecord[] = [
      {
        key: "Zebra",
        keyFormat: "identifier",
        properties: { label: "z" },
      },
      {
        key: "Alpha",
        keyFormat: "identifier",
        properties: { label: "a" },
      },
      {
        key: "Middle",
        keyFormat: "identifier",
        properties: { label: "m" },
      },
    ];

    const output = generate(records, "testModule", [
      { name: "label", notionType: "rich_text" },
    ]);

    assert.ok(output.indexOf("Alpha") < output.indexOf("Middle"));
    assert.ok(output.indexOf("Middle") < output.indexOf("Zebra"));
  });

  it("uses local variable and return statement", () => {
    const records: LuauRecord[] = [
      {
        key: "ItemA",
        keyFormat: "identifier",
        properties: { count: 1 },
      },
    ];

    const output = generate(records);

    assert.match(output, /export type TestModuleEntry/);
    assert.match(output, /export type TestModule/);
    assert.match(output, /local testModule: TestModule = \{/);
    assert.match(output, /return testModule/);
  });

  it("uses 4-space indentation", () => {
    const records: LuauRecord[] = [
      {
        key: "ItemA",
        keyFormat: "identifier",
        properties: { count: 1 },
      },
    ];

    const output = generate(records);
    const lines = output.split("\n");

    assert.match(lines.find((line) => line.includes("ItemA = {")) ?? "", /^ {4}ItemA = \{$/);
    assert.match(lines.find((line) => line.includes("count = 1")) ?? "", /^ {12}count = 1,$/);
  });

  it("adds trailing commas to records and properties", () => {
    const records: LuauRecord[] = [
      {
        key: "ItemA",
        keyFormat: "identifier",
        properties: { count: 1, enabled: true },
      },
      {
        key: "ItemB",
        keyFormat: "identifier",
        properties: { count: 2 },
      },
    ];

    const output = generate(records);

    assert.match(output, /count = 1,/);
    assert.match(output, /enabled = true,/);
    assert.match(output, /count = 2,/);
    assert.match(output, /\},\n    ItemB = \{/);
  });

  it("sorts property keys within each record", () => {
    const records: LuauRecord[] = [
      {
        key: "ItemA",
        keyFormat: "identifier",
        properties: {
          zebra: "z",
          alpha: "a",
          middle: "m",
        },
      },
    ];

    const output = generate(records, "testModule", [
      { name: "zebra", notionType: "rich_text" },
      { name: "alpha", notionType: "rich_text" },
      { name: "middle", notionType: "rich_text" },
    ]);

    assert.ok(output.indexOf("alpha") < output.indexOf("middle"));
    assert.ok(output.indexOf("middle") < output.indexOf("zebra"));
  });

  it("omits null properties", () => {
    const records: LuauRecord[] = [
      {
        key: "ItemA",
        keyFormat: "identifier",
        properties: {
          kept: "yes",
          skipped: null,
        },
      },
    ];

    const output = generate(records, "testModule", [
      { name: "kept", notionType: "rich_text" },
      { name: "skipped", notionType: "rich_text" },
    ]);

    assert.match(output, /kept = "yes",/);
    assert.doesNotMatch(output, /skipped =/);
  });

  it("uses bracket notation for invalid identifier keys", () => {
    const records: LuauRecord[] = [
      {
        key: "my-item",
        keyFormat: "bracket",
        properties: { label: "test" },
      },
    ];

    const output = generate(records, "testModule", [
      { name: "label", notionType: "rich_text" },
    ]);

    assert.match(output, /\["my-item"\] = \{/);
  });

  it("formats bracket property keys inside records and types", () => {
    const records: LuauRecord[] = [
      {
        key: "ItemA",
        keyFormat: "identifier",
        properties: {
          "my-prop": "value",
        },
      },
    ];

    const output = generate(records, "testModule", [
      { name: "my-prop", notionType: "rich_text" },
    ]);

    assert.match(output, /\["my-prop"\]: string\?,/);
    assert.match(output, /\["my-prop"\] = "value",/);
  });
});
