import {
  NUMERIC_TITLE_PATTERN,
  parseNumericRelationTitle,
} from "./relation-array.js";

export { NUMERIC_TITLE_PATTERN, parseNumericRelationTitle };

export function isNumericRecordKey(key: string): boolean {
  return NUMERIC_TITLE_PATTERN.test(key);
}

export function canOmitRecordIndexes(keys: string[]): boolean {
  if (keys.length === 0) {
    return false;
  }

  const numbers: number[] = [];

  for (const key of keys) {
    if (!isNumericRecordKey(key)) {
      return false;
    }

    numbers.push(parseNumericRelationTitle(key));
  }

  numbers.sort((left, right) => left - right);

  if (numbers[0] !== 1) {
    return false;
  }

  for (let index = 0; index < numbers.length; index += 1) {
    if (numbers[index] !== index + 1) {
      return false;
    }
  }

  return true;
}
