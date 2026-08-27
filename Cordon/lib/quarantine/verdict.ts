import { createHash } from "node:crypto";

import type { AttackPath, AttackPathNode, Finding, ScanResult, Severity } from "../scanner/types";

import type { QuarantineResult, QuarantineVerdict, RuntimeEvent, TerminationReason } from "./types";

function findingId(eventIds: string[], rule: string): string {
  return createHash("sha256").update(`${rule}:${eventIds.join(":")}`).digest("hex").slice(0, 16);
}

function findingFromEvent(event: RuntimeEvent, input: Omit<Finding, "id" | "filePath" | "runtime" | "evidence">): Finding {
  return {
    ...input,
    id: findingId([event.id], input.ruleId),
    filePath: event.filePath ?? "runtime",
    evidence: event.evidence,
    runtime: {
      processId: event.processId,
      command: event.command,
      filePath: event.filePath,
      destination: event.destination,
      outcome: event.outcome,
      eventIds: [event.id],
    },
  };
}

export function runtimeFindings(events: RuntimeEvent[], terminationReason?: TerminationReason): Finding[] {
  const findings: Finding[] = [];
  for (const event of events) {
    if (event.type === "canary-access") {
      findings.push(findingFromEvent(event, {
        ruleId: "runtime-canary-access",
        title: "Repository code accessed a seeded credential canary",
        description: `The quarantine observed access to canary ${event.canaryId ?? "unknown"}. The value is fake, but the access demonstrates credential-seeking behavior in this run.`,
        severity: /ssh|cloud|wallet/i.test(event.evidence) ? "critical" : "high",
        category: "runtime-canary",
        recommendation: "Review the responsible script and remove any access to credentials that are unrelated to the package's documented purpose.",
      }));
    } else if (event.type === "canary-propagation") {
      findings.push(findingFromEvent(event, {
        ruleId: "runtime-canary-propagation",
        title: "Seeded canary was copied or prepared for transmission",
        description: "A fake canary value appeared in another file, process argument, or observable network payload. This is propagation evidence, not proof of successful exfiltration.",
        severity: "critical",
        category: "runtime-canary",
        recommendation: "Treat the data flow as hostile until the exact source-to-destination behavior is explained and removed.",
      }));
    } else if (event.type === "network-attempt") {
      findings.push(findingFromEvent(event, {
        ruleId: "runtime-network-attempt",
        title: event.outcome === "blocked" ? "Quarantine blocked an outbound network attempt" : "Repository code attempted a network connection",
        description: `The runtime recorded a connection attempt to ${event.destination ?? "an unresolved destination"}. Outcome: ${event.outcome ?? "unknown"}.`,
        severity: event.outcome === "blocked" ? "medium" : "high",
        category: "runtime-network",
        recommendation: "Confirm that the destination is required. Keep execution network-disabled unless a registry-only install plan is necessary.",
      }));
    } else if (event.type === "sensitive-path-access") {
      findings.push(findingFromEvent(event, {
        ruleId: "runtime-sensitive-path",
        title: "Repository code attempted to access a sensitive path",
        description: "The runtime observed a sensitive filesystem access. Review whether this path is necessary for the selected package operation.",
        severity: "high",
        category: "runtime-filesystem",
        recommendation: "Remove host-oriented credential and profile access from repository scripts.",
      }));
    } else if (event.type === "policy-violation") {
      findings.push(findingFromEvent(event, {
        ruleId: "runtime-policy-violation",
        title: "Quarantine policy stopped repository behavior",
        description: event.evidence,
        severity: "high",
        category: "sandbox-violation",
        recommendation: "Do not weaken the quarantine. Review the behavior and run only after its purpose is understood.",
      }));
    } else if (event.type === "process-start" && event.parentProcessId && event.command) {
      const sensitiveTool = /(?:^|\s)(?:sh|bash|curl|wget|git)(?:\s|$)/i.test(event.command ?? event.evidence);
      findings.push(findingFromEvent(event, {
        ruleId: "runtime-child-process",
        title: "Repository script started a child process",
        description: sensitiveTool ? "A shell, transfer tool, or Git process was started. This is review-worthy context, but process creation alone is not evidence of malicious intent." : "The selected operation started another process. This is useful execution context, but process creation alone is not evidence of malicious intent.",
        severity: sensitiveTool ? "medium" : "low",
        category: "runtime-process",
        recommendation: "Confirm the subprocess is expected and correlate it with any subsequent file, canary, or network behavior.",
      }));
    }
  }
  if (terminationReason === "timeout" || terminationReason === "output-limit") {
    const event: RuntimeEvent = {
      id: `termination-${terminationReason}`,
      timestamp: new Date().toISOString(),
      type: "policy-violation",
      outcome: "blocked",
      evidence: terminationReason === "timeout" ? "The process exceeded the execution timeout and was forcibly terminated." : "The process exceeded the output limit and was forcibly terminated.",
    };
    findings.push(findingFromEvent(event, {
      ruleId: `runtime-${terminationReason}`,
      title: terminationReason === "timeout" ? "Execution exceeded the quarantine timeout" : "Execution exceeded the quarantine output limit",
      description: event.evidence,
      severity: "high",
      category: "sandbox-violation",
      recommendation: "Review the selected script for unbounded work or excessive output before any further execution.",
    }));
  }
  return [...new Map(findings.map((finding) => [finding.id, finding])).values()];
}

