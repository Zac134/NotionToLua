import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { WebhookVerificationError } from "@notionhq/workers";

import { NotionToLuaError } from "../src/errors.js";
import {
  parseGenerateLuauInputFromWebhook,
  verifyWebhookSecret,
} from "../src/webhook.js";

describe("verifyWebhookSecret", () => {
  it("skips verification when WEBHOOK_SECRET is unset", () => {
    const original = process.env.WEBHOOK_SECRET;
    delete process.env.WEBHOOK_SECRET;

    assert.doesNotThrow(() => verifyWebhookSecret({}, undefined));

    process.env.WEBHOOK_SECRET = original;
  });

  it("throws when secret does not match", () => {
    assert.throws(
      () =>
        verifyWebhookSecret({ "x-webhook-secret": "wrong" }, "expected-secret"),
      (error: unknown) => error instanceof WebhookVerificationError,
    );
  });

  it("passes when secret matches", () => {
    assert.doesNotThrow(() =>
      verifyWebhookSecret(
        { "x-webhook-secret": "expected-secret" },
        "expected-secret",
      ),
    );
  });
});

describe("parseGenerateLuauInputFromWebhook", () => {
  it("reads values from JSON body", () => {
    const input = parseGenerateLuauInputFromWebhook({
      body: {
        pageId: "page-1",
        databaseId: "db-1",
      },
      headers: {},
    });

    assert.deepEqual(input, {
      pageId: "page-1",
      databaseId: "db-1",
    });
  });

  it("reads values from custom headers for Notion automations", () => {
    const input = parseGenerateLuauInputFromWebhook({
      body: {},
      headers: {
        "x-page-id": "page-2",
        "x-database-id": "db-2",
      },
    });

    assert.deepEqual(input, {
      pageId: "page-2",
      databaseId: "db-2",
    });
  });

  it("reads pageId from entity.id body shape", () => {
    const input = parseGenerateLuauInputFromWebhook({
      body: {
        entity: { id: "page-3" },
        databaseId: "db-3",
      },
      headers: {},
    });

    assert.deepEqual(input, {
      pageId: "page-3",
      databaseId: "db-3",
    });
  });

  it("uses defaultDatabaseId when databaseId is omitted", () => {
    const input = parseGenerateLuauInputFromWebhook(
      {
        body: { pageId: "page-4" },
        headers: {},
      },
      { defaultDatabaseId: "db-4" },
    );

    assert.deepEqual(input, {
      pageId: "page-4",
      databaseId: "db-4",
    });
  });

  it("throws when pageId is missing", () => {
    assert.throws(
      () =>
        parseGenerateLuauInputFromWebhook({
          body: { databaseId: "db-5" },
          headers: {},
        }),
      (error: unknown) => {
        assert.ok(error instanceof NotionToLuaError);
        assert.match(error.message, /pageId/);
        return true;
      },
    );
  });

  it("throws when databaseId is missing", () => {
    assert.throws(
      () =>
        parseGenerateLuauInputFromWebhook({
          body: { pageId: "page-6" },
          headers: {},
        }),
      (error: unknown) => {
        assert.ok(error instanceof NotionToLuaError);
        assert.match(error.message, /databaseId/);
        return true;
      },
    );
  });
});
