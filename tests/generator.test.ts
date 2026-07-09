import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { generateModuleScript } from "../src/generator.js";
import type { LuauRecord } from "../src/types.js";

describe("generateModuleScript", () => {
  it("returns an empty module for no records", () => {
    assert.equal(generateModuleScript([]), "return {\n}");
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

    const output = generateModuleScript(records);

    assert.ok(output.indexOf("Alpha") < output.indexOf("Middle"));
    assert.ok(output.indexOf("Middle") < output.indexOf("Zebra"));
  });

  it("uses 4-space indentation", () => {
    const records: LuauRecord[] = [
      {
        key: "ItemA",
        keyFormat: "identifier",
        properties: { count: 1 },
      },
    ];

    const output = generateModuleScript(records);
    const lines = output.split("\n");

    assert.equal(lines[0], "return {");
    assert.match(lines[1], /^ {4}ItemA = \{$/);
    assert.match(lines[2], /^ {12}count = 1,$/);
    assert.match(lines[3], /^ {8}\},$/);
    assert.equal(lines[4], "}");
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

    const output = generateModuleScript(records);

    assert.match(output, /count = 1,/);
    assert.match(output, /enabled = true,/);
    assert.match(output, /count = 2,/);
    assert.match(output, /\},\n    ItemB = \{/);
    assert.match(output, /\},\n\}$/);
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

    const output = generateModuleScript(records);

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

    const output = generateModuleScript(records);

    assert.match(output, /kept = "yes",/);
    assert.doesNotMatch(output, /skipped/);
  });

  it("uses bracket notation for invalid identifier keys", () => {
    const records: LuauRecord[] = [
      {
        key: "my-item",
        keyFormat: "bracket",
        properties: { label: "test" },
      },
    ];

    const output = generateModuleScript(records);

    assert.match(output, /\["my-item"\] = \{/);
  });

  it("formats bracket property keys inside records", () => {
    const records: LuauRecord[] = [
      {
        key: "ItemA",
        keyFormat: "identifier",
        properties: {
          "my-prop": "value",
        },
      },
    ];

    const output = generateModuleScript(records);

    assert.match(output, /\["my-prop"\] = "value",/);
  });
});
