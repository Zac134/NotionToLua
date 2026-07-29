import type { LuauValue, RobloxTypeName, TypedRobloxValue } from "./types.js";

export const ROBLOX_TYPE_NAMES: readonly RobloxTypeName[] = [
  "Vector2",
  "Vector3",
  "Color3",
  "UDim",
  "UDim2",
  "Rect",
  "NumberRange",
  "CFrame",
] as const;

const ROBLOX_TYPE_SET = new Set<string>(ROBLOX_TYPE_NAMES);

const TYPED_PROPERTY_PATTERN = /^(.+) \[([A-Za-z][A-Za-z0-9]*)\]$/;

const NUMBER_PATTERN = /^-?\d+(?:\.\d+)?/;

export type ParsedTypedProperty = {
  baseName: string;
  robloxType: RobloxTypeName;
};

export function isRobloxTypeName(value: string): value is RobloxTypeName {
  return ROBLOX_TYPE_SET.has(value);
}

export function parseTypedPropertyName(
  notionPropertyName: string,
): ParsedTypedProperty | null {
  const match = notionPropertyName.match(TYPED_PROPERTY_PATTERN);
  if (!match) {
    return null;
  }

  const baseName = match[1]?.trim() ?? "";
  const typeName = match[2] ?? "";

  if (baseName.length === 0 || !isRobloxTypeName(typeName)) {
    return null;
  }

  return { baseName, robloxType: typeName };
}

export function formatTypedPropertyName(
  baseName: string,
  robloxType: RobloxTypeName,
): string {
  return `${baseName} [${robloxType}]`;
}

function parseFiniteNumber(
  text: string,
  index: number,
): { value: number; index: number } | null {
  const slice = text.slice(index);
  const match = slice.match(NUMBER_PATTERN);
  if (!match) {
    return null;
  }

  const value = Number(match[0]);
  if (!Number.isFinite(value)) {
    return null;
  }

  return { value, index: index + match[0].length };
}

function skipWhitespace(text: string, index: number): number {
  while (index < text.length && /\s/u.test(text[index] ?? "")) {
    index += 1;
  }
  return index;
}

function parseCommaSeparatedNumbers(
  text: string,
  index: number,
  count: number,
): { values: number[]; index: number } | null {
  let cursor = skipWhitespace(text, index);

  if (text[cursor] !== "(") {
    return null;
  }
  cursor += 1;

  const values: number[] = [];

  for (let indexInList = 0; indexInList < count; indexInList += 1) {
    cursor = skipWhitespace(text, cursor);
    const parsed = parseFiniteNumber(text, cursor);
    if (!parsed) {
      return null;
    }

    values.push(parsed.value);
    cursor = skipWhitespace(text, parsed.index);

    if (indexInList < count - 1) {
      if (text[cursor] !== ",") {
        return null;
      }
      cursor += 1;
    }
  }

  cursor = skipWhitespace(text, cursor);
  if (text[cursor] !== ")") {
    return null;
  }

  return { values, index: cursor + 1 };
}

function parseNotionComponentList(
  text: string,
  count: number,
): number[] | null {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return null;
  }

  const parts = trimmed.split(",").map((part) => part.trim());
  if (parts.length !== count) {
    return null;
  }

  const values: number[] = [];
  for (const part of parts) {
    const value = Number(part);
    if (!Number.isFinite(value)) {
      return null;
    }
    values.push(value);
  }

  return values;
}

