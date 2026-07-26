#!/usr/bin/env node

import { Client } from "@notionhq/client";
import { parseArgs } from "node:util";

import { createCodeBlockUpdater } from "./blocks.js";
import { loadEnvFile, requireNotionToken } from "./env.js";
import { toUserErrorMessage } from "./errors.js";
import { writeLuauFile } from "./file-output.js";
import { generateLuauCode } from "./generate.js";
import { getDataSourceTitle } from "./notion.js";
import { resolvePageId } from "./resolve-page.js";
import { formatLuauCode } from "./stylua.js";

loadEnvFile();

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    "database-id": { type: "string", short: "d" },
    "page-id": { type: "string", short: "p" },
    output: { type: "string", short: "o" },
    "no-format": { type: "boolean", default: false },
    help: { type: "boolean", short: "h", default: false },
  },
});

function printHelp(): void {
  console.log(`Usage:
  ntn-lua sync --database-id <id> [--page-id <id>] [--output <dir>] [--no-format]
  ntn-lua sync -d <id> [-p <id>] [-o <dir>] [--no-format]

Options:
  -d, --database-id   変換元の database_id または data_source_id
  -p, --page-id       Luau コードを書き込む Notion ページ ID（--output 指定時は無視）
  -o, --output        出力先ディレクトリ（指定時はファイル出力のみ）
      --no-format     Stylua によるフォーマットをスキップ
  -h, --help          ヘルプを表示`);
}

function writeWarning(message: string): void {
  process.stderr.write(`警告: ${message}\n`);
}

async function runSync(): Promise<number> {
  if (values.help) {
    printHelp();
    return 0;
  }

  const command = positionals[0];

  if (command !== "sync") {
    printHelp();
    return command ? 1 : 0;
  }

  const databaseId = values["database-id"]?.trim();

  if (!databaseId) {
    writeWarning("--database-id は必須です。");
    printHelp();
    return 1;
  }

  const pageId = values["page-id"]?.trim();
  const outputDir = values.output?.trim();
  const noFormat = values["no-format"] ?? false;

  if (outputDir && pageId) {
    writeWarning(
      "--output 指定時は --page-id は無視されます（Notion への書き込みは行いません）。",
    );
  }

  try {
    const notion = new Client({ auth: requireNotionToken() });
    const { luauCode, recordCount, dataSource } = await generateLuauCode(
      notion,
      databaseId,
    );

    const formatted = await formatLuauCode(luauCode, { skip: noFormat });

    if (formatted.warning) {
      writeWarning(formatted.warning);
    }

    const finalCode = formatted.code;

    if (outputDir) {
      const title = getDataSourceTitle(dataSource);
      const filePath = writeLuauFile(
        outputDir,
        title,
        finalCode,
        dataSource.id,
      );
      console.log(
        `${recordCount} 件のレコードを Luau に変換し、${filePath} に書き込みました。`,
      );
      return 0;
    }

    const resolvedPageId = await resolvePageId(notion, dataSource, pageId);
    const codeBlockUpdater = createCodeBlockUpdater(notion);
    const codeBlockAction = await codeBlockUpdater.sync(
      resolvedPageId,
      finalCode,
    );

    console.log(
      `${recordCount} 件のレコードを Luau に変換し、ページ ${resolvedPageId} のコードブロックを${codeBlockAction === "updated" ? "更新" : "作成"}しました。`,
    );
    return 0;
  } catch (error) {
    process.stderr.write(`${toUserErrorMessage(error)}\n`);
    return 1;
  }
}

const exitCode = await runSync();
process.exit(exitCode);
