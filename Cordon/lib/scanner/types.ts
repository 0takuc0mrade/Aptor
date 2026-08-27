export type Severity = "info" | "low" | "medium" | "high" | "critical";

export type FindingCategory =
  | "lifecycle-script"
  | "process-execution"
  | "filesystem-access"
  | "secret-access"
  | "network-access"
  | "obfuscation"
  | "dependency-risk"
  | "runtime-process"
  | "runtime-filesystem"
  | "runtime-network"
  | "runtime-canary"
  | "sandbox-violation";

export type RuntimeFindingEvidence = {
  processId?: number;
  command?: string;
  filePath?: string;
  destination?: string;
  outcome?: "allowed" | "blocked" | "observed" | "unknown";
  eventIds: string[];
};

export type Finding = {
  id: string;
  ruleId: string;
  title: string;
  description: string;
  severity: Severity;
  category: FindingCategory;
  filePath: string;
  startLine?: number;
  endLine?: number;
  evidence?: string;
  recommendation: string;
  runtime?: RuntimeFindingEvidence;
};

export type AttackPathEvidenceKind = "observed" | "statically-detected" | "correlated" | "inferred";

export type AttackPathNode = {
  id: string;
  label: string;
  evidenceKind: AttackPathEvidenceKind;
  findingId?: string;
  runtimeEventId?: string;
  filePath?: string;
  line?: number;
  processId?: number;
  policyDecision?: string;
};

export type AttackPathEdge = {
  id: string;
  source: string;
  target: string;
  evidenceKind: AttackPathEvidenceKind;
  label: string;
};

export type AttackPath = {
  id: string;
  title: string;
  description: string;
  severity: "high" | "critical";
  findingIds: string[];
  steps: string[];
  scoreBonus: number;
  nodes?: AttackPathNode[];
  edges?: AttackPathEdge[];
};

export type RepositoryMetadata = {
  owner: string;
  name: string;
  url: string;
  defaultBranch: string;
  commitHash: string;
  source?: "github" | "demo";
  demoKey?: "normal" | "suspicious";
};

export type ScanStatus = "queued" | "downloading" | "scanning" | "completed" | "failed";
export type Verdict = "low-risk" | "needs-review" | "high-risk" | "critical-risk";

export type SeverityTotals = Record<Severity, number>;

export type ScanResult = {
  id: string;
  repository: RepositoryMetadata;
  status: ScanStatus;
  startedAt: string;
  completedAt: string;
  filesScanned: number;
  rulesExecuted: string[];
  findings: Finding[];
  attackPaths: AttackPath[];
  severityTotals: SeverityTotals;
  overallScore: number;
  verdict: Verdict;
};

export type SourceFile = {
  path: string;
  content: string;
  size: number;
};

export type ScannerRule = {
  id: string;
  scan(files: SourceFile[]): Finding[];
};
