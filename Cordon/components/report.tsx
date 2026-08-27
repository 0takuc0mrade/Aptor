"use client";

import { useMemo, useState } from "react";

import { QuarantinePanel } from "@/components/quarantine-panel";
import type { ExecutionRecommendation, InspectionFailure } from "@/lib/inspection/types";
import type { CombinedReport, QuarantineRunRecord, RuntimeEvent } from "@/lib/quarantine/types";
import { formatCategory, formatDate, formatSeverity, shortHash } from "@/lib/reports/format";
import { combinedDecision, staticDecision } from "@/lib/reports/guidance";
import type { AttackPath, Finding, FindingCategory, ScanResult, Severity } from "@/lib/scanner/types";

const SEVERITIES: Array<Severity | "all"> = ["all", "critical", "high", "medium", "low", "info"];

function evidenceLabel(kind: string, policyDecision?: string): string {
  if (policyDecision?.includes("blocked")) return "Blocked by policy";
  return { observed: "Observed at runtime", "statically-detected": "Statically detected", correlated: "Correlated", inferred: "Inferred" }[kind] ?? "Inconclusive";
}

function eventLabel(event: RuntimeEvent): string {
  return {
    "process-start": "Process started",
    "process-exit": "Process exited",
    "file-read": "File read",
    "file-write": "File written",
    "sensitive-path-access": "Sensitive path accessed",
    "network-attempt": event.outcome === "blocked" ? "Connection blocked" : "Network connection attempted",
    "canary-access": "Seeded canary accessed",
    "canary-propagation": "Seeded canary propagated",
    stdout: "Standard output",
    stderr: "Standard error",
    "policy-violation": "Policy violation",
  }[event.type];
}

function AttackPathSection({ paths, title = "Most important attack path", combined = false }: { paths: AttackPath[]; title?: string; combined?: boolean }) {
  if (!paths.length) return null;
  const shown = combined ? [paths.find((path) => path.nodes?.length) ?? paths[0]] : paths;
  return (
    <section className="attack-paths" aria-labelledby={combined ? "combined-path-title" : "static-path-title"}>
      <header><h2 id={combined ? "combined-path-title" : "static-path-title"}>{title}</h2><p>{combined ? "Observed, blocked, correlated, and static evidence are labeled separately." : "Static proximity raises review priority but does not prove author intent or runtime causality."}</p></header>
      <div className="attack-path-list">
        {shown.map((path) => (
          <article key={path.id} className="attack-path" data-severity={path.severity}>
            <div><span>{path.severity === "critical" ? "Critical chain" : "High-risk chain"}</span>{!combined ? <strong>+{path.scoreBonus} score</strong> : <strong>{path.nodes?.length ?? path.steps.length} steps</strong>}</div>
            <h3>{path.title}</h3><p>{path.description}</p>
            <ol>{path.nodes?.length ? path.nodes.map((node, index) => <li key={node.id}><span>{index + 1}</span><div><strong>{node.label}</strong><small className="evidence-kind" data-kind={node.policyDecision?.includes("blocked") ? "blocked" : node.evidenceKind}>{evidenceLabel(node.evidenceKind, node.policyDecision)}</small>{node.filePath ? <code>{node.filePath}{node.line ? `:${node.line}` : ""}</code> : null}</div></li>) : path.steps.map((step, index) => <li key={step}><span>{index + 1}</span>{step}</li>)}</ol>
          </article>
        ))}
      </div>
    </section>
  );
}

function FindingRows({ findings, runtime = false }: { findings: Finding[]; runtime?: boolean }) {
  if (!findings.length) return <div className="filtered-empty"><h3>No suspicious {runtime ? "runtime" : "static"} findings were produced.</h3><p>{runtime ? "This applies only to the selected operation and is not proof that the repository is safe." : "Review the report scope and limitations before making a local execution decision."}</p></div>;
  return <div className="finding-list">{findings.map((finding) => (
    <details className="finding" key={finding.id}>
      <summary><span className={`severity-label severity-label--${finding.severity}`}>{formatSeverity(finding.severity)}</span><span className="finding__summary"><strong>{finding.title}</strong><small>{runtime ? finding.runtime?.outcome === "blocked" ? "Blocked by policy" : "Observed at runtime" : "Statically detected"} · {formatCategory(finding.category)}</small></span><span className="finding__location mono">{finding.filePath}{finding.startLine ? `:${finding.startLine}` : ""}</span><span className="disclosure" aria-hidden="true">+</span></summary>
      <div className="finding__details"><div className="finding__explanation"><h3>Why Cordon flagged this</h3><p>{finding.description}</p></div>{finding.evidence ? <div className="evidence-block"><div><span>Evidence</span><span className="mono">{finding.filePath}{finding.startLine ? `:${finding.startLine}` : ""}</span></div><pre><code>{finding.evidence}</code></pre></div> : null}<div className="recommendation"><h3>Recommended action</h3><p>{finding.recommendation}</p></div></div>
    </details>
  ))}</div>;
}

