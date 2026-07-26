import { spawn } from "node:child_process";

export type FormatLuauOptions = {
  skip?: boolean;
  spawnFn?: typeof spawn;
};

export type FormatLuauResult = {
  code: string;
  formatted: boolean;
  warning?: string;
};

export async function formatLuauCode(
  code: string,
  options: FormatLuauOptions = {},
): Promise<FormatLuauResult> {
  if (options.skip) {
    return { code, formatted: false };
  }

  const spawnFn = options.spawnFn ?? spawn;

  return new Promise((resolve) => {
    const child = spawnFn("stylua", ["-"], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk: Buffer | string) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk: Buffer | string) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      resolve({
        code,
        formatted: false,
        warning: `Stylua の実行に失敗しました: ${error.message}`,
      });
    });

    child.on("close", (exitCode) => {
      if (exitCode === 0 && stdout.length > 0) {
        resolve({ code: stdout, formatted: true });
        return;
      }

      const detail = stderr.trim() || `exit code ${exitCode ?? "unknown"}`;
      resolve({
        code,
        formatted: false,
        warning: `Stylua のフォーマットに失敗しました: ${detail}`,
      });
    });

    child.stdin.end(code);
  });
}
