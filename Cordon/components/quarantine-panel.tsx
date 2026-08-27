"use client";

import { useCallback, useEffect, useState } from "react";

import type { ExecutionRecommendation } from "@/lib/inspection/types";
import type { CombinedReport, DockerReadiness, PublicExecutionPlan, QuarantineRunRecord, RuntimeEvent } from "@/lib/quarantine/types";

type PlanPayload = {
  readiness: DockerReadiness;
  recommendation: ExecutionRecommendation;
  plan: PublicExecutionPlan | null;
  latestRun: QuarantineRunRecord | null;
  attempts: QuarantineRunRecord[];
  troubleshooting: { instruction: string; detail?: string } | null;
};

async function responseJson<T>(response: Response): Promise<T> {
  const payload = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(payload.error ?? "The quarantine request failed.");
  return payload;
}

function eventLabel(event: RuntimeEvent): string {
  return {
    "process-start": "Process started",
    "process-exit": "Process exited",
    "file-read": "File accessed",
    "file-write": "File changed",
    "sensitive-path-access": "Sensitive file accessed",
    "network-attempt": event.outcome === "blocked" ? "Connection blocked" : "Network connection attempted",
    "canary-access": "Detection canary read",
    "canary-propagation": "Detection canary copied",
    stdout: "Process output recorded",
    stderr: "Process error output recorded",
    "policy-violation": "Policy violation",
  }[event.type];
}

function readinessLabel(readiness?: DockerReadiness): string {
  if (!readiness || readiness.state === "preparing") return "Preparing the isolated runtime.";
  if (readiness.state === "ready") return "Quarantine is ready.";
  return "Quarantine is unavailable because the isolated runtime could not start.";
}

