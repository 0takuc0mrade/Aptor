import assert from "node:assert/strict";
import test from "node:test";

import { DockerRuntimeBootstrap } from "./bootstrap";
import type { DockerCommandExecutor, DockerCommandResult } from "./docker-cli";

function result(update: Partial<DockerCommandResult> = {}): DockerCommandResult {
  return { exitCode: 0, stdout: "", stderr: "", timedOut: false, outputTruncated: false, ...update };
}

test("runtime readiness requires the exact Cordon image label", async () => {
  const valid: DockerCommandExecutor = { run: async (args) => args[0] === "version" ? result({ stdout: "29.1.3\n" }) : result({ stdout: "0.1.0\n" }) };
  const ready = await new DockerRuntimeBootstrap(valid).inspect();
  assert.equal(ready.state, "ready");
  assert.equal(ready.imageVerified, true);

  const wrong: DockerCommandExecutor = { run: async (args) => args[0] === "version" ? result({ stdout: "29.1.3\n" }) : result({ stdout: "different\n" }) };
  const unavailable = await new DockerRuntimeBootstrap(wrong).inspect();
  assert.equal(unavailable.state, "unavailable");
  assert.equal(unavailable.imageVerified, false);
});

test("runtime bootstrap builds a missing image once and verifies it", async () => {
  let built = false;
  const calls: string[][] = [];
  const executor: DockerCommandExecutor = {
    run: async (args) => {
      calls.push(args);
      if (args[0] === "version") return result({ stdout: "29.1.3\n" });
      if (args[0] === "build") { built = true; return result(); }
      return built ? result({ stdout: "0.1.0\n" }) : result({ exitCode: 1, stderr: "image missing" });
    },
  };
  const ready = await new DockerRuntimeBootstrap(executor).build();
  assert.equal(ready.available, true);
  assert.equal(calls.filter((args) => args[0] === "build").length, 1);
});
