import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveModuleName, toPascalCase } from "../src/module-name.js";

describe("toPascalCase", () => {
  it("capitalizes the first letter", () => {
    assert.equal(toPascalCase("testModule"), "TestModule");
    assert.equal(toPascalCase("weapons"), "Weapons");
  });
});

describe("resolveModuleName", () => {
  it("returns valid identifiers unchanged", () => {
    assert.equal(resolveModuleName("testModule"), "testModule");
  });

  it("sanitizes invalid names", () => {
    assert.equal(resolveModuleName("My Module"), "My_Module");
  });

  it("prefixes names starting with numbers", () => {
    assert.equal(resolveModuleName("1Weapon"), "_1Weapon");
  });
});
