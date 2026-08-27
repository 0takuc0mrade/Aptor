import type { RepositoryMetadata, ScanResult, ScannerRule } from "./types";
import { readRepositoryFiles } from "./parsers/files";
import { obfuscationRule } from "./rules/obfuscation";
import { networkRule } from "./rules/network";
import { packageLifecycleRule } from "./rules/package-lifecycle";
import { processExecutionRule } from "./rules/process-execution";
import { secretFilesystemRule } from "./rules/secret-filesystem";
import { uniqueFindings } from "./rules/shared";
import { buildAttackPaths, scoreFindings, severityTotals, verdictForScore } from "./scoring";

export const DEFAULT_RULES: ScannerRule[] = [
  packageLifecycleRule,
  processExecutionRule,
  secretFilesystemRule,
  networkRule,
  obfuscationRule,
];

export async function scanRepository(
  root: string,
  repository: RepositoryMetadata,
  rules = DEFAULT_RULES,
  options: {
    id?: string;
    startedAt?: string;
    onStage?: (stage: "mapping-package-scripts" | "scanning-sensitive-behaviour" | "building-risk-report") => void | Promise<void>;
  } = {},
): Promise<ScanResult> {
  const startedAt = options.startedAt ? new Date(options.startedAt) : new Date();
  await options.onStage?.("mapping-package-scripts");
  const files = await readRepositoryFiles(root);
  await options.onStage?.("scanning-sensitive-behaviour");
  const findings = uniqueFindings(rules.flatMap((rule) => rule.scan(files))).sort((a, b) => {
    const order = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
    return order[a.severity] - order[b.severity] || a.filePath.localeCompare(b.filePath) || (a.startLine ?? 0) - (b.startLine ?? 0);
  });
  await options.onStage?.("building-risk-report");
  const attackPaths = buildAttackPaths(findings);
  const overallScore = scoreFindings(findings, attackPaths);
  const id = options.id ?? crypto.randomUUID();

  return {
    id,
    repository,
    status: "completed",
    startedAt: startedAt.toISOString(),
    completedAt: new Date().toISOString(),
    filesScanned: files.length,
    rulesExecuted: rules.map((rule) => rule.id),
    findings,
    attackPaths,
    severityTotals: severityTotals(findings),
    overallScore,
    verdict: verdictForScore(overallScore),
  };
}