export function parseNotionValue(
  robloxType: RobloxTypeName,
  text: string,
): TypedRobloxValue | null {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return null;
  }

  switch (robloxType) {
    case "Vector2": {
      const values = parseNotionComponentList(trimmed, 2);
      if (!values) {
        return null;
      }
      return { kind: "Vector2", x: values[0], y: values[1] };
    }
    case "Vector3": {
      const values = parseNotionComponentList(trimmed, 3);
      if (!values) {
        return null;
      }
      return { kind: "Vector3", x: values[0], y: values[1], z: values[2] };
    }
    case "Color3": {
      const values = parseNotionComponentList(trimmed, 3);
      if (!values) {
        return null;
      }
      return { kind: "Color3", r: values[0], g: values[1], b: values[2] };
    }
    case "UDim": {
      const values = parseNotionComponentList(trimmed, 2);
      if (!values) {
        return null;
      }
      return { kind: "UDim", scale: values[0], offset: values[1] };
    }
    case "UDim2": {
      const values = parseNotionComponentList(trimmed, 4);
      if (!values) {
        return null;
      }
      return {
        kind: "UDim2",
        xScale: values[0],
        xOffset: values[1],
        yScale: values[2],
        yOffset: values[3],
      };
    }
    case "Rect": {
      const values = parseNotionComponentList(trimmed, 4);
      if (!values) {
        return null;
      }
      return {
        kind: "Rect",
        minX: values[0],
        minY: values[1],
        maxX: values[2],
        maxY: values[3],
      };
    }
    case "NumberRange": {
      const values = parseNotionComponentList(trimmed, 2);
      if (!values) {
        return null;
      }
      return { kind: "NumberRange", min: values[0], max: values[1] };
    }
    case "CFrame": {
      const pipeIndex = trimmed.indexOf("|");
      if (pipeIndex === -1) {
        return null;
      }

      const positionValues = parseNotionComponentList(
        trimmed.slice(0, pipeIndex),
        3,
      );
      const rotationValues = parseNotionComponentList(
        trimmed.slice(pipeIndex + 1),
        3,
      );
      if (!positionValues || !rotationValues) {
        return null;
      }

      return {
        kind: "CFrame",
        px: positionValues[0],
        py: positionValues[1],
        pz: positionValues[2],
        rx: rotationValues[0],
        ry: rotationValues[1],
        rz: rotationValues[2],
      };
    }
    default: {
      const exhaustive: never = robloxType;
      return exhaustive;
    }
  }
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : String(value);
}

export function serializeNotionValue(value: TypedRobloxValue): string {
  switch (value.kind) {
    case "Vector2":
      return `${formatNumber(value.x)}, ${formatNumber(value.y)}`;
    case "Vector3":
      return `${formatNumber(value.x)}, ${formatNumber(value.y)}, ${formatNumber(value.z)}`;
    case "Color3":
      return `${formatNumber(value.r)}, ${formatNumber(value.g)}, ${formatNumber(value.b)}`;
    case "UDim":
      return `${formatNumber(value.scale)}, ${formatNumber(value.offset)}`;
    case "UDim2":
      return `${formatNumber(value.xScale)}, ${formatNumber(value.xOffset)}, ${formatNumber(value.yScale)}, ${formatNumber(value.yOffset)}`;
    case "Rect":
      return `${formatNumber(value.minX)}, ${formatNumber(value.minY)}, ${formatNumber(value.maxX)}, ${formatNumber(value.maxY)}`;
    case "NumberRange":
      return `${formatNumber(value.min)}, ${formatNumber(value.max)}`;
    case "CFrame":
      return `${formatNumber(value.px)}, ${formatNumber(value.py)}, ${formatNumber(value.pz)} | ${formatNumber(value.rx)}, ${formatNumber(value.ry)}, ${formatNumber(value.rz)}`;
    default: {
      const exhaustive: never = value;
      return exhaustive;
    }
  }
}

