import type { Client } from "@notionhq/client";

import { createCodeBlockUpdater } from "./blocks.js";
import { toUserErrorMessage } from "./errors.js";
import { defaultModuleGenerator } from "./generator.js";
import {
  assertNamePropertyExists,
  fetchAllDatabaseRecords,
  pagesToLuauRecords,
  resolveDataSource,
} from "./notion.js";
import type { GenerateLuauInput, ToolResult } from "./types.js";

export type GenerateLuauNotionClient = Pick<
  Client,
  "databases" | "dataSources" | "pages" | "blocks"
>;

export async function runGenerateLuau(
  notion: GenerateLuauNotionClient,
  input: GenerateLuauInput,
): Promise<ToolResult> {
  try {
    const dataSource = await resolveDataSource(notion, input.databaseId);
    assertNamePropertyExists(dataSource);

    const pages = await fetchAllDatabaseRecords(notion, dataSource.id);
    const records = pagesToLuauRecords(pages, dataSource);
    const luauCode = defaultModuleGenerator.generate(records);

    const codeBlockUpdater = createCodeBlockUpdater(notion);
    const codeBlockAction = await codeBlockUpdater.sync(input.pageId, luauCode);

    return {
      success: true,
      message: `${records.length} 件のレコードを Luau に変換し、コードブロックを${codeBlockAction === "updated" ? "更新" : "作成"}しました。`,
      recordCount: records.length,
      codeBlockAction,
      error: null,
    };
  } catch (error) {
    const errorMessage = toUserErrorMessage(error);
    return {
      success: false,
      message: errorMessage,
      recordCount: null,
      codeBlockAction: null,
      error: errorMessage,
    };
  }
}
