import type { Client } from "@notionhq/client";
import type { DataSourceObjectResponse } from "@notionhq/client/build/src/api-endpoints.js";

import { defaultModuleGenerator } from "./generator.js";
import {
  assertTitlePropertyExists,
  fetchAllDatabaseRecords,
  listExportableProperties,
  pagesToLuauRecords,
  resolveDataSource,
} from "./notion.js";

export type GenerateLuauNotionClient = Pick<
  Client,
  "databases" | "dataSources" | "pages" | "blocks"
>;

export type GenerateLuauCodeOptions = {
  moduleName: string;
  dataSource?: DataSourceObjectResponse;
  exportTypes?: boolean;
};

export type GenerateLuauCodeResult = {
  luauCode: string;
  recordCount: number;
  dataSource: DataSourceObjectResponse;
};

export async function generateLuauCode(
  notion: GenerateLuauNotionClient,
  databaseId: string,
  options: GenerateLuauCodeOptions,
): Promise<GenerateLuauCodeResult> {
  const dataSource =
    options.dataSource ?? (await resolveDataSource(notion, databaseId));
  assertTitlePropertyExists(dataSource);

  const pages = await fetchAllDatabaseRecords(notion, dataSource.id);
  const records = pagesToLuauRecords(pages, dataSource);
  const luauCode = defaultModuleGenerator.generate(records, {
    moduleName: options.moduleName,
    properties: listExportableProperties(dataSource),
    exportTypes: options.exportTypes ?? true,
  });

  return {
    luauCode,
    recordCount: records.length,
    dataSource,
  };
}
