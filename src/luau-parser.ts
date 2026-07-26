import { resolveLuauKeyFormat } from "./formatter.js";
import { NotionToLuaError } from "./errors.js";
import type { LuauRecord, LuauTable, LuauValue } from "./types.js";
import { isLuauTable } from "./types.js";

export type ParsedModule = {
  moduleName: string;
  records: LuauRecord[];
};

type TokenType =
  | "identifier"
  | "string"
  | "number"
  | "local"
  | "return"
  | "export"
  | "type"
  | "nil"
  | "true"
  | "false"
  | "{"
  | "}"
  | "["
  | "]"
  | "="
  | ":"
  | ","
  | "eof";

interface Token {
  type: TokenType;
  value?: string | number;
  offset: number;
}

const KEYWORDS: Record<string, TokenType> = {
  local: "local",
  return: "return",
  export: "export",
  type: "type",
  nil: "nil",
  true: "true",
  false: "false",
};

function lex(source: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;

  const peek = (offset = 0): string => source[index + offset] ?? "";
  const advance = (count = 1): void => {
    index += count;
  };

  while (index < source.length) {
    const char = source[index];

    if (/\s/u.test(char)) {
      advance();
      continue;
    }

    const offset = index;

    if (char === "{" ) {
      tokens.push({ type: "{", offset });
      advance();
      continue;
    }
    if (char === "}") {
      tokens.push({ type: "}", offset });
      advance();
      continue;
    }
    if (char === "[") {
      tokens.push({ type: "[", offset });
      advance();
      continue;
    }
    if (char === "]") {
      tokens.push({ type: "]", offset });
      advance();
      continue;
    }
    if (char === "=") {
      tokens.push({ type: "=", offset });
      advance();
      continue;
    }
    if (char === ":") {
      tokens.push({ type: ":", offset });
      advance();
      continue;
    }
    if (char === ",") {
      tokens.push({ type: ",", offset });
      advance();
      continue;
    }

    if (char === '"') {
      advance();
      let value = "";
      while (index < source.length) {
        const current = source[index];
        if (current === '"') {
          advance();
          break;
        }
        if (current === "\\") {
          const escape = peek(1);
          switch (escape) {
            case "\\":
              value += "\\";
              break;
            case '"':
              value += '"';
              break;
            case "n":
              value += "\n";
              break;
            case "r":
              value += "\r";
              break;
            case "t":
              value += "\t";
              break;
            default:
              throw new NotionToLuaError(
                `Invalid escape sequence "\\${escape}" at offset ${index}.`,
              );
          }
          advance(2);
          continue;
        }
        value += current;
        advance();
      }
      if (source[index - 1] !== '"') {
        throw new NotionToLuaError(`Unterminated string at offset ${offset}.`);
      }
      tokens.push({ type: "string", value, offset });
      continue;
    }

    if (/[0-9]/u.test(char) || (char === "-" && /[0-9]/u.test(peek(1)))) {
      let numberText = char;
      advance();
      while (/[0-9]/u.test(peek())) {
        numberText += peek();
        advance();
      }
      if (peek() === "." && /[0-9]/u.test(peek(1))) {
        numberText += ".";
        advance();
        while (/[0-9]/u.test(peek())) {
          numberText += peek();
          advance();
        }
      }
      const value = Number(numberText);
      if (!Number.isFinite(value)) {
        throw new NotionToLuaError(`Invalid number "${numberText}" at offset ${offset}.`);
      }
      tokens.push({ type: "number", value, offset });
      continue;
    }

    if (/[A-Za-z_]/u.test(char)) {
      let identifier = char;
      advance();
      while (/[A-Za-z0-9_]/u.test(peek())) {
        identifier += peek();
        advance();
      }
      const keyword = KEYWORDS[identifier];
      tokens.push({
        type: keyword ?? "identifier",
        value: identifier,
        offset,
      });
      continue;
    }

    throw new NotionToLuaError(
      `Unexpected character "${char}" at offset ${offset}.`,
    );
  }

  tokens.push({ type: "eof", offset: index });
  return tokens;
}

class Parser {
  private index = 0;

  constructor(private readonly tokens: Token[]) {}

  parseModule(): ParsedModule {
    let moduleName: string | null = null;
    let moduleTable: LuauTable | null = null;
    let returnName: string | null = null;

    while (!this.isAtEnd()) {
      if (this.match("export")) {
        this.skipExportType();
        continue;
      }

      if (this.match("local")) {
        if (moduleName !== null) {
          throw new NotionToLuaError("Expected a single local module table assignment.");
        }
        const assignment = this.parseLocalAssignment();
        moduleName = assignment.name;
        moduleTable = assignment.table;
        continue;
      }

      if (this.match("return")) {
        if (returnName !== null) {
          throw new NotionToLuaError("Expected a single return statement.");
        }
        returnName = this.parseReturnIdentifier();
        continue;
      }

      throw new NotionToLuaError(
        `Unexpected token "${this.current().type}" at offset ${this.current().offset}.`,
      );
    }

    if (moduleName === null || moduleTable === null) {
      throw new NotionToLuaError("Expected a local module table assignment.");
    }

    if (returnName === null) {
      throw new NotionToLuaError("Expected a return statement.");
    }

    if (returnName !== moduleName) {
      throw new NotionToLuaError(
        `Return identifier "${returnName}" does not match local module name "${moduleName}".`,
      );
    }

    return {
      moduleName,
      records: this.moduleTableToRecords(moduleTable),
    };
  }

  private skipExportType(): void {
    this.expect("type");
    this.expect("identifier");
    this.expect("=");
    this.skipBalancedBraces();
  }