export function formatRobloxValue(value: TypedRobloxValue): string {
  switch (value.kind) {
    case "Vector2":
      return `Vector2.new(${formatNumber(value.x)}, ${formatNumber(value.y)})`;
    case "Vector3":
      return `Vector3.new(${formatNumber(value.x)}, ${formatNumber(value.y)}, ${formatNumber(value.z)})`;
    case "Color3":
      return `Color3.fromRGB(${formatNumber(value.r)}, ${formatNumber(value.g)}, ${formatNumber(value.b)})`;
    case "UDim":
      return `UDim.new(${formatNumber(value.scale)}, ${formatNumber(value.offset)})`;
    case "UDim2":
      return `UDim2.new(${formatNumber(value.xScale)}, ${formatNumber(value.xOffset)}, ${formatNumber(value.yScale)}, ${formatNumber(value.yOffset)})`;
    case "Rect":
      return `Rect.new(${formatNumber(value.minX)}, ${formatNumber(value.minY)}, ${formatNumber(value.maxX)}, ${formatNumber(value.maxY)})`;
    case "NumberRange":
      return `NumberRange.new(${formatNumber(value.min)}, ${formatNumber(value.max)})`;
    case "CFrame":
      return `CFrame.new(${formatNumber(value.px)}, ${formatNumber(value.py)}, ${formatNumber(value.pz)}) * CFrame.fromEulerAnglesYXZ(math.rad(${formatNumber(value.rx)}), math.rad(${formatNumber(value.ry)}), math.rad(${formatNumber(value.rz)}))`;
    default: {
      const exhaustive: never = value;
      return exhaustive;
    }
  }
}

function expectIdentifier(
  text: string,
  index: number,
  expected: string,
): number | null {
  let cursor = skipWhitespace(text, index);
  if (!text.slice(cursor).startsWith(expected)) {
    return null;
  }

  const next = text[cursor + expected.length];
  if (next && /[A-Za-z0-9_]/u.test(next)) {
    return null;
  }

  return cursor + expected.length;
}

function parseCallNumbers(
  text: string,
  index: number,
  count: number,
): { values: number[]; index: number } | null {
  return parseCommaSeparatedNumbers(text, index, count);
}

function buildTypedValue(
  kind: RobloxTypeName,
  values: number[],
): TypedRobloxValue | null {
  switch (kind) {
    case "Vector2":
      return { kind, x: values[0], y: values[1] };
    case "Vector3":
      return { kind, x: values[0], y: values[1], z: values[2] };
    case "Color3":
      return { kind, r: values[0], g: values[1], b: values[2] };
    case "UDim":
      return { kind, scale: values[0], offset: values[1] };
    case "UDim2":
      return {
        kind,
        xScale: values[0],
        xOffset: values[1],
        yScale: values[2],
        yOffset: values[3],
      };
    case "Rect":
      return {
        kind,
        minX: values[0],
        minY: values[1],
        maxX: values[2],
        maxY: values[3],
      };
    case "NumberRange":
      return { kind, min: values[0], max: values[1] };
    default:
      return null;
  }
}

function parseSimpleConstructor(
  text: string,
  index: number,
  typeName: RobloxTypeName,
  methodName: "new" | "fromRGB",
  arity: number,
): { value: TypedRobloxValue; index: number } | null {
  let cursor = expectIdentifier(text, index, typeName);
  if (cursor === null) {
    return null;
  }

  if (text[cursor] !== ".") {
    return null;
  }
  cursor += 1;

  cursor = expectIdentifier(text, cursor, methodName);
  if (cursor === null) {
    return null;
  }

  const parsed = parseCallNumbers(text, cursor, arity);
  if (!parsed) {
    return null;
  }

  const value = buildTypedValue(typeName, parsed.values);
  if (!value) {
    return null;
  }

  return { value, index: skipWhitespace(text, parsed.index) };
}

function parseMathRad(
  text: string,
  index: number,
): { value: number; index: number } | null {
  let cursor = expectIdentifier(text, index, "math");
  if (cursor === null || text[cursor] !== ".") {
    return null;
  }
  cursor += 1;

  cursor = expectIdentifier(text, cursor, "rad");
  if (cursor === null) {
    return null;
  }

  const parsed = parseCallNumbers(text, cursor, 1);
  if (!parsed) {
    return null;
  }

  return { value: parsed.values[0], index: skipWhitespace(text, parsed.index) };
}

