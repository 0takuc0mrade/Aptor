import type { AttackPath, Finding, Verdict } from "../scanner/types";

export type ExecutionMode = "install" | "script" | "probe";
export type PackageManager = "npm" | "pnpm" | "yarn";
export type NetworkPolicy = "disabled" | "allowlist";

export type CanaryKind =
  | "dotenv"
  | "ssh-private-key"
  | "npm-token"
  | "github-token"
  | "cloud-access-key"
  | "wallet-private-key"
  | "browser-session"
  | "api-key";

export type CanaryDefinition = {
  id: string;
  kind: CanaryKind;
  label: string;
  path: string;
  marker: string;
};

export type ExecutionPlan = {
  id: string;
  scanId: string;
  repositoryPath: string;
  runtime: "node";
  mode: ExecutionMode;
  packageManager: PackageManager;
  command: string[];
  timeoutMs: number;
  memoryLimitMb: number;
  cpuLimit: number;
  processLimit: number;
  outputLimitBytes: number;
  networkPolicy: NetworkPolicy;
  allowedDomains: string[];
  canaries: CanaryDefinition[];
  selectedScript?: string;
  lifecycleScripts: Array<{ name: string; command: string }>;
  createdAt: string;
};

export type PublicCanaryDefinition = Omit<CanaryDefinition, "marker">;

export type PublicExecutionPlan = Omit<ExecutionPlan, "repositoryPath" | "canaries"> & {
  canaries: PublicCanaryDefinition[];
};

export type RuntimeEventType =
  | "process-start"
  | "process-exit"
  | "file-read"
  | "file-write"
  | "sensitive-path-access"
  | "network-attempt"
  | "canary-access"
  | "canary-propagation"
  | "stdout"
  | "stderr"
  | "policy-violation";

export type RuntimeEvent = {
  id: string;
  timestamp: string;
  type: RuntimeEventType;
  processId?: number;
  parentProcessId?: number;
  command?: string;
  filePath?: string;
  destination?: string;
  canaryId?: string;
  outcome?: "allowed" | "blocked" | "observed" | "unknown";
  evidence: string;
};

export type TerminationReason = "completed" | "failed" | "timeout" | "output-limit" | "policy-refusal" | "engine-unavailable";
export type QuarantineRunStatus = "queued" | "running" | "completed" | "failed";
export type QuarantineVerdict = Verdict | "inconclusive";
export type RuntimeStageId = "creating-environment" | "seeding-canaries" | "preparing-repository" | "running-operation" | "observing-activity" | "stopping-environment" | "building-report";

export type RuntimeStage = {
  id: RuntimeStageId;
  label: string;
  status: "pending" | "active" | "completed" | "failed";
  startedAt?: string;
  completedAt?: string;
};

export type ContainerResultMetadata = {
  engine: "docker";
  image: string;
  imagePinned: boolean;
  startedAt?: string;
  completedAt?: string;
  exitCode: number | null;
  outputTruncated: boolean;
  cleanupCompleted: boolean;
};

export type QuarantineResult = {
  runId: string;
  scanId: string;
  planId: string;
  status: "completed" | "failed";
  startedAt: string;
  completedAt: string;
  terminationReason: TerminationReason;
  events: RuntimeEvent[];
  findings: Finding[];
  stdout: string;
  stderr: string;
  verdict: QuarantineVerdict;
  container: ContainerResultMetadata;
  limitations: string[];
};

export type QuarantineRunRecord = {
  id: string;
  scanId: string;
  planId: string;
  status: QuarantineRunStatus;
  attempt: number;
  stage?: RuntimeStageId;
  stages: RuntimeStage[];
  events: RuntimeEvent[];
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  result?: QuarantineResult;
};

export type CombinedReport = {
  scanId: string;
  runId: string;
  staticFindings: Finding[];
  runtimeFindings: Finding[];
  attackPaths: AttackPath[];
  runtimeEvents: RuntimeEvent[];
  executionPlan: PublicExecutionPlan;
  verdict: QuarantineVerdict;
  explanation: AIExplanation | null;
  safetyNotice: string;
};

export type AIExplanation = {
  riskSummary: string;
  importantObservedBehavior: string[];
  likelyIntent: { assessment: string; confidence: "low" | "medium" | "high" };
  attackPathExplanation: string;
  recommendedActions: string[];
  unansweredQuestions: string[];
};

export type DockerReadiness = {
  state: "ready" | "preparing" | "unavailable";
  available: boolean;
  version?: string;
  image: string;
  imageVerified: boolean;
  allowlistConfigured: boolean;
  retryable: boolean;
  message: string;
};

export type ExecutionOptions = {
  packageManager: PackageManager;
  scripts: string[];
  lifecycleScripts: Array<{ name: string; command: string }>;
  supportedModes: ExecutionMode[];
};

export interface QuarantineRunner {
  run(plan: ExecutionPlan, observer?: RuntimeObserver): Promise<QuarantineResult>;
}

export type RuntimeObserver = {
  onStage?(stage: RuntimeStageId): void | Promise<void>;
  onEvent?(event: RuntimeEvent): void | Promise<void>;
};

export interface QuarantineWorker {
  start(scanId: string, planId: string, options?: { retry?: boolean }): Promise<QuarantineRunRecord>;
}
