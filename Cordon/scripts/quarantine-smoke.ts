import path from "node:path";

import { DockerQuarantineRunner } from "../lib/quarantine/adapters/docker";
import { createExecutionPlan } from "../lib/quarantine/planner";
import type { ExecutionMode } from "../lib/quarantine/types";

const fixtures: Record<string, { directory: string; mode: ExecutionMode; scriptName?: string }> = {
  normal: { directory: "normal-install", mode: "install" },
  suspicious: { directory: "suspicious-demo", mode: "install" },
  timeout: { directory: "timeout", mode: "script", scriptName: "wait-forever" },
  network: { directory: "blocked-network", mode: "install" },
};

async function main() {
  const target = process.argv[2] ?? "normal";
  const fixture = fixtures[target];
  if (!fixture) throw new Error("Use one of: normal, suspicious, timeout, network.");

  const repositoryRoot = path.resolve(process.cwd(), "test-fixtures", "runtime", fixture.directory);
  const scanId = crypto.randomUUID();
  const plan = await createExecutionPlan({ scanId, repositoryRoot, repositoryLocator: `managed://scan/${scanId}/${"a".repeat(40)}`, mode: fixture.mode, scriptName: fixture.scriptName, networkPolicy: "disabled" });
  if (target === "timeout") plan.timeoutMs = 2_000;
  const runner = new DockerQuarantineRunner();
  const readiness = await runner.readiness();
  if (!readiness.available) {
    process.stderr.write(`${readiness.message}\n`);
    process.exitCode = 2;
  } else {
    const result = await runner.run({ ...plan, repositoryPath: repositoryRoot });
    const summary = {
      fixture: target,
      status: result.status,
      terminationReason: result.terminationReason,
      cleanupCompleted: result.container.cleanupCompleted,
      outputTruncated: result.container.outputTruncated,
      eventTypes: [...new Set(result.events.map((event) => event.type))],
      findingCategories: [...new Set(result.findings.map((finding) => finding.category))],
    };
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
    const expected = target === "timeout"
      ? result.terminationReason === "timeout"
      : target === "normal"
        ? result.terminationReason === "completed"
        : result.events.some((event) => event.type === "network-attempt" && event.outcome === "blocked");
    if (!expected || !result.container.cleanupCompleted) process.exitCode = 1;
  }
}

void main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : "Quarantine smoke test failed."}\n`);
  process.exitCode = 1;
});