function ReceiptActions({ scanId }: { scanId: string }) {
  const [copyState, setCopyState] = useState<"idle" | "copying" | "copied" | "error">("idle");
  async function copySummary() {
    setCopyState("copying");
    try {
      const response = await fetch(`/api/scans/${scanId}/summary`, { cache: "no-store" });
      const payload = await response.json() as { summary?: string; error?: string };
      if (!response.ok || !payload.summary) throw new Error(payload.error ?? "Summary unavailable.");
      await navigator.clipboard.writeText(payload.summary);
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 2_500);
    } catch {
      setCopyState("error");
    }
  }
  return <div className="report-actions" aria-label="Report receipt actions"><a className="secondary-button" href={`/api/scans/${scanId}/receipt`} download>Download JSON receipt</a><button className="secondary-button" type="button" onClick={() => void copySummary()} disabled={copyState === "copying"} data-state={copyState}>{copyState === "copying" ? "Copying…" : copyState === "copied" ? "Copied summary" : copyState === "error" ? "Copy failed — retry" : "Copy text summary"}</button></div>;
}

function RuntimeTimeline({ events }: { events: RuntimeEvent[] }) {
  return <section className="runtime-timeline" aria-labelledby="complete-timeline-title"><header><h2 id="complete-timeline-title">Complete timeline</h2><p>Structured observer events from this attempt. Expand a row for bounded technical evidence.</p></header>{events.length ? <ol>{events.map((event) => <li key={event.id} data-type={event.type}><time className="mono">{new Date(event.timestamp).toLocaleTimeString()}</time><details><summary><strong>{eventLabel(event)}</strong><span>{event.outcome ?? "observed"}</span></summary><div><p>{event.evidence}</p>{event.command ? <code>{event.command}</code> : null}{event.filePath ? <code>{event.filePath}</code> : null}{event.destination ? <code>{event.destination}</code> : null}</div></details></li>)}</ol> : <p className="runtime-empty">No supported runtime events were recorded for this attempt.</p>}</section>;
}

