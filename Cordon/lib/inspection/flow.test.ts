import assert from "node:assert/strict";
import test from "node:test";

import { clearInspectionMemoryForTests, createInspection, getInspection, resetDemoInspections } from "../db/inspections";
import { getLatestExecutionPlan } from "../db/quarantine";
import { DirectInspectionWorker } from "./worker";
import { initialInspectionStages } from "./stages";
import type { InspectionRecord } from "./types";

function demoRecord(key: "normal" | "suspicious", submissionKey = crypto.randomUUID()): InspectionRecord {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(), submissionKey, repositoryUrl: `https://github.com/cordon-demo/${key}-repository`, owner: "cordon-demo", name: `${key}-repository`, source: "demo", demoKey: key,
    status: "queued", currentStage: "fetching-repository", stages: initialInspectionStages(), createdAt: now, updatedAt: now,
  };
}

test("submission identity is idempotent and the real backend stages survive restoration", async () => {
  clearInspectionMemoryForTests();
  const record = demoRecord("normal");
  const first = await createInspection(record);
  const duplicate = await createInspection({ ...record, id: crypto.randomUUID() });
  assert.equal(first.created, true);
  assert.equal(duplicate.created, false);
  assert.equal(duplicate.record.id, record.id);

  const completed = await new DirectInspectionWorker().runNow(record);
  assert.equal(completed.status, "completed");
  assert.ok(completed.scan);
  assert.ok(completed.stages.every((stage) => stage.status === "completed" && stage.startedAt && stage.completedAt));
  assert.equal((await getInspection(record.id))?.scan?.id, record.id);
  assert.ok(await getLatestExecutionPlan(record.id));
  assert.ok(completed.recommendation?.confirmation.some((line) => /fake credentials/i.test(line)));
});

test("suspicious demonstration uses real scanner output and automatic lifecycle planning", async () => {
  clearInspectionMemoryForTests();
  const record = demoRecord("suspicious");
  await createInspection(record);
  const completed = await new DirectInspectionWorker().runNow(record);
  assert.equal(completed.status, "completed");
  assert.ok(completed.scan?.findings.some((finding) => finding.category === "lifecycle-script"));
  assert.ok(completed.scan?.findings.some((finding) => finding.category === "process-execution"));
  assert.ok(completed.scan?.findings.some((finding) => finding.category === "network-access"));
  assert.equal(completed.recommendation?.plan?.mode, "install");
  assert.equal(completed.recommendation?.supported, true);
});

test("submission-mode reset removes demonstration state without changing controls", async () => {
  clearInspectionMemoryForTests();
  const record = demoRecord("normal");
  await createInspection(record);
  assert.equal(await resetDemoInspections(), 1);
  assert.equal(await getInspection(record.id), null);
});
