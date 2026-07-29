import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  canOmitRecordIndexes,
  isNumericRecordKey,
} from "../src/record-index.js";

describe("isNumericRecordKey", () => {
  it("accepts zero and positive integers without leading zeros", () => {
    assert.equal(isNumericRecordKey("0"), true);
    assert.equal(isNumericRecordKey("1"), true);
    assert.equal(isNumericRecordKey("12"), true);
  });

  it("rejects invalid numeric keys", () => {
    assert.equal(isNumericRecordKey("01"), false);
    assert.equal(isNumericRecordKey("1a"), false);
    assert.equal(isNumericRecordKey("ItemA"), false);
    assert.equal(isNumericRecordKey(""), false);
  });
});

describe("canOmitRecordIndexes", () => {
  it("returns true for contiguous 1-based numeric keys", () => {
    assert.equal(canOmitRecordIndexes(["1"]), true);
    assert.equal(canOmitRecordIndexes(["2", "1", "3"]), true);
  });

  it("returns false for empty keys", () => {
    assert.equal(canOmitRecordIndexes([]), false);
  });

  it("returns false when keys start at zero", () => {
    assert.equal(canOmitRecordIndexes(["0"]), false);
    assert.equal(canOmitRecordIndexes(["0", "1", "2"]), false);
  });

  it("returns false for gaps or non-numeric keys", () => {
    assert.equal(canOmitRecordIndexes(["1", "3"]), false);
    assert.equal(canOmitRecordIndexes(["1", "ItemA"]), false);
    assert.equal(canOmitRecordIndexes(["01", "2"]), false);
  });
});
