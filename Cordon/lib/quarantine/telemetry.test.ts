import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { createCanaries, redactCanaries, seedCanaryTree } from "./canaries";
import { explanationAvailability } from "./explanation";
import { parseTelemetryOutput } from "./telemetry";
import { buildCombinedAttackPaths, runtimeFindings } from "./verdict";
import type { QuarantineResult, RuntimeEvent } from "./types";
import type { Finding, ScanResult } from "../scanner/types";

test("canaries are unique, unmistakably fake, seeded, and redacted", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "cordon-canary-test-"));
  const canaries = createCanaries("test-run");
  try {
    assert.equal(new Set(canaries.map((canary) => canary.marker)).size, 8);
    assert.ok(canaries.every((canary) => canary.marker.includes("FAKE_CANARY") && canary.marker.endsWith("_INVALID")));
    await seedCanaryTree(root, canaries);
    const dotenv = canaries.find((canary) => canary.kind === "dotenv")!;
    const contents = await readFile(path.join(root, dotenv.path.replace(/^\/+/, "")), "utf8");
    assert.ok(contents.includes(dotenv.marker));
    assert.equal(redactCanaries(contents, canaries).includes(dotenv.marker), false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("runtime telemetry parser accepts bounded structured events and discards malformed records", () => {
  const timestamp = new Date().toISOString();
  const parsed = parseTelemetryOutput([
    `CORDON_EVENT ${JSON.stringify({ timestamp, type: "canary-access", canaryId: "fake", outcome: "observed", evidence: "read fake key" })}`,
    "CORDON_EVENT not-json",
    "ordinary stderr",
  ].join("\n"));
  assert.equal(parsed.events.length, 1);
  assert.equal(parsed.events[0].type, "canary-access");
  assert.match(parsed.stderr, /malformed telemetry|ordinary stderr/);
});

test("runtime events become evidence-backed findings without treating every process as critical", () => {
  const events: RuntimeEvent[] = [
    { id: "event-canary", timestamp: new Date().toISOString(), type: "canary-access", canaryId: "ssh", processId: 12, filePath: "/home/cordon/.ssh/id_ed25519", outcome: "observed", evidence: "Read seeded SSH private-key canary" },
    { id: "event-network", timestamp: new Date().toISOString(), type: "network-attempt", destination: "collector.example.invalid:443", processId: 12, outcome: "blocked", evidence: "Blocked by disabled network policy" },
    { id: "event-process", timestamp: new Date().toISOString(), type: "process-start", processId: 13, parentProcessId: 12, command: "git status", outcome: "observed", evidence: "Child process requested: git status" },
  ];
  const findings = runtimeFindings(events);
  assert.ok(findings.some((finding) => finding.category === "runtime-canary" && finding.severity === "critical"));
  assert.ok(findings.some((finding) => finding.category === "runtime-network" && finding.runtime?.outcome === "blocked"));
  assert.equal(findings.find((finding) => finding.category === "runtime-process")?.severity, "medium");
});

test("static and runtime evidence correlate into a labeled combined attack path", () => {
  const lifecycle: Finding = { id: "static-lifecycle", ruleId: "package-lifecycle", title: "postinstall runs automatically", description: "Lifecycle hook", severity: "high", category: "lifecycle-script", filePath: "package.json", startLine: 4, recommendation: "Review it." };
  const scan: ScanResult = { id: crypto.randomUUID(), repository: { owner: "cordon", name: "fixture", url: "https://github.com/cordon/fixture", defaultBranch: "main", commitHash: "a".repeat(40) }, status: "completed", startedAt: new Date().toISOString(), completedAt: new Date().toISOString(), filesScanned: 2, rulesExecuted: ["package-lifecycle"], findings: [lifecycle], attackPaths: [], severityTotals: { info: 0, low: 0, medium: 0, high: 1, critical: 0 }, overallScore: 10, verdict: "needs-review" };
  const events: RuntimeEvent[] = [
    { id: "canary", timestamp: new Date().toISOString(), type: "canary-access", canaryId: "dotenv", processId: 7, filePath: "/workspace/repository/.env", outcome: "observed", evidence: "Read seeded dotenv canary" },
    { id: "network", timestamp: new Date().toISOString(), type: "network-attempt", processId: 7, destination: "collector.example.invalid:443", outcome: "blocked", evidence: "Blocked request" },
  ];
  const findings = runtimeFindings(events);
  const result = { findings, events } as QuarantineResult;
  const paths = buildCombinedAttackPaths(scan, result);
  const pathResult = paths.find((candidate) => candidate.nodes?.length);
  assert.ok(pathResult);
  assert.deepEqual(pathResult.nodes?.map((node) => node.evidenceKind), ["statically-detected", "observed", "observed"]);
  assert.ok(pathResult.edges?.every((edge) => edge.evidenceKind === "correlated"));
});

test("OpenAI explanation stays unavailable without a key", () => {
  assert.deepEqual(explanationAvailability({} as NodeJS.ProcessEnv), {
    configured: false,
    message: "AI explanation is not configured. Deterministic findings and attack paths remain fully available.",
  });
});
