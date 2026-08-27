import type { QuarantineRunRecord, RuntimeEvent, RuntimeStage, RuntimeStageId } from "./types";

export const RUNTIME_STAGE_LABELS: Record<RuntimeStageId, string> = {
  "creating-environment": "Creating isolated environment",
  "seeding-canaries": "Seeding detection canaries",
  "preparing-repository": "Preparing repository",
  "running-operation": "Running selected operation",
  "observing-activity": "Observing process and file activity",
  "stopping-environment": "Stopping environment",
  "building-report": "Building combined report",
};

const ORDER = Object.keys(RUNTIME_STAGE_LABELS) as RuntimeStageId[];

export function initialRuntimeStages(): RuntimeStage[] {
  return ORDER.map((id) => ({ id, label: RUNTIME_STAGE_LABELS[id], status: "pending" }));
}

export function advanceRuntimeStage(record: QuarantineRunRecord, stageId: RuntimeStageId, now = new Date().toISOString()): QuarantineRunRecord {
  const index = ORDER.indexOf(stageId);
  return {
    ...record,
    stage: stageId,
    stages: record.stages.map((stage, stageIndex) => {
      if (stageIndex < index && stage.status !== "failed") return { ...stage, status: "completed", completedAt: stage.completedAt ?? now };
      if (stageIndex === index) return { ...stage, status: "active", startedAt: stage.startedAt ?? now, completedAt: undefined };
      return stage;
    }),
  };
}

export function completeRuntimeStages(record: QuarantineRunRecord, now = new Date().toISOString()): QuarantineRunRecord {
  return { ...record, stages: record.stages.map((stage) => ({ ...stage, status: "completed", startedAt: stage.startedAt ?? now, completedAt: stage.completedAt ?? now })) };
}

export function failRuntimeStage(record: QuarantineRunRecord, now = new Date().toISOString()): QuarantineRunRecord {
  return { ...record, stages: record.stages.map((stage) => stage.id === record.stage ? { ...stage, status: "failed", completedAt: now } : stage) };
}

export function appendRuntimeEvent(record: QuarantineRunRecord, event: RuntimeEvent): QuarantineRunRecord {
  if (record.events.some((existing) => existing.id === event.id)) return record;
  return { ...record, events: [...record.events, event].slice(-200) };
}