function parseCFrameExpression(
  text: string,
  index: number,
): { value: TypedRobloxValue; index: number } | null {
  let cursor = expectIdentifier(text, index, "CFrame");
  if (cursor === null || text[cursor] !== ".") {
    return null;
  }
  cursor += 1;
  cursor = expectIdentifier(text, cursor, "new");
  if (cursor === null) {
    return null;
  }

  const positionParsed = parseCallNumbers(text, cursor, 3);
  if (!positionParsed) {
    return null;
  }

  cursor = skipWhitespace(text, positionParsed.index);
  if (text[cursor] !== "*") {
    return null;
  }
  cursor += 1;

  cursor = expectIdentifier(text, cursor, "CFrame");
  if (cursor === null || text[cursor] !== ".") {
    return null;
  }
  cursor += 1;
  cursor = expectIdentifier(text, cursor, "fromEulerAnglesYXZ");
  if (cursor === null) {
    return null;
  }

  cursor = skipWhitespace(text, cursor);
  if (text[cursor] !== "(") {
    return null;
  }
  cursor += 1;

  const rotation: number[] = [];
  for (let indexInList = 0; indexInList < 3; indexInList += 1) {
    cursor = skipWhitespace(text, cursor);
    const parsedRad = parseMathRad(text, cursor);
    if (!parsedRad) {
      return null;
    }

    rotation.push(parsedRad.value);
    cursor = skipWhitespace(text, parsedRad.index);

    if (indexInList < 2) {
      if (text[cursor] !== ",") {
        return null;
      }
      cursor += 1;
    }
  }

  cursor = skipWhitespace(text, cursor);
  if (text[cursor] !== ")") {
    return null;
  }
  cursor += 1;

  return {
    value: {
      kind: "CFrame",
      px: positionParsed.values[0],
      py: positionParsed.values[1],
      pz: positionParsed.values[2],
      rx: rotation[0],
      ry: rotation[1],
      rz: rotation[2],
    },
    index: skipWhitespace(text, cursor),
  };
}

export function tryParseRobloxValueFromSource(
  source: string,
  startOffset: number,
): { value: TypedRobloxValue; endOffset: number } | null {
  const attempts: Array<
    () => { value: TypedRobloxValue; index: number } | null
  > = [
    () => parseSimpleConstructor(source, startOffset, "Vector2", "new", 2),
    () => parseSimpleConstructor(source, startOffset, "Vector3", "new", 3),
    () => parseSimpleConstructor(source, startOffset, "Color3", "fromRGB", 3),
    () => parseSimpleConstructor(source, startOffset, "UDim", "new", 2),
    () => parseSimpleConstructor(source, startOffset, "UDim2", "new", 4),
    () => parseSimpleConstructor(source, startOffset, "Rect", "new", 4),
    () => parseSimpleConstructor(source, startOffset, "NumberRange", "new", 2),
    () => parseCFrameExpression(source, startOffset),
  ];

  for (const attempt of attempts) {
    const parsed = attempt();
    if (parsed) {
      return { value: parsed.value, endOffset: parsed.index };
    }
  }

  return null;
}

export function convertRichTextToLuauValue(
  robloxType: RobloxTypeName,
  text: string,
): { value: LuauValue; usedFallback: boolean } {
  const typed = parseNotionValue(robloxType, text);
  if (typed) {
    return { value: typed, usedFallback: false };
  }

  return { value: text, usedFallback: true };
}

export function resolveExportableProperty(
  notionPropertyName: string,
  notionType: string,
): {
  name: string;
  notionType: string;
  robloxType?: RobloxTypeName;
  notionPropertyName?: string;
} {
  const parsed = parseTypedPropertyName(notionPropertyName);
  if (parsed) {
    return {
      name: parsed.baseName,
      notionType,
      robloxType: parsed.robloxType,
      notionPropertyName,
    };
  }

  return { name: notionPropertyName, notionType };
}