export function QuarantinePanel({
  scanId,
  recommendation: initialRecommendation,
  initialRun = null,
  compact = false,
  onCombined,
}: {
  scanId: string;
  recommendation?: ExecutionRecommendation;
  initialRun?: QuarantineRunRecord | null;
  compact?: boolean;
  onCombined?: (report: CombinedReport | null) => void;
}) {
  const [payload, setPayload] = useState<PlanPayload | null>(null);
  const [run, setRun] = useState<QuarantineRunRecord | null>(initialRun);
  const [attempts, setAttempts] = useState<QuarantineRunRecord[]>(initialRun ? [initialRun] : []);
  const [combined, setCombined] = useState<CombinedReport | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "starting" | "error">("loading");
  const [error, setError] = useState("");

  const loadPlan = useCallback(async (retry = false) => {
    const next = await responseJson<PlanPayload>(await fetch(`/api/scans/${scanId}/quarantine/plan${retry ? "?retry=1" : ""}`, { cache: "no-store" }));
    setPayload(next);
    setRun((current) => current ?? next.latestRun);
    setAttempts(next.attempts);
    setState("ready");
    return next;
  }, [scanId]);

  const loadReport = useCallback(async (selected: QuarantineRunRecord) => {
    if (!selected.result) return;
    try {
      const result = await responseJson<{ report: CombinedReport }>(await fetch(`/api/scans/${scanId}/quarantine/runs/${selected.id}/report`, { cache: "no-store" }));
      setCombined(result.report);
      onCombined?.(result.report);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Cordon could not load the combined report.");
    }
  }, [onCombined, scanId]);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      void loadPlan().then((next) => {
        if (!active) return;
        if (next.latestRun?.result) void loadReport(next.latestRun);
      }).catch((cause) => {
        if (!active) return;
        setError(cause instanceof Error ? cause.message : "Cordon could not prepare quarantine options.");
        setState("error");
      });
    }, 0);
    return () => { active = false; window.clearTimeout(timer); };
  }, [loadPlan, loadReport]);

  useEffect(() => {
    if (payload?.readiness.state !== "preparing") return;
    const timer = window.setTimeout(() => { void loadPlan().catch(() => undefined); }, 1_000);
    return () => window.clearTimeout(timer);
  }, [loadPlan, payload?.readiness.state]);

  useEffect(() => {
    if (!run || (run.status !== "queued" && run.status !== "running")) return;
    const timer = window.setTimeout(() => {
      void fetch(`/api/scans/${scanId}/quarantine/runs/${run.id}`, { cache: "no-store" }).then((response) => responseJson<{ run: QuarantineRunRecord }>(response))
        .then((next) => {
          setRun(next.run);
          setAttempts((current) => [next.run, ...current.filter((attempt) => attempt.id !== next.run.id)].sort((a, b) => b.attempt - a.attempt));
          if ((next.run.status === "completed" || next.run.status === "failed") && next.run.result) void loadReport(next.run);
        })
        .catch((cause) => setError(cause instanceof Error ? cause.message : "Cordon could not restore the active runtime state."));
    }, 700);
    return () => window.clearTimeout(timer);
  }, [loadReport, run, scanId]);

  async function startRun(retry = false) {
    const plan = payload?.plan;
    if (!plan || state === "starting") return;
    setState("starting");
    setError("");
    if (retry) {
      setCombined(null);
      onCombined?.(null);
    }
    try {
      const next = await responseJson<{ run: QuarantineRunRecord }>(await fetch(`/api/scans/${scanId}/quarantine/runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: plan.id, retry }),
      }));
      setRun(next.run);
      setAttempts((current) => [next.run, ...current.filter((attempt) => attempt.id !== next.run.id)].sort((a, b) => b.attempt - a.attempt));
      setState("ready");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Cordon could not start the quarantine run.");
      setState("error");
    }
  }

  async function selectAttempt(attempt: QuarantineRunRecord) {
    setRun(attempt);
    setCombined(null);
    if (attempt.result) await loadReport(attempt);
    else onCombined?.(null);
  }

  const recommendation = payload?.recommendation ?? initialRecommendation;
  const plan = payload?.plan ?? recommendation?.plan ?? null;
  const readiness = payload?.readiness;
  const running = run?.status === "queued" || run?.status === "running";

  if (compact && combined) {
    return (
      <section className="attempt-toolbar" aria-label="Quarantine attempts">
        <div><strong>Quarantine attempt {run?.attempt ?? 1}</strong><p>{run?.status === "failed" ? "This attempt stopped without weakening policy. Static findings remain available." : "The combined report reflects this attempt by default."}</p></div>
        <div>
          {attempts.length > 1 ? <label>View attempt<select value={run?.id} onChange={(event) => { const attempt = attempts.find((item) => item.id === event.target.value); if (attempt) void selectAttempt(attempt); }}>{attempts.map((attempt) => <option key={attempt.id} value={attempt.id}>Attempt {attempt.attempt} · {attempt.status}</option>)}</select></label> : null}
          {run?.status === "failed" ? <button className="secondary-button" type="button" onClick={() => void startRun(true)}>Retry quarantine</button> : null}
        </div>
      </section>
    );
  }

  return (
    <section className="quarantine" id="quarantine-confirmation" aria-labelledby="quarantine-title">
      <header className="quarantine__header">
        <div><h2 id="quarantine-title">Recommended quarantine run</h2><p>{recommendation?.rationale ?? "Cordon is preparing a deterministic runtime recommendation from the static evidence."}</p></div>
        <span className="quarantine-state" data-state={readiness?.state ?? "preparing"}><i aria-hidden="true" />{readiness?.state === "ready" ? "Ready" : readiness?.state === "unavailable" ? "Unavailable" : "Preparing"}</span>
      </header>

      {state === "loading" || !payload ? <div className="quarantine-loading" role="status">Preparing the safest supported runtime option…</div> : null}

      {recommendation && !recommendation.supported ? (
        <div className="quarantine-unavailable"><strong>{recommendation.title}</strong><p>{recommendation.rationale}</p></div>
      ) : null}

      {recommendation?.supported && plan ? (
        <div className="quarantine-confirmation">
          <div className="quarantine-confirmation__copy">
            {recommendation.confirmation.map((line) => <p key={line}>{line}</p>)}
          </div>
          <details className="execution-details">
            <summary>Execution details <span aria-hidden="true">+</span></summary>
            <dl>
              <div><dt>Operation</dt><dd>{plan.mode === "install" ? "Dependency installation" : plan.mode === "script" ? `Package script: ${plan.selectedScript}` : "Controlled metadata probe"}</dd></div>
              <div><dt>Exact arguments</dt><dd><code>{JSON.stringify(plan.command)}</code></dd></div>
              <div><dt>Runtime image</dt><dd><code>{readiness?.image}</code></dd></div>
              <div><dt>Memory</dt><dd>{plan.memoryLimitMb} MB</dd></div>
              <div><dt>CPU</dt><dd>{plan.cpuLimit}</dd></div>
              <div><dt>Processes</dt><dd>{plan.processLimit}</dd></div>
              <div><dt>Output</dt><dd>{Math.round(plan.outputLimitBytes / 1_000)} kB</dd></div>
              <div><dt>Allowed domains</dt><dd>{plan.allowedDomains.length ? plan.allowedDomains.join(", ") : "None"}</dd></div>
            </dl>
          </details>

          <div className="readiness-message" data-state={readiness?.state} role="status">
            <strong>{readinessLabel(readiness)}</strong>
            <p>{readiness?.state === "unavailable" ? "Static inspection is complete and available below." : readiness?.message}</p>
            {readiness?.state === "unavailable" ? (
              <details><summary>Troubleshooting</summary><p>{payload?.troubleshooting?.instruction}</p>{payload?.troubleshooting?.detail ? <code>{payload.troubleshooting.detail}</code> : null}<button className="text-button" type="button" onClick={() => void loadPlan(true)}>Retry readiness</button></details>
            ) : null}
          </div>

          {!run || (!running && run.status !== "completed") ? (
            <button className="primary-button" type="button" onClick={() => void startRun(run?.status === "failed")} disabled={readiness?.state !== "ready" || state === "starting"} data-state={state === "starting" ? "loading" : "default"}>
              {state === "starting" ? "Starting isolated run…" : run?.status === "failed" ? "Retry quarantine run" : "Start quarantine run"}
            </button>
          ) : null}
        </div>
      ) : null}

      {run ? (
        <section className="runtime-progress" aria-labelledby="runtime-progress-title">
          <header><div><h3 id="runtime-progress-title">{running ? "Quarantine in progress" : run.status === "failed" ? "Quarantine stopped" : "Quarantine complete"}</h3><p>Attempt {run.attempt}. Refreshing this page reconnects to the current stored state.</p></div><span>{run.status}</span></header>
          <ol className="runtime-stages">
            {run.stages.map((stage) => <li key={stage.id} data-state={stage.status}><span aria-hidden="true">{stage.status === "completed" ? "✓" : stage.status === "failed" ? "×" : stage.status === "active" ? "•" : ""}</span><div><strong>{stage.label}</strong><small>{stage.status}</small></div></li>)}
          </ol>
          {run.events.length ? (
            <div className="live-events"><h3>Observed activity</h3><ol>{run.events.map((event) => <li key={event.id}><time>{new Date(event.timestamp).toLocaleTimeString()}</time><details><summary><strong>{eventLabel(event)}</strong><span>{event.outcome ?? "observed"}</span></summary><p>{event.evidence}</p></details></li>)}</ol></div>
          ) : <p className="runtime-empty">Important process, file, canary, and network events will appear here as Cordon records them.</p>}
          {run.status === "failed" ? <div className="runtime-recovery"><strong>What remains available</strong><p>The static report below is unchanged. You can retry intentionally; retrying creates a new disposable container and preserves this attempt.</p><button className="secondary-button" type="button" onClick={() => void startRun(true)} disabled={state === "starting" || readiness?.state !== "ready"}>Retry quarantine</button></div> : null}
        </section>
      ) : null}

      {attempts.length > 1 ? <details className="previous-attempts"><summary>Previous quarantine attempts</summary><ul>{attempts.map((attempt) => <li key={attempt.id}><button type="button" onClick={() => void selectAttempt(attempt)}>Attempt {attempt.attempt}</button><span>{attempt.status}</span><time>{new Date(attempt.createdAt).toLocaleString()}</time></li>)}</ul></details> : null}
      {error ? <p className="quarantine-error" role="alert">{error}</p> : null}
    </section>
  );
}
