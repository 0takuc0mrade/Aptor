import type { PublicExecutionPlan, QuarantineRunRecord, QuarantineVerdict } from "../quarantine/types";
import type { ScanResult, Verdict } from "../scanner/types";

export const INSPECTION_STAGE_IDS = [
  "fetching-repository",
  "checking-archive-safety",
  "mapping-package-scripts",
  "scanning-sensitive-behaviour",
  "building-risk-report",
  "preparing-quarantine-options",
] as const;

export type InspectionStageId = (typeof INSPECTION_STAGE_IDS)[number];
export type InspectionStatus = "queued" | "running" | "completed" | "failed";
export type InspectionStageStatus = "pending" | "active" | "completed" | "failed";

export type InspectionStage = {
  id: InspectionStageId;
  label: string;
  status: InspectionStageStatus;
  startedAt?: string;
  completedAt?: string;
  error?: string;
};

export type InspectionFailure = {
  title: string;
  message: string;
  retryable: boolean;
  staticAvailable: boolean;
  retryStartsNewContainer: boolean;
};

export type ExecutionRecommendation = {
  planId?: string;
  supported: boolean;
  action: "quarantine" | "manual-review";
  title: string;
  rationale: string;
  confirmation: string[];
  plan?: PublicExecutionPlan;
};

export type InspectionRecord = {
  id: string;
  submissionKey: string;
  repositoryUrl: string;
  owner: string;
  name: string;
  source: "github" | "demo";
  demoKey?: "normal" | "suspicious";
  status: InspectionStatus;
  currentStage: InspectionStageId;
  stages: InspectionStage[];
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
  error?: InspectionFailure;
  scan?: ScanResult;
  recommendation?: ExecutionRecommendation;
  latestRun?: QuarantineRunRecord | null;
};

export type ScanHistoryItem = {
  id: string;
  repositoryUrl: string;
  owner: string;
  name: string;
  source: "github" | "demo";
  commitHash?: string;
  stage: InspectionStageId;
  status: InspectionStatus;
  staticVerdict?: Verdict;
  runtimeVerdict?: QuarantineVerdict;
  runtimeStatus?: QuarantineRunRecord["status"];
  completedAt?: string;
  updatedAt: string;
};
