import type { Client } from "@notionhq/client";
import type {
  DataSourceObjectResponse,
  PageObjectResponse,
  RichTextItemResponse,
} from "@notionhq/client/build/src/api-endpoints.js";

import { NotionToLuaError } from "./errors.js";
import { resolveLuauKeyFormat } from "./formatter.js";
import {
  SUPPORTED_PROPERTY_TYPES,
  type LuauRecord,
  type LuauValue,
} from "./types.js";

type NotionClient = Pick<
  Client,
  "databases" | "dataSources" | "pages" | "blocks"
>;

type PageProperty = PageObjectResponse["properties"][string];

function richTextToPlainText(items: RichTextItemResponse[]): string {
  return items.map((item) => item.plain_text).join("");
}

function isPageObject(
  page: PageObjectResponse | { object: string },
): page is PageObjectResponse {
  return page.object === "page" && "properties" in page;
}

function isDataSourceWithProperties(
  dataSource: DataSourceObjectResponse | { object: string },
): dataSource is DataSourceObjectResponse {
  return dataSource.object === "data_source" && "properties" in dataSource;
}

export function getDataSourceTitle(dataSource: DataSourceObjectResponse): string {
  return (
    dataSource.title.map((item) => item.plain_text).join("") || dataSource.id
  );
}

async function retrieveDataSourceById(
  notion: NotionClient,
  dataSourceId: string,
): Promise<DataSourceObjectResponse> {
  const dataSource = await notion.dataSources.retrieve({
    data_source_id: dataSourceId,
  });

  if (!isDataSourceWithProperties(dataSource)) {
    throw new NotionToLuaError(
      "データソースのスキーマを取得できませんでした。",
    );
  }

  return dataSource;
}

export async function resolveDataSource(
  notion: NotionClient,
  databaseId: string,
): Promise<DataSourceObjectResponse> {
  try {
    return await retrieveDataSourceById(notion, databaseId);
  } catch {
    // databaseId が data_source_id でない場合は database_id として解決する。
  }

  const database = await notion.databases.retrieve({
    database_id: databaseId,
  });

  if (!("data_sources" in database) || database.data_sources.length === 0) {
    throw new NotionToLuaError(
      "データベースが見つからないか、データソースが存在しません。",
    );
  }

  if (database.data_sources.length > 1) {
    throw new NotionToLuaError(
      "データベースに複数のデータソースがあります。`databaseId` には data_source_id を直接指定してください。",
    );
  }

  return retrieveDataSourceById(notion, database.data_sources[0].id);
}

export function resolveTitlePropertyName(
  dataSource: DataSourceObjectResponse,
): string {
  const titleProperties = Object.entries(dataSource.properties).filter(
    ([, property]) => property.type === "title",
  );

  if (titleProperties.length === 0) {
    throw new NotionToLuaError(
      `title 型のプロパティがありません。データベース「${getDataSourceTitle(dataSource)}」に主キー列（title 型）を追加してください。`,
    );
  }

  if (titleProperties.length > 1) {
    throw new NotionToLuaError(
      `title 型のプロパティが複数あります。データベース「${getDataSourceTitle(dataSource)}」の主キー列を1つにしてください。`,
    );
  }

  return titleProperties[0][0];
}

export function assertTitlePropertyExists(
  dataSource: DataSourceObjectResponse,
): string {
  return resolveTitlePropertyName(dataSource);
}

export async function fetchAllDatabaseRecords(
  notion: NotionClient,
  dataSourceId: string,
): Promise<PageObjectResponse[]> {
  const pages: PageObjectResponse[] = [];
  let startCursor: string | undefined;

  do {
    const response = await notion.dataSources.query({
      data_source_id: dataSourceId,
      result_type: "page",
      start_cursor: startCursor,
    });

    for (const result of response.results) {
      if (isPageObject(result)) {
        pages.push(result);
      }
    }

    startCursor = response.has_more
      ? (response.next_cursor ?? undefined)
      : undefined;
  } while (startCursor);

  return pages;
}

function convertDateValue(
  date: Extract<PageProperty, { type: "date" }>["date"],
): string | null {
  if (!date?.start) {
    return null;
  }

  return date.start;
}

