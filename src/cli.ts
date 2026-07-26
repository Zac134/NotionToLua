#!/usr/bin/env node

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
import { createNotionClient } from "./notion-client.js";
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
  -d, --database-id   Source database_id or data_source_id
  -p, --page-id       Notion page ID to write the Luau code block to (ignored in file output mode)
  -o, --output        Output directory or .lua / .luau file path
      --no-format     Skip Stylua formatting
  -h, --help          Show help

Environment:
  NOTION_API_TOKEN     Required. Notion integration internal secret
  NOTION_DATABASE_ID   Optional. Default DB ID when -d / positional arg is omitted
  NOTION_OUTPUT_DIR    Optional. Default output path when -o is omitted (directory or file)`);
}

function writeWarning(message: string): void {
  process.stderr.write(`Warning: ${message}\n`);
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
      "No database ID was provided. Use -d, a positional argument, or set NOTION_DATABASE_ID.",
    );
    printHelp();
    return 1;
  }

  const pageId = values["page-id"]?.trim();
  const outputPath = resolveOutputDir({ flag: values.output });
  const noFormat = values["no-format"] ?? false;

  if (outputPath && pageId) {
    writeWarning(
      "--page-id is ignored in file output mode (nothing is written to Notion).",
    );
  }

  try {
    const notion = createNotionClient(requireNotionToken());
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
      dataSource,
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
        `Converted ${recordCount} record(s) to Luau and wrote ${filePath}.`,
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
      `Converted ${recordCount} record(s) to Luau and ${codeBlockAction === "updated" ? "updated" : "created"} the code block on page ${resolvedPageId}.`,
    );
    return 0;
  } catch (error) {
    process.stderr.write(`${toUserErrorMessage(error)}\n`);
    return 1;
  }
}

const exitCode = await run();
process.exit(exitCode);
