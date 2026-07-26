import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import type { ChildProcess } from "node:child_process";
import { describe, it } from "node:test";

import { formatLuauCode } from "../src/stylua.js";

function createMockSpawn(
  behavior: "success" | "failure" | "error",
): typeof import("node:child_process").spawn {
  return () => {
    const child = new EventEmitter() as ChildProcess & {
      stdout: EventEmitter;
      stderr: EventEmitter;
      stdin: { end: (value: string) => void };
    };

    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.stdin = {
      end() {
        queueMicrotask(() => {
          if (behavior === "error") {
            child.emit("error", new Error("stylua not found"));
            return;
          }

          if (behavior === "success") {
            child.stdout.emit("data", "return {}\n");
            child.emit("close", 0);
            return;
          }

          child.stderr.emit("data", "parse error");
          child.emit("close", 1);
        });
      },
    };

    return child;
  };
}

describe("formatLuauCode", () => {
  it("returns original code when skip is true", async () => {
    const result = await formatLuauCode("return {}", { skip: true });
    assert.equal(result.code, "return {}");
    assert.equal(result.formatted, false);
    assert.equal(result.warning, undefined);
  });

  it("returns formatted code on success", async () => {
    const result = await formatLuauCode("return{}", {
      spawnFn: createMockSpawn("success"),
    });

    assert.equal(result.code, "return {}\n");
    assert.equal(result.formatted, true);
    assert.equal(result.warning, undefined);
  });

  it("returns warning and original code when stylua fails", async () => {
    const result = await formatLuauCode("return{}", {
      spawnFn: createMockSpawn("failure"),
    });

    assert.equal(result.code, "return{}");
    assert.equal(result.formatted, false);
    assert.match(result.warning ?? "", /Stylua/);
  });

  it("returns warning when stylua cannot be spawned", async () => {
    const result = await formatLuauCode("return{}", {
      spawnFn: createMockSpawn("error"),
    });

    assert.equal(result.code, "return{}");
    assert.equal(result.formatted, false);
    assert.match(result.warning ?? "", /stylua not found/);
  });
});
