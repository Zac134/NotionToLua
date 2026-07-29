import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  convertRichTextToLuauValue,
  formatRobloxValue,
  formatTypedPropertyName,
  parseNotionValue,
  parseTypedPropertyName,
  resolveExportableProperty,
  serializeNotionValue,
  tryParseRobloxValueFromSource,
} from "../src/typed-rich-text.js";

describe("parseTypedPropertyName", () => {
  it("parses bracket type annotations", () => {
    assert.deepEqual(parseTypedPropertyName("Position [Vector3]"), {
      baseName: "Position",
      robloxType: "Vector3",
    });
  });

  it("returns null for unknown types", () => {
    assert.equal(parseTypedPropertyName("Position [UnknownType]"), null);
  });

  it("returns null for plain property names", () => {
    assert.equal(parseTypedPropertyName("Position"), null);
  });
});

describe("parseNotionValue", () => {
  it("parses Vector3", () => {
    assert.deepEqual(parseNotionValue("Vector3", "10, 5, -20"), {
      kind: "Vector3",
      x: 10,
      y: 5,
      z: -20,
    });
  });

  it("parses CFrame with pipe separator", () => {
    assert.deepEqual(parseNotionValue("CFrame", "10,5,-20 | 0,90,0"), {
      kind: "CFrame",
      px: 10,
      py: 5,
      pz: -20,
      rx: 0,
      ry: 90,
      rz: 0,
    });
  });

  it("parses Color3", () => {
    assert.deepEqual(parseNotionValue("Color3", "255, 128, 0"), {
      kind: "Color3",
      r: 255,
      g: 128,
      b: 0,
    });
  });

  it("returns null for invalid values", () => {
    assert.equal(parseNotionValue("Vector3", "not,a,number"), null);
  });

  it("returns null for empty text", () => {
    assert.equal(parseNotionValue("Vector3", ""), null);
    assert.equal(parseNotionValue("Vector3", "   "), null);
  });

  it("returns null for CFrame without pipe separator", () => {
    assert.equal(parseNotionValue("CFrame", "10, 5, -20"), null);
  });

  it("parses Vector2", () => {
    assert.deepEqual(parseNotionValue("Vector2", "10, 5"), {
      kind: "Vector2",
      x: 10,
      y: 5,
    });
  });

  it("parses UDim", () => {
    assert.deepEqual(parseNotionValue("UDim", "0.5, 10"), {
      kind: "UDim",
      scale: 0.5,
      offset: 10,
    });
  });

  it("parses UDim2", () => {
    assert.deepEqual(parseNotionValue("UDim2", "0.5, 10, 1, 20"), {
      kind: "UDim2",
      xScale: 0.5,
      xOffset: 10,
      yScale: 1,
      yOffset: 20,
    });
  });

  it("parses Rect", () => {
    assert.deepEqual(parseNotionValue("Rect", "0, 0, 100, 50"), {
      kind: "Rect",
      minX: 0,
      minY: 0,
      maxX: 100,
      maxY: 50,
    });
  });

  it("parses NumberRange", () => {
    assert.deepEqual(parseNotionValue("NumberRange", "0, 100"), {
      kind: "NumberRange",
      min: 0,
      max: 100,
    });
  });
});

describe("serializeNotionValue", () => {
  it("roundtrips Vector3 text", () => {
    const value = parseNotionValue("Vector3", "1, 2, 3");
    assert.ok(value);
    assert.equal(serializeNotionValue(value), "1, 2, 3");
  });

  it("roundtrips Vector2 text", () => {
    const notionText = "10, 5";
    const value = parseNotionValue("Vector2", notionText);
    assert.ok(value);
    assert.equal(serializeNotionValue(value), notionText);
  });

  it("roundtrips UDim text", () => {
    const notionText = "0.5, 10";
    const value = parseNotionValue("UDim", notionText);
    assert.ok(value);
    assert.equal(serializeNotionValue(value), notionText);
  });

  it("roundtrips UDim2 text", () => {
    const notionText = "0.5, 10, 1, 20";
    const value = parseNotionValue("UDim2", notionText);
    assert.ok(value);
    assert.equal(serializeNotionValue(value), notionText);
  });

  it("roundtrips Rect text", () => {
    const notionText = "0, 0, 100, 50";
    const value = parseNotionValue("Rect", notionText);
    assert.ok(value);
    assert.equal(serializeNotionValue(value), notionText);
  });

  it("roundtrips NumberRange text", () => {
    const notionText = "0, 100";
    const value = parseNotionValue("NumberRange", notionText);
    assert.ok(value);
    assert.equal(serializeNotionValue(value), notionText);
  });
});

