import { readFileSync, statSync } from "node:fs";

import type { Client } from "@notionhq/client";

import { NotionToLuaError } from "./errors.js";
import { parseLuauModule } from "./luau-parser.js";
import { createDatabaseFromSchema, insertRecords } from "./notion-write.js";
import { inferNotionSchema } from "./schema-infer.js";

type NotionWriteClient = Pick<Client, "databases" | "pages">;

function readLuauModuleFile(filePath: string): string {
  try {
    const stats = statSync(filePath);
    if (!stats.isFile()) {
      throw new NotionToLuaError(
        `Expected a file path, got a directory: ${filePath}`,
      );
    }
  } catch (error) {
    if (error instanceof NotionToLuaError) {
      throw error;
    }

    throw new NotionToLuaError(`Luau file not found: ${filePath}`);
  }

  return readFileSync(filePath, "utf8");
}

export async function pushLuauFile(
  notion: NotionWriteClient,
  args: { filePath: string; pageId: string },
): Promise<{
  moduleName: string;
  databaseId: string;
  dataSourceId: string;
  recordCount: number;
}> {
  const source = readLuauModuleFile(args.filePath);
  const { moduleName, records } = parseLuauModule(source);
  const schema = inferNotionSchema(records);

  const { databaseId, dataSourceId, properties } = await createDatabaseFromSchema(
    notion,
    {
      pageId: args.pageId,
      databaseTitle: moduleName,
      schema,
    },
  );

  let insertedCount = 0;
  try {
    ({ insertedCount } = await insertRecords(notion, {
      dataSourceId,
      titlePropertyName: schema.titlePropertyName,
      properties,
      records,
    }));
  } catch (error) {
    throw new NotionToLuaError(
      `${error instanceof Error ? error.message : String(error)} Database already created: ${databaseId} (data_source ${dataSourceId}).`,
    );
  }

  return {
    moduleName,
    databaseId,
    dataSourceId,
    recordCount: insertedCount,
  };
}
