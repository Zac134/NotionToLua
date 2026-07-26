#!/usr/bin/env node

import { Client } from "@notionhq/client";
import { parseArgs } from "node:util";

import { createCodeBlockUpdater } from "./blocks.js";
import { loadEnvFile, requireNotionToken, resolveDatabaseId, resolveOutputDir } from "./env.js";
import { toUserErrorMessage } from "./errors.js";
import {
  resolveOutputTarget,
  writeLuauFile,
  writeLuauToPath,
} from "./file-output.js";
import { generateLuauCode } from "./generate.js";
import { resolveModuleName } from "./module-name.js";
import { getDataSourceTitle, resolveDataSource } from "./notion.js";
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
  ntn-lua [-d <id>] [<database-id>] [-p <page-id>] [-o <dir-or-file>] [--no-format]

Examples:
  ntn-lua -d <id> -o ./output
  ntn-lua -d <id> -o ./output/testModule.luau
  ntn-lua                          (NOTION_DATABASE_ID / NOTION_OUTPUT_DIR in .env)

Options:
  -d, --database-id   変換元の database_id または data_source_id
  -p, --page-id       Luau コードを書き込む Notion ページ ID（ファイル出力時は無視）
  -o, --output        出力先ディレクトリまたは .lua / .luau ファイルパス
      --no-format     Stylua によるフォーマットをスキップ
  -h, --help          ヘルプを表示

Environment:
  NOTION_API_TOKEN     必須。Notion Integration の API トークン
  NOTION_DATABASE_ID   任意。-d / 位置引数未指定時のデフォルト DB ID
  NOTION_OUTPUT_DIR    任意。-o 未指定時のデフォルト出力先（ディレクトリまたはファイル）`);
}

function writeWarning(message: string): void {
  process.stderr.write(`警告: ${message}\n`);
}

async function run(): Promise<number> {
  if (values.help) {
    printHelp();
    return 0;
  }

  const databaseId = resolveDatabaseId({
    flag: values["database-id"],
    positional: positionals[0],
  });

  if (!databaseId) {
    writeWarning(
      "database ID が指定されていません。-d、位置引数、または NOTION_DATABASE_ID を設定してください。",
    );
    printHelp();
    return 1;
  }

  const pageId = values["page-id"]?.trim();
  const outputPath = resolveOutputDir({ flag: values.output });
  const noFormat = values["no-format"] ?? false;

  if (outputPath && pageId) {
    writeWarning(
      "ファイル出力時は --page-id は無視されます（Notion への書き込みは行いません）。",
    );
  }

  try {
    const notion = new Client({ auth: requireNotionToken() });
    const dataSource = await resolveDataSource(notion, databaseId);
    const title = getDataSourceTitle(dataSource);
    const outputTarget = outputPath
      ? resolveOutputTarget(outputPath, {
          defaultTitle: title,
          fallbackId: dataSource.id,
        })
      : null;
    const moduleName =
      outputTarget?.kind === "file"
        ? outputTarget.moduleName
        : resolveModuleName(title, dataSource.id);

    const { luauCode, recordCount } = await generateLuauCode(notion, databaseId, {
      moduleName,
    });

    const formatted = await formatLuauCode(luauCode, { skip: noFormat });

    if (formatted.warning) {
      writeWarning(formatted.warning);
    }

    const finalCode = formatted.code;

    if (outputTarget) {
      const filePath =
        outputTarget.kind === "file"
          ? writeLuauToPath(outputTarget.filePath, finalCode)
          : writeLuauFile(
              outputTarget.directory,
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

const exitCode = await run();
process.exit(exitCode);
