import assert from "node:assert/strict";
import test from "node:test";

import { claimQuarantineRun, getExecutionPlan, getQuarantineRun, saveExecutionPlan, updateQuarantineRun } from "../db/quarantine";
import { createCanaries } from "./canaries";
import type { ExecutionPlan } from "./types";

function plan(): ExecutionPlan {
  const id = crypto.randomUUID();
  return { id, scanId: crypto.randomUUID(), repositoryPath: `managed://scan/${crypto.randomUUID()}/commit`, runtime: "node", mode: "probe", packageManager: "npm", command: ["node", "/cordon/probe.cjs"], timeoutMs: 5_000, memoryLimitMb: 256, cpuLimit: 0.5, processLimit: 32, outputLimitBytes: 64_000, networkPolicy: "disabled", allowedDomains: [], canaries: createCanaries(id), lifecycleScripts: [], createdAt: new Date().toISOString() };
}

test("in-memory persistence stores plans and prevents duplicate runs", async () => {
  const executionPlan = plan();
  await saveExecutionPlan(executionPlan);
  assert.deepEqual(await getExecutionPlan(executionPlan.id), executionPlan);
  const first = await claimQuarantineRun(executionPlan.scanId, executionPlan.id);
  const second = await claimQuarantineRun(executionPlan.scanId, executionPlan.id);
  assert.equal(first.created, true);
  assert.equal(second.created, false);
  assert.equal(first.record.id, second.record.id);
  assert.deepEqual(await getQuarantineRun(first.record.id), first.record);
});

test("failed runs retry as separate attempts while active starts remain idempotent", async () => {
  const executionPlan = plan();
  await saveExecutionPlan(executionPlan);
  const first = await claimQuarantineRun(executionPlan.scanId, executionPlan.id);
  const duplicate = await claimQuarantineRun(executionPlan.scanId, executionPlan.id, { retry: true });
  assert.equal(duplicate.record.id, first.record.id);
  await updateQuarantineRun(first.record.id, { status: "failed", completedAt: new Date().toISOString(), error: "fixture failure" });
  const withoutIntent = await claimQuarantineRun(executionPlan.scanId, executionPlan.id);
  assert.equal(withoutIntent.record.id, first.record.id);
  const retry = await claimQuarantineRun(executionPlan.scanId, executionPlan.id, { retry: true });
  assert.equal(retry.created, true);
  assert.notEqual(retry.record.id, first.record.id);
  assert.equal(retry.record.attempt, 2);
});
