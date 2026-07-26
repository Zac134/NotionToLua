import type { Client } from "@notionhq/client";
import type { BlockObjectResponse } from "@notionhq/client/build/src/api-endpoints.js";

import { NotionToLuaError } from "./errors.js";

type NotionClient = Pick<Client, "blocks">;

const LUA_LANGUAGES = new Set(["lua"]);

type CodeBlock = Extract<BlockObjectResponse, { type: "code" }>;

function isCodeBlock(block: BlockObjectResponse): block is CodeBlock {
  return block.type === "code";
}

function isSupportedLuaLanguage(language: string): boolean {
  const normalized = language.trim().toLowerCase();
  return LUA_LANGUAGES.has(normalized) || normalized === "luau";
}

function richTextFromContent(content: string) {
  const chunks: Array<{
    type: "text";
    text: { content: string };
  }> = [];

  for (let index = 0; index < content.length; index += 2000) {
    chunks.push({
      type: "text",
      text: {
        content: content.slice(index, index + 2000),
      },
    });
  }

  if (chunks.length === 0) {
    chunks.push({
      type: "text",
      text: { content: "" },
    });
  }

  return chunks;
}

async function listChildBlocks(
  notion: NotionClient,
  blockId: string,
): Promise<BlockObjectResponse[]> {
  const blocks: BlockObjectResponse[] = [];
  let startCursor: string | undefined;

  do {
    const response = await notion.blocks.children.list({
      block_id: blockId,
      start_cursor: startCursor,
    });

    for (const block of response.results) {
      if ("type" in block) {
        blocks.push(block as BlockObjectResponse);
      }
    }

    startCursor = response.has_more
      ? (response.next_cursor ?? undefined)
      : undefined;
  } while (startCursor);

  return blocks;
}

async function findLuauCodeBlockRecursive(
  notion: NotionClient,
  blockId: string,
): Promise<CodeBlock | null> {
  const children = await listChildBlocks(notion, blockId);

  for (const block of children) {
    if (isCodeBlock(block) && isSupportedLuaLanguage(block.code.language)) {
      return block;
    }

    if (block.has_children) {
      const nested = await findLuauCodeBlockRecursive(notion, block.id);
      if (nested) {
        return nested;
      }
    }
  }

  return null;
}

export async function findLuauCodeBlock(
  notion: NotionClient,
  pageId: string,
): Promise<CodeBlock | null> {
  return findLuauCodeBlockRecursive(notion, pageId);
}

export async function updateCodeBlockContent(
  notion: NotionClient,
  blockId: string,
  content: string,
): Promise<void> {
  await notion.blocks.update({
    block_id: blockId,
    code: {
      rich_text: richTextFromContent(content),
      language: "lua",
    },
  });
}

export async function appendLuauCodeBlock(
  notion: NotionClient,
  pageId: string,
  content: string,
): Promise<void> {
  await notion.blocks.children.append({
    block_id: pageId,
    children: [
      {
        object: "block",
        type: "code",
        code: {
          rich_text: richTextFromContent(content),
          language: "lua",
          caption: [],
        },
      },
    ],
  });
}

export async function syncPageCodeBlock(
  notion: NotionClient,
  pageId: string,
  content: string,
): Promise<"updated" | "created"> {
  const existingBlock = await findLuauCodeBlock(notion, pageId);

  if (existingBlock) {
    await updateCodeBlockContent(notion, existingBlock.id, content);
    return "updated";
  }

  try {
    await appendLuauCodeBlock(notion, pageId, content);
    return "created";
  } catch {
    throw new NotionToLuaError(
      "コードブロックの作成に失敗しました。ページへの書き込み権限を確認してください。",
    );
  }
}

export type CodeBlockUpdater = {
  sync(pageId: string, content: string): Promise<"updated" | "created">;
};

export function createCodeBlockUpdater(notion: NotionClient): CodeBlockUpdater {
  return {
    async sync(pageId, content) {
      return syncPageCodeBlock(notion, pageId, content);
    },
  };
}
