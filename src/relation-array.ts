import { NotionToLuaError } from "./errors.js";

const ARRAY_RELATION_PATTERN = /^(.+) \[Array\]$/;

export const NUMERIC_TITLE_PATTERN = /^(0|[1-9]\d*)$/;

export type ParsedArrayRelationProperty = {
  baseName: string;
};

export function parseArrayRelationPropertyName(
  notionPropertyName: string,
): ParsedArrayRelationProperty | null {
  const match = notionPropertyName.match(ARRAY_RELATION_PATTERN);
  if (!match) {
    return null;
  }

  const baseName = match[1]?.trim() ?? "";
  if (baseName.length === 0) {
    return null;
  }

  return { baseName };
}

export function formatArrayRelationPropertyName(baseName: string): string {
  return `${baseName} [Array]`;
}

export function parseNumericRelationTitle(title: string): number {
  if (!NUMERIC_TITLE_PATTERN.test(title)) {
    throw new NotionToLuaError(
      `Related title "${title}" is not a valid numeric array key. Use non-negative integers without leading zeros (for example "0", "1", "12").`,
    );
  }

  return Number(title);
}

export function sortRelatedEntriesByNumericTitle<
  T extends { sortKey: number; title: string },
>(entries: T[]): T[] {
  return [...entries].sort((left, right) => left.sortKey - right.sortKey);
}