function convertFormulaValue(
  formula: Extract<PageProperty, { type: "formula" }>["formula"],
): LuauValue {
  switch (formula.type) {
    case "string":
      return formula.string ?? null;
    case "number":
      return formula.number ?? null;
    case "boolean":
      return formula.boolean ?? null;
    case "date":
      return formula.date?.start ?? null;
    default:
      return null;
  }
}

export function convertPropertyValue(
  property: PageProperty,
): LuauValue | undefined {
  if (!SUPPORTED_PROPERTY_TYPES.has(property.type)) {
    return undefined;
  }

  switch (property.type) {
    case "number":
      return property.number ?? null;
    case "checkbox":
      return property.checkbox ?? null;
    case "rich_text":
      return richTextToPlainText(property.rich_text) || null;
    case "select":
      return property.select?.name ?? null;
    case "multi_select":
      return property.multi_select.length > 0
        ? property.multi_select.map((option) => option.name)
        : null;
    case "date":
      return convertDateValue(property.date);
    case "url":
      return property.url ?? null;
    case "formula":
      return convertFormulaValue(property.formula);
    case "status":
      return property.status?.name ?? null;
    default:
      return undefined;
  }
}

export function extractTitleKey(
  page: PageObjectResponse,
  titlePropertyName: string,
): string {
  const titleProperty = page.properties[titlePropertyName];

  if (!titleProperty || titleProperty.type !== "title") {
    throw new NotionToLuaError(
      `title 列「${titlePropertyName}」の読み取りに失敗しました。`,
    );
  }

  const title = richTextToPlainText(titleProperty.title).trim();

  if (!title) {
    throw new NotionToLuaError(
      `title 列「${titlePropertyName}」が空のレコードがあります。すべてのレコードに値を設定してください。`,
    );
  }

  return title;
}

export function pagesToLuauRecords(
  pages: PageObjectResponse[],
  dataSource: DataSourceObjectResponse,
): LuauRecord[] {
  const titlePropertyName = resolveTitlePropertyName(dataSource);
  const exportableProperties = Object.entries(dataSource.properties)
    .filter(([propertyName, property]) => {
      if (propertyName === titlePropertyName) {
        return false;
      }

      return SUPPORTED_PROPERTY_TYPES.has(property.type);
    })
    .map(([propertyName]) => propertyName);

  const seenKeys = new Map<string, number>();
  const records: LuauRecord[] = [];

  for (const page of pages) {
    const key = extractTitleKey(page, titlePropertyName);
    const duplicateCount = (seenKeys.get(key) ?? 0) + 1;
    seenKeys.set(key, duplicateCount);

    if (duplicateCount > 1) {
      throw new NotionToLuaError(
        `title 列の値「${key}」が重複しています。キーは一意である必要があります。`,
      );
    }

    const properties: Record<string, LuauValue> = {};

    for (const propertyName of exportableProperties) {
      const pageProperty = page.properties[propertyName];
      const dataSourceProperty = dataSource.properties[propertyName];

      if (!pageProperty || !dataSourceProperty) {
        continue;
      }

      if (pageProperty.type !== dataSourceProperty.type) {
        continue;
      }

      const converted = convertPropertyValue(pageProperty);

      if (converted === undefined) {
        continue;
      }

      properties[propertyName] = converted;
    }

    records.push({
      key,
      keyFormat: resolveLuauKeyFormat(key),
      properties,
    });
  }

  return records;
}

export function listExportablePropertyNames(
  dataSource: DataSourceObjectResponse,
): string[] {
  return listExportableProperties(dataSource).map((property) => property.name);
}

export function listExportableProperties(
  dataSource: DataSourceObjectResponse,
): Array<{ name: string; notionType: string }> {
  const titlePropertyName = resolveTitlePropertyName(dataSource);

  return Object.entries(dataSource.properties)
    .filter(
      ([propertyName, property]) =>
        propertyName !== titlePropertyName &&
        SUPPORTED_PROPERTY_TYPES.has(property.type),
    )
    .map(([propertyName, property]) => ({
      name: propertyName,
      notionType: property.type,
    }));
}
