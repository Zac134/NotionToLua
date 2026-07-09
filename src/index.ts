import { Worker } from "@notionhq/workers";
import { j } from "@notionhq/workers/schema-builder";

import { NotionToLuaError } from "./errors.js";
import { runGenerateLuau } from "./generate.js";
import type { ToolResult } from "./types.js";
import {
  resolveGenerateLuauInputFromWebhook,
  verifyWebhookSecret,
} from "./webhook.js";

const worker = new Worker();

worker.tool("generateLuau", {
  title: "Generate Luau",
  description:
    "指定した Notion データベースの全レコードを読み込み、Luau ModuleScript 形式のコードを生成し、同一ページ内の Lua/Luau コードブロックへ反映します。",
  schema: j.object({
    pageId: j.string().describe("Luau コードを書き込む Notion ページの ID。"),
    databaseId: j
      .string()
      .describe(
        "変換元の Notion データベース ID または data_source_id。複数データソースがある場合は data_source_id を直接指定してください。",
      ),
  }),
  outputSchema: j.object({
    success: j.boolean().describe("処理が成功したかどうか。"),
    message: j.string().describe("結果メッセージ。"),
    recordCount: j
      .number()
      .describe("変換したレコード数。失敗時は 0。")
      .nullable(),
    codeBlockAction: j
      .enum("updated", "created")
      .describe("コードブロックを更新したか新規作成したか。")
      .nullable(),
    error: j.string().describe("失敗時のエラーメッセージ。").nullable(),
  }),
  execute: async ({ pageId, databaseId }, { notion }): Promise<ToolResult> =>
    runGenerateLuau(notion, { pageId, databaseId }),
});

worker.webhook("generateLuauWebhook", {
  title: "Generate Luau Webhook",
  description:
    "Webhook 経由で Luau 生成を実行します。Notion オートメーションやページボタンから呼び出せます。",
  execute: async (events, { notion }) => {
    for (const event of events) {
      verifyWebhookSecret(event.headers);

      const input = await resolveGenerateLuauInputFromWebhook(notion, event);
      const result = await runGenerateLuau(notion, input);

      if (!result.success) {
        throw new NotionToLuaError(result.error);
      }
    }
  },
});

export default worker;
