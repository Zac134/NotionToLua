import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { NotionToLuaError } from "../src/errors.js";
import {
  formatArrayRelationPropertyName,
  parseArrayRelationPropertyName,
  parseNumericRelationTitle,
  sortRelatedEntriesByNumericTitle,
} from "../src/relation-array.js";

describe("parseArrayRelationPropertyName", () => {
  it("parses array relation annotations", () => {
    assert.deepEqual(parseArrayRelationPropertyName("Items [Array]"), {
      baseName: "Items",
    });
  });

  it("returns null for plain relation names", () => {
    assert.equal(parseArrayRelationPropertyName("Effects"), null);
  });
});

describe("parseNumericRelationTitle", () => {
  it("accepts zero and positive integers without leading zeros", () => {
    assert.equal(parseNumericRelationTitle("0"), 0);
    assert.equal(parseNumericRelationTitle("12"), 12);
  });

  it("rejects invalid numeric titles", () => {
    assert.throws(
      () => parseNumericRelationTitle("01"),
      (error: unknown) => {
        assert.ok(error instanceof NotionToLuaError);
        return true;
      },
    );
  });
});

describe("sortRelatedEntriesByNumericTitle", () => {
  it("sorts entries numerically", () => {
    const sorted = sortRelatedEntriesByNumericTitle([
      { sortKey: 10, title: "10", value: "b" },
      { sortKey: 2, title: "2", value: "a" },
    ]);

    assert.deepEqual(sorted.map((entry) => entry.title), ["2", "10"]);
  });
});

describe("formatArrayRelationPropertyName", () => {
  it("builds Notion column names", () => {
    assert.equal(formatArrayRelationPropertyName("Items"), "Items [Array]");
  });
});
