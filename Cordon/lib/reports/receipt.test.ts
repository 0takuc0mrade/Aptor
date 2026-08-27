import assert from "node:assert/strict";
import test from "node:test";

import { createCanaries } from "../quarantine/canaries";
import { publicExecutionPlan } from "../quarantine/planner";
import type { CombinedReport, ExecutionPlan, QuarantineRunRecord } from "../quarantine/types";
import type { ScanResult } from "../scanner/types";
import { buildCopyableSummary, buildReportReceipt } from "./receipt";

test("report receipt and text summary omit internal identifiers, host paths, and canary values", () => {
  const scanId = crypto.randomUUID();
  const planId = crypto.randomUUID();
  const marker = createCanaries(planId)[0].marker;
  const scan: ScanResult = { id: scanId, repository: { owner: "owner", name: "repo", url: "https://github.com/owner/repo", defaultBranch: "main", commitHash: "a".repeat(40) }, status: "completed", startedAt: "2026-01-01T00:00:00.000Z", completedAt: "2026-01-01T00:00:01.000Z", filesScanned: 1, rulesExecuted: ["rule"], findings: [{ id: "finding-id", ruleId: "rule", title: "Sensitive access", description: "Observed fixture", severity: "high", category: "secret-access", filePath: "index.js", evidence: `/tmp/cordon-secret/repo ${marker}`, recommendation: "Remove access." }], attackPaths: [], severityTotals: { info: 0, low: 0, medium: 0, high: 1, critical: 0 }, overallScore: 10, verdict: "needs-review" };
  const plan: ExecutionPlan = { id: planId, scanId, repositoryPath: "/tmp/cordon-secret/repo", runtime: "node", mode: "probe", packageManager: "npm", command: ["node", "/cordon/probe.cjs"], timeoutMs: 5_000, memoryLimitMb: 256, cpuLimit: 0.5, processLimit: 32, outputLimitBytes: 64_000, networkPolicy: "disabled", allowedDomains: [], canaries: createCanaries(planId), lifecycleScripts: [], createdAt: scan.completedAt };
  const run: QuarantineRunRecord = { id: crypto.randomUUID(), scanId, planId, status: "completed", attempt: 1, stages: [], events: [], createdAt: scan.completedAt };
  const report: CombinedReport = { scanId, runId: run.id, staticFindings: scan.findings, runtimeFindings: [], attackPaths: [], runtimeEvents: [], executionPlan: publicExecutionPlan(plan), verdict: "needs-review", explanation: null, safetyNotice: "Limited observation." };
  const receipt = buildReportReceipt({ scan, plan: publicExecutionPlan(plan), run, report });
  const serialized = JSON.stringify(receipt);
  assert.equal(serialized.includes(scanId), false);
  assert.equal(serialized.includes(planId), false);
  assert.equal(serialized.includes(run.id), false);
  assert.equal(serialized.includes("/tmp/cordon-secret"), false);
  assert.equal(serialized.includes(marker), false);
  const summary = buildCopyableSummary({ scan, plan: publicExecutionPlan(plan), run, report });
  assert.match(summary, /owner\/repo/);
  assert.match(summary, /Recommended action:/);
});
