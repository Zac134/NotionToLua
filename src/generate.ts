import type { Client } from "@notionhq/client";
import type { DataSourceObjectResponse } from "@notionhq/client/build/src/api-endpoints.js";

import { defaultModuleGenerator } from "./generator.js";
import {
  assertNamePropertyExists,
  fetchAllDatabaseRecords,
  pagesToLuauRecords,
  resolveDataSource,
} from "./notion.js";

export type GenerateLuauNotionClient = Pick<
  Client,
  "databases" | "dataSources" | "pages" | "blocks"
>;

export type GenerateLuauCodeResult = {
  luauCode: string;
  recordCount: number;
  dataSource: DataSourceObjectResponse;
};

export async function generateLuauCode(
  notion: GenerateLuauNotionClient,
  databaseId: string,
): Promise<GenerateLuauCodeResult> {
  const dataSource = await resolveDataSource(notion, databaseId);
  assertNamePropertyExists(dataSource);

  const pages = await fetchAllDatabaseRecords(notion, dataSource.id);
  const records = pagesToLuauRecords(pages, dataSource);
  const luauCode = defaultModuleGenerator.generate(records);

  return {
    luauCode,
    recordCount: records.length,
    dataSource,
  };
}