describe("formatRobloxValue", () => {
  it("formats Vector3 constructor", () => {
    assert.equal(
      formatRobloxValue({ kind: "Vector3", x: 10, y: 5, z: -20 }),
      "Vector3.new(10, 5, -20)",
    );
  });

  it("formats CFrame with YXZ radians helper", () => {
    assert.equal(
      formatRobloxValue({
        kind: "CFrame",
        px: 10,
        py: 5,
        pz: -20,
        rx: 0,
        ry: 90,
        rz: 0,
      }),
      "CFrame.new(10, 5, -20) * CFrame.fromEulerAnglesYXZ(math.rad(0), math.rad(90), math.rad(0))",
    );
  });

  it("formats Vector2 constructor", () => {
    assert.equal(
      formatRobloxValue({ kind: "Vector2", x: 10, y: 5 }),
      "Vector2.new(10, 5)",
    );
  });

  it("formats UDim constructor", () => {
    assert.equal(
      formatRobloxValue({ kind: "UDim", scale: 0.5, offset: 10 }),
      "UDim.new(0.5, 10)",
    );
  });

  it("formats UDim2 constructor", () => {
    assert.equal(
      formatRobloxValue({
        kind: "UDim2",
        xScale: 0.5,
        xOffset: 10,
        yScale: 1,
        yOffset: 20,
      }),
      "UDim2.new(0.5, 10, 1, 20)",
    );
  });

  it("formats Rect constructor", () => {
    assert.equal(
      formatRobloxValue({
        kind: "Rect",
        minX: 0,
        minY: 0,
        maxX: 100,
        maxY: 50,
      }),
      "Rect.new(0, 0, 100, 50)",
    );
  });

  it("formats NumberRange constructor", () => {
    assert.equal(
      formatRobloxValue({ kind: "NumberRange", min: 0, max: 100 }),
      "NumberRange.new(0, 100)",
    );
  });

  it("formats Color3 fromRGB", () => {
    assert.equal(
      formatRobloxValue({ kind: "Color3", r: 255, g: 128, b: 0 }),
      "Color3.fromRGB(255, 128, 0)",
    );
  });
});

describe("tryParseRobloxValueFromSource", () => {
  it("parses generated Vector3 source", () => {
    const source = "Vector3.new(10, 5, -20)";
    const parsed = tryParseRobloxValueFromSource(source, 0);
    assert.deepEqual(parsed?.value, {
      kind: "Vector3",
      x: 10,
      y: 5,
      z: -20,
    });
    assert.equal(parsed?.endOffset, source.length);
  });

  it("parses generated CFrame source", () => {
    const source =
      "CFrame.new(10, 5, -20) * CFrame.fromEulerAnglesYXZ(math.rad(0), math.rad(90), math.rad(0))";
    const parsed = tryParseRobloxValueFromSource(source, 0);
    assert.deepEqual(parsed?.value, {
      kind: "CFrame",
      px: 10,
      py: 5,
      pz: -20,
      rx: 0,
      ry: 90,
      rz: 0,
    });
    assert.equal(parsed?.endOffset, source.length);
  });

  it("parses generated Vector2 source", () => {
    const source = "Vector2.new(10, 5)";
    const parsed = tryParseRobloxValueFromSource(source, 0);
    assert.deepEqual(parsed?.value, {
      kind: "Vector2",
      x: 10,
      y: 5,
    });
    assert.equal(parsed?.endOffset, source.length);
  });

  it("parses generated UDim source", () => {
    const source = "UDim.new(0.5, 10)";
    const parsed = tryParseRobloxValueFromSource(source, 0);
    assert.deepEqual(parsed?.value, {
      kind: "UDim",
      scale: 0.5,
      offset: 10,
    });
    assert.equal(parsed?.endOffset, source.length);
  });

  it("parses generated UDim2 source", () => {
    const source = "UDim2.new(0.5, 10, 1, 20)";
    const parsed = tryParseRobloxValueFromSource(source, 0);
    assert.deepEqual(parsed?.value, {
      kind: "UDim2",
      xScale: 0.5,
      xOffset: 10,
      yScale: 1,
      yOffset: 20,
    });
    assert.equal(parsed?.endOffset, source.length);
  });

  it("parses generated Rect source", () => {
    const source = "Rect.new(0, 0, 100, 50)";
    const parsed = tryParseRobloxValueFromSource(source, 0);
    assert.deepEqual(parsed?.value, {
      kind: "Rect",
      minX: 0,
      minY: 0,
      maxX: 100,
      maxY: 50,
    });
    assert.equal(parsed?.endOffset, source.length);
  });

  it("parses generated NumberRange source", () => {
    const source = "NumberRange.new(0, 100)";
    const parsed = tryParseRobloxValueFromSource(source, 0);
    assert.deepEqual(parsed?.value, {
      kind: "NumberRange",
      min: 0,
      max: 100,
    });
    assert.equal(parsed?.endOffset, source.length);
  });

  it("parses generated Color3 source", () => {
    const source = "Color3.fromRGB(255, 128, 0)";
    const parsed = tryParseRobloxValueFromSource(source, 0);
    assert.deepEqual(parsed?.value, {
      kind: "Color3",
      r: 255,
      g: 128,
      b: 0,
    });
    assert.equal(parsed?.endOffset, source.length);
  });
});

describe("convertRichTextToLuauValue", () => {
  it("returns typed value without fallback for valid input", () => {
    const result = convertRichTextToLuauValue("Vector3", "10, 5, -20");
    assert.equal(result.usedFallback, false);
    assert.deepEqual(result.value, {
      kind: "Vector3",
      x: 10,
      y: 5,
      z: -20,
    });
  });

  it("falls back to string on invalid typed values", () => {
    const result = convertRichTextToLuauValue("Vector3", "bad");
    assert.equal(result.usedFallback, true);
    assert.equal(result.value, "bad");
  });
});

describe("resolveExportableProperty", () => {
  it("resolves typed rich_text property names", () => {
    assert.deepEqual(
      resolveExportableProperty("Position [Vector3]", "rich_text"),
      {
        name: "Position",
        notionType: "rich_text",
        robloxType: "Vector3",
        notionPropertyName: "Position [Vector3]",
      },
    );
  });

  it("returns plain property names unchanged", () => {
    assert.deepEqual(resolveExportableProperty("Description", "rich_text"), {
      name: "Description",
      notionType: "rich_text",
    });
  });
});

describe("formatTypedPropertyName", () => {
  it("builds Notion column names", () => {
    assert.equal(
      formatTypedPropertyName("Position", "Vector3"),
      "Position [Vector3]",
    );
  });
});
