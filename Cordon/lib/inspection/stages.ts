import { INSPECTION_STAGE_IDS, type InspectionRecord, type InspectionStage, type InspectionStageId } from "./types";

export const INSPECTION_STAGE_LABELS: Record<InspectionStageId, string> = {
  "fetching-repository": "Fetching repository",
  "checking-archive-safety": "Checking archive safety",
  "mapping-package-scripts": "Mapping package scripts",
  "scanning-sensitive-behaviour": "Scanning sensitive behaviour",
  "building-risk-report": "Building the risk report",
  "preparing-quarantine-options": "Preparing quarantine options",
};

export function initialInspectionStages(): InspectionStage[] {
  return INSPECTION_STAGE_IDS.map((id) => ({ id, label: INSPECTION_STAGE_LABELS[id], status: "pending" }));
}

export function advanceInspectionStage(record: InspectionRecord, stageId: InspectionStageId, now = new Date().toISOString()): InspectionRecord {
  const targetIndex = INSPECTION_STAGE_IDS.indexOf(stageId);
  return {
    ...record,
    status: "running",
    currentStage: stageId,
    startedAt: record.startedAt ?? now,
    updatedAt: now,
    error: undefined,
    stages: record.stages.map((stage, index) => {
      if (index < targetIndex && stage.status !== "failed") return { ...stage, status: "completed", completedAt: stage.completedAt ?? now };
      if (index === targetIndex) return { ...stage, status: "active", startedAt: stage.startedAt ?? now, completedAt: undefined, error: undefined };
      return stage;
    }),
  };
}

export function completeInspectionStages(record: InspectionRecord, now = new Date().toISOString()): InspectionRecord {
  return {
    ...record,
    status: "completed",
    completedAt: now,
    updatedAt: now,
    error: undefined,
    stages: record.stages.map((stage) => ({ ...stage, status: "completed", startedAt: stage.startedAt ?? now, completedAt: stage.completedAt ?? now, error: undefined })),
  };
}

export function failInspectionStage(record: InspectionRecord, failure: InspectionRecord["error"], now = new Date().toISOString()): InspectionRecord {
  return {
    ...record,
    status: "failed",
    completedAt: now,
    updatedAt: now,
    error: failure,
    stages: record.stages.map((stage) => stage.id === record.currentStage ? { ...stage, status: "failed", completedAt: now, error: failure?.message } : stage),
  };
}
