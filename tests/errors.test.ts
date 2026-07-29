import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { NotionToLuaError, toUserErrorMessage } from "../src/errors.js";

describe("toUserErrorMessage", () => {
  it("returns NotionToLuaError message", () => {
    assert.equal(
      toUserErrorMessage(new NotionToLuaError("Config is invalid.")),
      "Config is invalid.",
    );
  });

  it("maps object_not_found to a not-found message", () => {
    assert.equal(
      toUserErrorMessage({ code: "object_not_found" }),
      "Database or page not found. Check the integration connection and ID.",
    );
  });

  it("maps unauthorized to a permissions message", () => {
    assert.equal(
      toUserErrorMessage({ code: "unauthorized" }),
      "Insufficient permissions. Share the target page and database with the integration.",
    );
  });

  it("maps restricted_resource to a permissions message", () => {
    assert.equal(
      toUserErrorMessage({ code: "restricted_resource" }),
      "Insufficient permissions. Share the target page and database with the integration.",
    );
  });

  it("returns validation_error message when provided", () => {
    assert.equal(
      toUserErrorMessage({ code: "validation_error", message: "custom" }),
      "custom",
    );
  });

  it("returns default validation_error message when message is missing", () => {
    assert.equal(
      toUserErrorMessage({ code: "validation_error" }),
      "Invalid Notion API input.",
    );
  });

  it("returns Error.message for unknown Notion error codes on Error objects", () => {
    const error = new Error("Network timeout");
    Object.assign(error, { code: "rate_limited" });

    assert.equal(toUserErrorMessage(error), "Network timeout");
  });

  it("returns fallback message for non-Error values", () => {
    assert.equal(toUserErrorMessage("x"), "An unexpected error occurred.");
  });
});
