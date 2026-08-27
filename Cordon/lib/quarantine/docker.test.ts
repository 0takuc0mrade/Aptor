import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { DockerQuarantineRunner, type DockerCommandExecutor } from "./adapters/docker";
import { createCanaries } from "./canaries";
import type { ExecutionPlan } from "./types";

type FakeResult = Awaited<ReturnType<DockerCommandExecutor["run"]>>;

function commandResult(update: Partial<FakeResult> = {}): FakeResult {
  return { exitCode: 0, stdout: "", stderr: "", timedOut: false, outputTruncated: false, ...update };
}

class FakeDocker implements DockerCommandExecutor {
  calls: string[][] = [];
  constructor(private readonly startResult: FakeResult, private readonly createResult = commandResult()) {}
  async run(args: string[]): Promise<FakeResult> {
    this.calls.push(args);
    if (args[0] === "version") return commandResult({ stdout: "27.0.0\n" });
    if (args[0] === "image") return commandResult({ stdout: "0.1.0\n" });
    if (args[0] === "create") return this.createResult;
    if (args[0] === "start") return this.startResult;
    return commandResult();
  }
}

async function runnerPlan(): Promise<{ root: string; plan: ExecutionPlan }> {
  const root = await mkdtemp(path.join(tmpdir(), "cordon-docker-test-"));
  await writeFile(path.join(root, "package.json"), JSON.stringify({ name: "fixture", scripts: {} }));
  const id = crypto.randomUUID();
  return {
    root,
    plan: {
      id,
      scanId: crypto.randomUUID(),
      repositoryPath: root,
      runtime: "node",
      mode: "probe",
      packageManager: "npm",
      command: ["node", "/cordon/probe.cjs"],
      timeoutMs: 5_000,
      memoryLimitMb: 256,
      cpuLimit: 0.5,
      processLimit: 32,
      outputLimitBytes: 64_000,
      networkPolicy: "disabled",
      allowedDomains: [],
      canaries: createCanaries(id),
      lifecycleScripts: [],
      createdAt: new Date().toISOString(),
    },
  };
}

test("Docker adapter removes its container after success", async () => {
  const fixture = await runnerPlan();
  const telemetry = `CORDON_EVENT ${JSON.stringify({ timestamp: new Date().toISOString(), type: "process-exit", outcome: "observed", evidence: "Process exited with code 0" })}\n`;
  const docker = new FakeDocker(commandResult({ stdout: "probe ok\n", stderr: telemetry }));
  try {
    const result = await new DockerQuarantineRunner(docker).run(fixture.plan);
    assert.equal(result.terminationReason, "completed");
    assert.equal(result.container.cleanupCompleted, true);
    assert.ok(docker.calls.some((args) => args[0] === "rm" && args[1] === "--force"));
  } finally { await rm(fixture.root, { recursive: true, force: true }); }
});

test("Docker adapter removes its container after command failure", async () => {
  const fixture = await runnerPlan();
  const docker = new FakeDocker(commandResult({ exitCode: 2, stderr: "fixture failed" }));
  try {
    const result = await new DockerQuarantineRunner(docker).run(fixture.plan);
    assert.equal(result.terminationReason, "failed");
    assert.equal(result.container.cleanupCompleted, true);
    assert.ok(docker.calls.some((args) => args[0] === "rm"));
  } finally { await rm(fixture.root, { recursive: true, force: true }); }
});

test("Docker adapter records timeout, kills, and cleans up", async () => {
  const fixture = await runnerPlan();
  const docker = new FakeDocker(commandResult({ exitCode: null, timedOut: true }));
  try {
    const result = await new DockerQuarantineRunner(docker).run(fixture.plan);
    assert.equal(result.terminationReason, "timeout");
    assert.ok(result.findings.some((finding) => finding.ruleId === "runtime-timeout"));
    assert.ok(docker.calls.some((args) => args[0] === "rm"));
  } finally { await rm(fixture.root, { recursive: true, force: true }); }
});

test("Docker adapter records bounded output truncation", async () => {
  const fixture = await runnerPlan();
  const docker = new FakeDocker(commandResult({ exitCode: null, stdout: "bounded", outputTruncated: true }));
  try {
    const result = await new DockerQuarantineRunner(docker).run(fixture.plan);
    assert.equal(result.terminationReason, "output-limit");
    assert.equal(result.container.outputTruncated, true);
    assert.ok(result.findings.some((finding) => finding.ruleId === "runtime-output-limit"));
  } finally { await rm(fixture.root, { recursive: true, force: true }); }
});

test("Docker-unavailable behavior is inconclusive and still cleans temporary storage", async () => {
  const fixture = await runnerPlan();
  const unavailable: DockerCommandExecutor = { run: async () => { const error = new Error("spawn docker ENOENT") as NodeJS.ErrnoException; error.code = "ENOENT"; throw error; } };
  try {
    const result = await new DockerQuarantineRunner(unavailable).run(fixture.plan);
    assert.equal(result.terminationReason, "engine-unavailable");
    assert.equal(result.container.cleanupCompleted, true);
  } finally { await rm(fixture.root, { recursive: true, force: true }); }
});