  private skipBalancedBraces(): void {
    this.expect("{");
    let depth = 1;
    while (depth > 0) {
      if (this.match("}")) {
        depth -= 1;
        continue;
      }
      if (this.match("{")) {
        depth += 1;
        continue;
      }
      if (this.match("[") || this.match("]") || this.match("=") || this.match(":")) {
        continue;
      }
      if (
        this.match("identifier") ||
        this.match("string") ||
        this.match("number") ||
        this.match("nil") ||
        this.match("true") ||
        this.match("false") ||
        this.match(",")
      ) {
        continue;
      }
      throw new NotionToLuaError(
        `Unexpected token "${this.current().type}" while skipping export type at offset ${this.current().offset}.`,
      );
    }
  }

  private parseLocalAssignment(): { name: string; table: LuauTable } {
    const name = this.expect("identifier").value as string;
    if (this.match(":")) {
      this.expect("identifier");
    }
    this.expect("=");
    const value = this.parseTableValue();
    if (!isLuauTable(value)) {
      throw new NotionToLuaError(
        `Expected a table literal for local "${name}" at offset ${this.previous().offset}.`,
      );
    }
    return { name, table: value };
  }

  private parseReturnIdentifier(): string {
    const name = this.expect("identifier").value as string;
    return name;
  }

  private moduleTableToRecords(table: LuauTable): LuauRecord[] {
    return Object.entries(table).map(([key, properties]) => {
      if (!isLuauTable(properties)) {
        throw new NotionToLuaError(
          `Record "${key}" must be a table of properties.`,
        );
      }

      return {
        key,
        keyFormat: resolveLuauKeyFormat(key),
        properties,
      };
    });
  }

  private parseTableValue(): LuauValue {
    this.expect("{");
    if (this.match("}")) {
      return {};
    }

    const firstEntry = this.parseTableEntry(false);
    if (firstEntry.kind === "array") {
      const items = [firstEntry.value as string];
      while (!this.match("}")) {
        this.expect(",");
        if (this.match("}")) {
          break;
        }
        const entry = this.parseTableEntry(true);
        if (entry.kind !== "array") {
          throw new NotionToLuaError(
            `Mixed keyed and unkeyed table entries at offset ${this.current().offset}.`,
          );
        }
        items.push(entry.value as string);
      }
      return items;
    }

    const table: LuauTable = {};
    this.applyKeyedEntry(table, firstEntry);
    while (!this.match("}")) {
      this.expect(",");
      if (this.match("}")) {
        break;
      }
      const entry = this.parseTableEntry(false);
      if (entry.kind === "array") {
        throw new NotionToLuaError(
          `Mixed keyed and unkeyed table entries at offset ${this.current().offset}.`,
        );
      }
      this.applyKeyedEntry(table, entry);
    }
    return table;
  }

  private applyKeyedEntry(
    table: LuauTable,
    entry: { kind: "keyed"; key: string; value: LuauValue },
  ): void {
    if (entry.key in table) {
      throw new NotionToLuaError(`Duplicate table key "${entry.key}".`);
    }
    table[entry.key] = entry.value;
  }

  private parseTableEntry(
    arrayMode: boolean,
  ):
    | { kind: "array"; value: string }
    | { kind: "keyed"; key: string; value: LuauValue } {
    if (arrayMode) {
      if (this.check("identifier") && this.tokens[this.index + 1]?.type === "=") {
        throw new NotionToLuaError(
          `Mixed keyed and unkeyed table entries at offset ${this.current().offset}.`,
        );
      }
      return { kind: "array", value: this.parseStringLiteral() };
    }

    if (this.match("string")) {
      return { kind: "array", value: this.previous().value as string };
    }

    if (this.match("[")) {
      this.expect("string");
      const key = this.previous().value as string;
      this.expect("]");
      this.expect("=");
      const value = this.parseValue();
      return { kind: "keyed", key, value };
    }

    const identifier = this.expect("identifier").value as string;
    if (this.match("=")) {
      const value = this.parseValue();
      return { kind: "keyed", key: identifier, value };
    }

    throw new NotionToLuaError(
      `Expected table entry at offset ${this.previous().offset}.`,
    );
  }

  private parseValue(): LuauValue {
    if (this.match("nil")) {
      return null;
    }
    if (this.match("true")) {
      return true;
    }
    if (this.match("false")) {
      return false;
    }
    if (this.match("number")) {
      return this.previous().value as number;
    }
    if (this.match("string")) {
      return this.previous().value as string;
    }
    if (this.match("{")) {
      this.index -= 1;
      return this.parseTableValue();
    }

    throw new NotionToLuaError(
      `Expected value at offset ${this.current().offset}.`,
    );
  }

  private parseStringLiteral(): string {
    return this.expect("string").value as string;
  }

  private match(type: TokenType): boolean {
    if (this.check(type)) {
      this.index += 1;
      return true;
    }
    return false;
  }

  private check(type: TokenType): boolean {
    return this.current().type === type;
  }

  private expect(type: TokenType): Token {
    if (!this.match(type)) {
      throw new NotionToLuaError(
        `Expected ${type} but found "${this.current().type}" at offset ${this.current().offset}.`,
      );
    }
    return this.previous();
  }

  private current(): Token {
    return this.tokens[this.index] ?? this.tokens[this.tokens.length - 1];
  }

  private previous(): Token {
    return this.tokens[this.index - 1];
  }

  private isAtEnd(): boolean {
    return this.current().type === "eof";
  }
}

export function parseLuauModule(source: string): ParsedModule {
  const tokens = lex(source);
  return new Parser(tokens).parseModule();
}
