import type { Client } from "@notionhq/client";
import type { DataSourceObjectResponse } from "@notionhq/client/build/src/api-endpoints.js";

import { NotionToLuaError } from "./errors.js";

type ResolvePageNotionClient = Pick<Client, "blocks">;

type BlockParent = {
  type: string;
  page_id?: string;
  block_id?: string;
  workspace?: boolean;
};

type BlockWithParent = {
  parent: BlockParent;
};

export async function resolvePageId(
  notion: ResolvePageNotionClient,
  dataSource: DataSourceObjectResponse,
  pageIdOverride?: string,
): Promise<string> {
  if (pageIdOverride) {
    return pageIdOverride;
  }

  const parent = dataSource.database_parent;

  if (parent.type === "page_id") {
    return parent.page_id;
  }

  if (parent.type === "block_id") {
    return resolvePageIdFromBlock(notion, parent.block_id);
  }

  if (parent.type === "workspace") {
    throw new NotionToLuaError(
      "Databases directly under the workspace have no write target page. Specify --page-id.",
    );
  }

  throw new NotionToLuaError(
    "Could not resolve the write target page. Specify --page-id.",
  );
}

async function resolvePageIdFromBlock(
  notion: ResolvePageNotionClient,
  blockId: string,
): Promise<string> {
  let currentBlockId = blockId;
  const visited = new Set<string>();

  while (true) {
    if (visited.has(currentBlockId)) {
      throw new NotionToLuaError(
        "Could not resolve the write target page. Block parent references form a cycle.",
      );
    }

    visited.add(currentBlockId);

    const block = (await notion.blocks.retrieve({
      block_id: currentBlockId,
    })) as BlockWithParent;

    const parent = block.parent;

    if (parent.type === "page_id" && parent.page_id) {
      return parent.page_id;
    }

    if (parent.type === "block_id" && parent.block_id) {
      currentBlockId = parent.block_id;
      continue;
    }

    if (parent.type === "workspace") {
      throw new NotionToLuaError(
        "Databases directly under the workspace have no write target page. Specify --page-id.",
      );
    }

    throw new NotionToLuaError(
      "Could not resolve the write target page. Specify --page-id.",
    );
  }
}