function strongestSeverity(findings: Finding[]): Severity {
  const order: Severity[] = ["info", "low", "medium", "high", "critical"];
  return findings.reduce((current, finding) => order.indexOf(finding.severity) > order.indexOf(current) ? finding.severity : current, "info" as Severity);
}

export function runtimeVerdict(staticVerdict: ScanResult["verdict"], findings: Finding[], result?: Pick<QuarantineResult, "terminationReason">): QuarantineVerdict {
  if (!result || result.terminationReason === "engine-unavailable" || result.terminationReason === "policy-refusal") return "inconclusive";
  const severity = strongestSeverity(findings);
  if (severity === "critical" || staticVerdict === "critical-risk") return "critical-risk";
  if (severity === "high" || staticVerdict === "high-risk") return "high-risk";
  if (severity === "medium" || staticVerdict === "needs-review") return "needs-review";
  return "low-risk";
}

function nodeId(prefix: string, id: string): string {
  return `${prefix}-${id}`;
}

export function buildCombinedAttackPaths(scan: ScanResult, result: QuarantineResult): AttackPath[] {
  const runtime = result.findings;
  const canary = runtime.find((finding) => finding.category === "runtime-canary");
  const network = runtime.find((finding) => finding.category === "runtime-network");
  const process = runtime.find((finding) => finding.category === "runtime-process");
  const lifecycle = scan.findings.find((finding) => finding.category === "lifecycle-script");
  if (!canary && !network) return scan.attackPaths;

  const members = [lifecycle, process, canary, network].filter((value): value is Finding => Boolean(value));
  const nodes: AttackPathNode[] = members.map((finding) => ({
    id: nodeId(finding.runtime ? "runtime" : "static", finding.id),
    label: finding.title,
    evidenceKind: finding.runtime ? "observed" : "statically-detected",
    findingId: finding.id,
    runtimeEventId: finding.runtime?.eventIds[0],
    filePath: finding.filePath,
    line: finding.startLine,
    processId: finding.runtime?.processId,
    policyDecision: finding.runtime?.outcome === "blocked" ? "blocked by quarantine policy" : undefined,
  }));
  const edges = nodes.slice(1).map((node, index) => ({
    id: `edge-${nodes[index].id}-${node.id}`,
    source: nodes[index].id,
    target: node.id,
    evidenceKind: "correlated" as const,
    label: "Correlated within the selected execution plan; causality is not inferred as observation.",
  }));
  const combined: AttackPath = {
    id: findingId(members.map((finding) => finding.id), "combined-path"),
    title: canary && network ? "Observed credential access connected to an outbound attempt" : canary ? "Static execution surface connected to observed canary access" : "Static execution surface connected to an outbound attempt",
    description: "This path combines static and runtime evidence from the same repository commit and selected execution plan. Correlated edges are labeled separately from observed events.",
    severity: canary?.severity === "critical" ? "critical" : "high",
    findingIds: members.map((finding) => finding.id),
    steps: nodes.map((node) => `${node.evidenceKind}: ${node.label}`),
    scoreBonus: canary && network ? 15 : 8,
    nodes,
    edges,
  };
  return [...scan.attackPaths, combined];
}
