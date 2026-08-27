import type { CombinedReport, QuarantineVerdict } from "../quarantine/types";
import type { Finding, ScanResult, Verdict } from "../scanner/types";

export type SecurityDecision = {
  verdict: Verdict | QuarantineVerdict;
  title: string;
  summary: string;
  action: string;
};

function mostImportant(findings: Finding[]): Finding | undefined {
  const order = { critical: 5, high: 4, medium: 3, low: 2, info: 1 };
  return [...findings].sort((a, b) => order[b.severity] - order[a.severity])[0];
}

export function staticDecision(scan: ScanResult): SecurityDecision {
  const important = mostImportant(scan.findings);
  if (scan.verdict === "critical-risk") return {
    verdict: scan.verdict,
    title: "Critical static risk",
    summary: important ? `Cordon found ${important.title.toLowerCase()} in ${important.filePath}. Static evidence cannot confirm what the code would do when executed.` : "Cordon found a critical static attack path that requires manual review before execution.",
    action: "Do not run this repository locally. Use quarantine to test the identified execution path, then ask the repository owner to explain the named files and scripts.",
  };
  if (scan.verdict === "high-risk" || scan.verdict === "needs-review") return {
    verdict: scan.verdict,
    title: "Needs review",
    summary: important ? `Cordon found ${important.title.toLowerCase()} in ${important.filePath}. Quarantine can show whether the related behavior accesses seeded credentials, starts child processes, or attempts external communication.` : "Cordon found behavior that should be observed before local execution.",
    action: "Run the recommended quarantine operation before installing dependencies or starting the repository on your primary machine.",
  };
  return {
    verdict: scan.verdict,
    title: "Low static risk",
    summary: "Cordon did not find a high-severity static behavior in the supported JavaScript and TypeScript inspection surface.",
    action: "Use the recommended quarantine operation to reduce the remaining uncertainty, then review informational findings before running the repository locally.",
  };
}

export function combinedDecision(scan: ScanResult, report: CombinedReport): SecurityDecision {
  const canary = report.runtimeFindings.find((finding) => finding.category === "runtime-canary");
  const blockedNetwork = report.runtimeFindings.find((finding) => finding.category === "runtime-network" && finding.runtime?.outcome === "blocked");
  const important = mostImportant(report.runtimeFindings) ?? mostImportant(scan.findings);
  if (report.verdict === "critical-risk") return {
    verdict: report.verdict,
    title: "Critical risk",
    summary: canary && blockedNetwork
      ? "Cordon observed repository code accessing a seeded credential and attempting an external connection. The connection was blocked by quarantine policy."
      : important ? `Cordon observed ${important.title.toLowerCase()} during the selected quarantine operation.` : "Cordon correlated critical static and runtime evidence during the selected operation.",
    action: "Do not run this repository on your primary machine. Ask the repository owner to explain or remove the implicated lifecycle script and named source files before further review.",
  };
  if (report.verdict === "high-risk" || report.verdict === "needs-review") return {
    verdict: report.verdict,
    title: report.verdict === "high-risk" ? "High risk" : "Needs review",
    summary: important ? `Cordon observed ${important.title.toLowerCase()} during the selected quarantine operation.` : "Runtime evidence reinforced the static review recommendation.",
    action: "Continue only inside an isolated environment and review the named script, dependency, or destination before local execution.",
  };
  if (report.verdict === "inconclusive") return {
    verdict: report.verdict,
    title: "Runtime inconclusive",
    summary: "Cordon could not complete the selected runtime observation. The completed static report remains available and no absence of evidence should be treated as a safety guarantee.",
    action: "Review the static findings now. Retry quarantine only after the readiness problem is resolved; retrying starts a new disposable container.",
  };
  return {
    verdict: report.verdict,
    title: "Low observed risk",
    summary: "Cordon did not observe access to seeded credentials, suspicious process chains, or blocked external connections during this run.",
    action: "This is not proof that the repository is safe. Review the informational findings and the exact commit before running it locally.",
  };
}
