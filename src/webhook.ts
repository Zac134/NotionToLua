import type { Client } from "@notionhq/client";
import type { WebhookEvent } from "@notionhq/workers";
import { WebhookVerificationError } from "@notionhq/workers";

import { findFirstChildDatabaseId } from "./blocks.js";
import { NotionToLuaError } from "./errors.js";
import type { GenerateLuauInput } from "./types.js";

const WEBHOOK_SECRET_HEADER = "x-webhook-secret";
const PAGE_ID_HEADERS = ["x-page-id", "x-notion-page-id"];
const DATABASE_ID_HEADERS = ["x-database-id", "x-notion-database-id"];

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function readNestedString(
  source: Record<string, unknown>,
  path: string[],
): string | undefined {
  let current: unknown = source;

  for (const key of path) {
    if (!current || typeof current !== "object" || !(key in current)) {
      return undefined;
    }

    current = (current as Record<string, unknown>)[key];
  }

  return readString(current);
}

function readHeader(
  headers: Record<string, string>,
  names: string[],
): string | undefined {
  for (const name of names) {
    const value = readString(headers[name]);
    if (value) {
      return value;
    }
  }

  return undefined;
}

function readBodyPageId(body: Record<string, unknown>): string | undefined {
  return (
    readString(body.pageId) ??
    readString(body.page_id) ??
    readNestedString(body, ["entity", "id"]) ??
    readNestedString(body, ["data", "id"]) ??
    readNestedString(body, ["page", "id"]) ??
    readString(body.id)
  );
}

function readBodyDatabaseId(body: Record<string, unknown>): string | undefined {
  return (
    readString(body.databaseId) ??
    readString(body.database_id) ??
    readString(body.data_source_id) ??
    readNestedString(body, ["database", "id"]) ??
    readNestedString(body, ["data_source", "id"])
  );
}

export function verifyWebhookSecret(
  headers: Record<string, string>,
  secret = process.env.WEBHOOK_SECRET,
): void {
  if (!secret) {
    return;
  }

  const provided = readHeader(headers, [WEBHOOK_SECRET_HEADER]);

  if (provided !== secret) {
    throw new WebhookVerificationError(
      "Webhook secret が一致しません。オートメーションのカスタムヘッダーを確認してください。",
    );
  }
}

export function parseGenerateLuauInputFromWebhook(
  event: Pick<WebhookEvent, "body" | "headers">,
  options?: {
    defaultDatabaseId?: string;
  },
): GenerateLuauInput {
  const pageId =
    readHeader(event.headers, PAGE_ID_HEADERS) ?? readBodyPageId(event.body);
  const databaseId =
    readHeader(event.headers, DATABASE_ID_HEADERS) ??
    readBodyDatabaseId(event.body) ??
    readString(options?.defaultDatabaseId);

  if (!pageId) {
    throw new NotionToLuaError(
      "pageId が指定されていません。JSON body、x-page-id ヘッダー、または Notion オートメーションの page ID を渡してください。",
    );
  }

  if (!databaseId) {
    throw new NotionToLuaError(
      "databaseId が指定されていません。JSON body、x-database-id ヘッダー、ページ内のリンク DB、または DEFAULT_DATABASE_ID シークレットを設定してください。",
    );
  }

  return { pageId, databaseId };
}

type WebhookNotionClient = Pick<Client, "blocks">;

export async function resolveGenerateLuauInputFromWebhook(
  notion: WebhookNotionClient,
  event: Pick<WebhookEvent, "body" | "headers">,
): Promise<GenerateLuauInput> {
  const pageId =
    readHeader(event.headers, PAGE_ID_HEADERS) ?? readBodyPageId(event.body);

  if (!pageId) {
    throw new NotionToLuaError(
      "pageId が指定されていません。JSON body、x-page-id ヘッダー、または Notion オートメーションの page ID を渡してください。",
    );
  }

  let databaseId =
    readHeader(event.headers, DATABASE_ID_HEADERS) ??
    readBodyDatabaseId(event.body) ??
    readString(process.env.DEFAULT_DATABASE_ID);

  if (!databaseId) {
    databaseId = (await findFirstChildDatabaseId(notion, pageId)) ?? undefined;
  }

  if (!databaseId) {
    throw new NotionToLuaError(
      "databaseId が指定されていません。x-database-id ヘッダー、JSON body、ページ内のリンク DB、または DEFAULT_DATABASE_ID シークレットを設定してください。",
    );
  }

  return { pageId, databaseId };
}