export function Report({ scan, recommendation, initialRun = null, inspectionFailure }: { scan: ScanResult; recommendation?: ExecutionRecommendation; initialRun?: QuarantineRunRecord | null; inspectionFailure?: InspectionFailure }) {
  const [severity, setSeverity] = useState<Severity | "all">("all");
  const [category, setCategory] = useState<FindingCategory | "all">("all");
  const [combined, setCombined] = useState<CombinedReport | null>(null);
  const categories = useMemo(() => [...new Set(scan.findings.map((finding) => finding.category))], [scan.findings]);
  const findings = useMemo(() => scan.findings.filter((finding) => (severity === "all" || finding.severity === severity) && (category === "all" || finding.category === category)), [category, scan.findings, severity]);
  const decision = combined ? combinedDecision(scan, combined) : staticDecision(scan);

  return (
    <article className="report">
      <header className="report-header report-header--identity">
        <div className="report-header__identity"><div className="repository-state"><span className={`verdict-marker verdict-marker--${decision.verdict}`} aria-hidden="true" />{combined ? "Complete Cordon report" : "Static inspection complete"}</div><h1>{scan.repository.owner}/{scan.repository.name}</h1><p><span className="mono">{scan.repository.defaultBranch}</span><span aria-hidden="true">·</span><span className="mono">{shortHash(scan.repository.commitHash)}</span><span aria-hidden="true">·</span><span>{formatDate(scan.completedAt)}</span>{scan.repository.source === "demo" ? <><span aria-hidden="true">·</span><span>Demonstration repository</span></> : null}</p></div>
      </header>

      <section className={`decision-panel decision-panel--${decision.verdict}`} aria-labelledby="decision-title">
        <div><p>Overall verdict</p><h2 id="decision-title">{decision.title}</h2><p>{decision.summary}</p></div>
        <div className="decision-panel__action"><strong>Recommended action</strong><p>{decision.action}</p>{!combined && recommendation?.supported ? <a className="primary-button" href="#quarantine-confirmation">Run in quarantine</a> : null}</div>
      </section>

      <ReceiptActions scanId={scan.id} />

      {inspectionFailure ? <section className="recovery-panel" role="alert"><div><h2>{inspectionFailure.title}</h2><p>{inspectionFailure.message}</p></div><p>The completed static findings below remain available.</p></section> : null}

      {combined ? (
        <>
          <AttackPathSection paths={combined.attackPaths} combined />
          <section className="findings" aria-labelledby="static-findings-title"><header className="findings-header"><div><h2 id="static-findings-title">Static findings</h2><p>{scan.findings.length} evidence-backed findings from the exact inspected commit.</p></div></header><FindingRows findings={scan.findings} /></section>
          <section className="findings" aria-labelledby="runtime-findings-title"><header className="findings-header"><div><h2 id="runtime-findings-title">Runtime findings</h2><p>{combined.runtimeFindings.length} findings from the selected quarantine operation.</p></div></header><FindingRows findings={combined.runtimeFindings} runtime /></section>
          <RuntimeTimeline events={combined.runtimeEvents} />
          <details className="report-technical"><summary>Execution policy <span aria-hidden="true">+</span></summary><dl><div><dt>Operation</dt><dd>{combined.executionPlan.mode}</dd></div><div><dt>Network</dt><dd>{combined.executionPlan.networkPolicy === "disabled" ? "Disabled" : "Approved registries only"}</dd></div><div><dt>Timeout</dt><dd>{combined.executionPlan.timeoutMs / 1_000} seconds</dd></div><div><dt>Memory</dt><dd>{combined.executionPlan.memoryLimitMb} MB</dd></div><div><dt>CPU</dt><dd>{combined.executionPlan.cpuLimit}</dd></div><div><dt>Process limit</dt><dd>{combined.executionPlan.processLimit}</dd></div></dl></details>
          <details className="report-technical"><summary>Technical metadata <span aria-hidden="true">+</span></summary><dl><div><dt>Commit</dt><dd><code>{scan.repository.commitHash}</code></dd></div><div><dt>Static files</dt><dd>{scan.filesScanned}</dd></div><div><dt>Rules executed</dt><dd>{scan.rulesExecuted.length}</dd></div><div><dt>Runtime events</dt><dd>{combined.runtimeEvents.length}</dd></div><div><dt>Evidence status</dt><dd>{combined.verdict === "inconclusive" ? "Inconclusive" : "Combined"}</dd></div></dl></details>
          <QuarantinePanel scanId={scan.id} recommendation={recommendation} initialRun={initialRun} compact onCombined={setCombined} />
          <aside className="report-limitation"><strong>Observation boundary</strong><p>{combined.safetyNotice}</p></aside>
        </>
      ) : (
        <>
          <section className="severity-ledger" aria-label="Static finding severity totals">{(["critical", "high", "medium", "low", "info"] as Severity[]).map((item) => <button key={item} type="button" onClick={() => setSeverity(item)} aria-pressed={severity === item} className={`severity-ledger__item severity-ledger__item--${item}`}><span>{formatSeverity(item)}</span><strong>{scan.severityTotals[item]}</strong></button>)}</section>
          <QuarantinePanel scanId={scan.id} recommendation={recommendation} initialRun={initialRun} onCombined={setCombined} />
          <AttackPathSection paths={scan.attackPaths} title="Static attack-path reasoning" />
          <section className="findings" aria-labelledby="findings-title"><header className="findings-header"><div><h2 id="findings-title">Static findings</h2><p>{findings.length} of {scan.findings.length} evidence-backed findings shown.</p></div><div className="filters"><label>Severity<select value={severity} onChange={(event) => setSeverity(event.target.value as Severity | "all")}>{SEVERITIES.map((item) => <option key={item} value={item}>{item === "all" ? "All severities" : formatSeverity(item)}</option>)}</select></label><label>Category<select value={category} onChange={(event) => setCategory(event.target.value as FindingCategory | "all")}><option value="all">All categories</option>{categories.map((item) => <option key={item} value={item}>{formatCategory(item)}</option>)}</select></label></div></header><FindingRows findings={findings} /></section>
          <aside className="report-limitation"><strong>Scope boundary</strong><p>Static findings do not execute code or prove author intent. Quarantine observations, when present, apply only to the selected operation and conditions of that run.</p></aside>
        </>
      )}
    </article>
  );
}
