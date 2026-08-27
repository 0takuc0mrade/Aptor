import { createHash } from "node:crypto";

import type { AttackPath, Finding, Severity, SeverityTotals, Verdict } from "../types";

export const SEVERITY_POINTS: Record<Severity, number> = {
  info: 0,
  low: 1,
  medium: 4,
  high: 10,
  critical: 25,
};

function pathId(findingIds: string[]): string {
  return createHash("sha256").update(findingIds.sort().join(":"), "utf8").digest("hex").slice(0, 14);
}

export function buildAttackPaths(findings: Finding[]): AttackPath[] {
  const byFile = new Map<string, Finding[]>();
  for (const finding of findings) {
    const group = byFile.get(finding.filePath) ?? [];
    group.push(finding);
    byFile.set(finding.filePath, group);
  }

  const paths: AttackPath[] = [];
  for (const [filePath, group] of byFile) {
    const categories = new Set(group.map((finding) => finding.category));
    const hasSecret = categories.has("secret-access") || categories.has("filesystem-access");
    const hasNetwork = categories.has("network-access");
    const hasExecution = categories.has("process-execution") || categories.has("lifecycle-script");

    if (hasSecret && hasNetwork) {
      const members = group.filter((finding) =>
        ["secret-access", "filesystem-access", "network-access", "process-execution", "lifecycle-script"].includes(finding.category),
      );
      const critical = hasExecution || members.some((finding) => finding.severity === "critical");
      paths.push({
        id: pathId(members.map((finding) => finding.id)),
        title: hasExecution ? "Local data can reach an outbound execution path" : "Local data can reach an outbound request",
        description: `Cordon found related local-data access and network behavior in ${filePath}. Static proximity does not prove exfiltration, but the combined path deserves review before execution.`,
        severity: critical ? "critical" : "high",
        findingIds: members.map((finding) => finding.id),
        steps: [
          hasExecution ? "Code is invoked through a script or process API" : "Executable code runs",
          "Local files or environment values are accessed",
          "An outbound network destination or request is present",
        ],
        scoreBonus: critical ? 15 : 8,
      });
    }

    if (categories.has("lifecycle-script") && categories.has("process-execution") && categories.has("network-access")) {
      const members = group.filter((finding) =>
        ["lifecycle-script", "process-execution", "network-access"].includes(finding.category),
      );
      paths.push({
        id: pathId(members.map((finding) => finding.id)),
        title: "Install-time network execution chain",
        description: `The package lifecycle in ${filePath} combines automatic execution, shell/process behavior, and network access. This chain can run before normal application startup.`,
        severity: "critical",
        findingIds: members.map((finding) => finding.id),
        steps: ["Package lifecycle hook runs", "A shell command or child process starts", "A remote destination is contacted"],
        scoreBonus: 15,
      });
    }
  }

  return [...new Map(paths.map((path) => [path.id, path])).values()];
}

export function severityTotals(findings: Finding[]): SeverityTotals {
  const totals: SeverityTotals = { info: 0, low: 0, medium: 0, high: 0, critical: 0 };
  for (const finding of findings) totals[finding.severity] += 1;
  return totals;
}

export function scoreFindings(findings: Finding[], attackPaths = buildAttackPaths(findings)): number {
  return findings.reduce((total, finding) => total + SEVERITY_POINTS[finding.severity], 0) +
    attackPaths.reduce((total, path) => total + path.scoreBonus, 0);
}

export function verdictForScore(score: number): Verdict {
  if (score >= 25) return "critical-risk";
  if (score >= 15) return "high-risk";
  if (score >= 4) return "needs-review";
  return "low-risk";
}
