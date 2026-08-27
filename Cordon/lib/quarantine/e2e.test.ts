import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { buildReportReceipt } from "../reports/receipt";
import { scanRepository } from "../scanner";
import type { RepositoryMetadata } from "../scanner/types";
import { DockerQuarantineRunner, type DockerCommandExecutor } from "./adapters/docker";
import { createRecommendedExecutionPlan, publicExecutionPlan } from "./planner";
import type { CombinedReport, ExecutionPlan, QuarantineRunRecord, QuarantineResult } from "./types";
import { buildCombinedAttackPaths, runtimeVerdict } from "./verdict";

type DockerResult = Awaited<ReturnType<DockerCommandExecutor["run"]>>;

function commandResult(update: Partial<DockerResult> = {}): DockerResult {
  return { exitCode: 0, stdout: "", stderr: "", timedOut: false, outputTruncated: false, ...update };
}

function telemetry(event: Record<string, unknown>): string {
  return `CORDON_EVENT ${JSON.stringify({ timestamp: new Date().toISOString(), ...event })}\n`;
}

class ScenarioDocker implements DockerCommandExecutor {
  constructor(private readonly scenario: "normal" | "suspicious", private readonly plan: ExecutionPlan) {}

  async run(args: string[]): Promise<DockerResult> {
    if (args[0] === "version") return commandResult({ stdout: "27.0.0\n" });
    if (args[0] === "image") return commandResult({ stdout: "0.1.0\n" });
    if (args[0] === "inspect") return commandResult({ stdout: "0\n" });
    if (args[0] !== "start") return commandResult();
    if (this.scenario === "normal") {
      return commandResult({
        stdout: "Normal demonstration completed its local self-check.\n",
        stderr: telemetry({ type: "process-start", processId: 20, command: "node test.js", outcome: "observed", evidence: "Quarantine process started" }),
      });
    }
    const ssh = this.plan.canaries.find((canary) => canary.kind === "ssh-private-key")!;
    return commandResult({
      stderr: [
        telemetry({ type: "process-start", processId: 31, parentProcessId: 20, command: "node child.js", outcome: "observed", evidence: "Child process requested: node child.js" }),
        telemetry({ type: "canary-access", processId: 31, parentProcessId: 20, filePath: ssh.path, canaryId: ssh.id, outcome: "observed", evidence: "Read seeded Fake SSH private key" }),
        telemetry({ type: "network-attempt", processId: 31, parentProcessId: 20, destination: "receiver.example.invalid:443", outcome: "blocked", evidence: "HTTPS request attempted; quarantine policy=disabled" }),
      ].join(""),
    });
  }
}

async function runFixture(name: "normal" | "suspicious") {
  const root = path.join(process.cwd(), "test-fixtures", "runtime", name === "normal" ? "normal-demo" : "suspicious-demo");
  const repository: RepositoryMetadata = {
    owner: "cordon-demo",
    name: `${name}-repository`,
    url: `https://github.com/cordon-demo/${name}-repository`,
    defaultBranch: "main",
    commitHash: name === "normal" ? "a".repeat(40) : "b".repeat(40),
    source: "demo",
    demoKey: name,
  };
  const scan = await scanRepository(root, repository);
  const planned = await createRecommendedExecutionPlan({ scan, repositoryRoot: root, repositoryLocator: root });
  assert.ok(planned.plan);
  const plan = planned.plan;
  const result = await new DockerQuarantineRunner(new ScenarioDocker(name, plan)).run(plan);
  result.verdict = runtimeVerdict(scan.verdict, result.findings, result);
  const report: CombinedReport = {
    scanId: scan.id,
    runId: result.runId,
    staticFindings: scan.findings,
    runtimeFindings: result.findings,
    attackPaths: buildCombinedAttackPaths(scan, result),
    runtimeEvents: result.events,
    executionPlan: publicExecutionPlan(plan),
    verdict: result.verdict,
    explanation: null,
    safetyNotice: "A low-risk result is not proof that the repository is safe.",
  };
  const run: QuarantineRunRecord = {
    id: result.runId,
    scanId: scan.id,
    planId: plan.id,
    status: result.status,
    attempt: 1,
    stages: [],
    events: result.events,
    createdAt: result.startedAt,
    startedAt: result.startedAt,
    completedAt: result.completedAt,
    result,
  };
  return { scan, plan, result: result as QuarantineResult, report, receipt: buildReportReceipt({ scan, plan: publicExecutionPlan(plan), run, report }) };
}

test("suspicious demo runs the real scanner, automatic plan, Docker adapter, combined verdict, and receipt", async () => {
  const output = await runFixture("suspicious");
  assert.equal(output.plan.mode, "install");
  assert.ok(output.scan.findings.some((finding) => finding.category === "lifecycle-script"));
  assert.ok(output.scan.findings.some((finding) => finding.category === "process-execution"));
  assert.ok(output.report.runtimeFindings.some((finding) => finding.category === "runtime-canary" && finding.severity === "critical"));
  assert.ok(output.report.runtimeFindings.some((finding) => finding.category === "runtime-network" && finding.runtime?.outcome === "blocked"));
  assert.ok(output.report.attackPaths.some((attackPath) => attackPath.nodes?.some((node) => node.evidenceKind === "statically-detected") && attackPath.nodes?.some((node) => node.evidenceKind === "observed")));
  assert.equal(output.report.verdict, "critical-risk");
  assert.equal(output.receipt.finalVerdict, "critical-risk");
});

test("normal demo completes the same pipeline without false critical findings", async () => {
  const output = await runFixture("normal");
  assert.equal(output.plan.mode, "script");
  assert.equal(output.plan.selectedScript, "test");
  assert.equal(output.result.terminationReason, "completed");
  assert.equal(output.report.verdict, "low-risk");
  assert.equal(output.report.runtimeFindings.some((finding) => finding.severity === "critical"), false);
  assert.equal(output.receipt.finalVerdict, "low-risk");
});
