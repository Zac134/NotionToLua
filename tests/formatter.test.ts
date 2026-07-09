import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  formatLuauKey,
  formatLuauString,
  formatLuauValue,
  isValidLuauIdentifier,
  resolveLuauKeyFormat,
} from "../src/formatter.js";

describe("isValidLuauIdentifier", () => {
  it("accepts valid identifiers", () => {
    assert.equal(isValidLuauIdentifier("ItemA"), true);
    assert.equal(isValidLuauIdentifier("_private"), true);
    assert.equal(isValidLuauIdentifier("foo123"), true);
    assert.equal(isValidLuauIdentifier("A"), true);
  });

  it("rejects invalid identifiers", () => {
    assert.equal(isValidLuauIdentifier("123abc"), false);
    assert.equal(isValidLuauIdentifier("my-key"), false);
    assert.equal(isValidLuauIdentifier("has space"), false);
    assert.equal(isValidLuauIdentifier("日本語"), false);
    assert.equal(isValidLuauIdentifier(""), false);
  });
});

describe("resolveLuauKeyFormat", () => {
  it("returns identifier for valid keys", () => {
    assert.equal(resolveLuauKeyFormat("ItemA"), "identifier");
  });

  it("returns bracket for invalid keys", () => {
    assert.equal(resolveLuauKeyFormat("my-key"), "bracket");
    assert.equal(resolveLuauKeyFormat("123"), "bracket");
  });
});

describe("formatLuauKey", () => {
  it("formats identifier keys without quotes", () => {
    assert.equal(formatLuauKey("ItemA", "identifier"), "ItemA");
  });

  it("formats bracket keys with escaped strings", () => {
    assert.equal(formatLuauKey("my-key", "bracket"), '["my-key"]');
    assert.equal(
      formatLuauKey('say "hi"', "bracket"),
      '["say \\"hi\\""]',
    );
  });
});

describe("formatLuauString", () => {
  it("wraps plain strings in double quotes", () => {
    assert.equal(formatLuauString("hello"), '"hello"');
  });

  it("escapes special characters", () => {
    assert.equal(formatLuauString('say "hi"'), '"say \\"hi\\""');
    assert.equal(formatLuauString("line\nbreak"), '"line\\nbreak"');
    assert.equal(formatLuauString("tab\there"), '"tab\\there"');
    assert.equal(formatLuauString("back\\slash"), '"back\\\\slash"');
    assert.equal(formatLuauString("carriage\rreturn"), '"carriage\\rreturn"');
  });
});

describe("formatLuauValue", () => {
  it("formats nil", () => {
    assert.equal(formatLuauValue(null), "nil");
  });

  it("formats booleans", () => {
    assert.equal(formatLuauValue(true), "true");
    assert.equal(formatLuauValue(false), "false");
  });

  it("formats numbers", () => {
    assert.equal(formatLuauValue(42), "42");
    assert.equal(formatLuauValue(3.14), "3.14");
    assert.equal(formatLuauValue(0), "0");
  });

  it("formats non-finite numbers as nil", () => {
    assert.equal(formatLuauValue(Number.NaN), "nil");
    assert.equal(formatLuauValue(Number.POSITIVE_INFINITY), "nil");
    assert.equal(formatLuauValue(Number.NEGATIVE_INFINITY), "nil");
  });

  it("formats strings with escaping", () => {
    assert.equal(formatLuauValue("plain"), '"plain"');
    assert.equal(formatLuauValue('quote "test"'), '"quote \\"test\\""');
  });

  it("formats arrays as Luau string lists", () => {
    assert.equal(formatLuauValue(["alpha", "beta"]), '{ "alpha", "beta" }');
    assert.equal(formatLuauValue([]), "{  }");
  });
});
