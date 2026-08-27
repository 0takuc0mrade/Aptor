"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

import { INSPECTION_STAGE_LABELS } from "@/lib/inspection/stages";
import type { InspectionRecord, ScanHistoryItem } from "@/lib/inspection/types";
import { formatVerdict, shortHash } from "@/lib/reports/format";

type DashboardProps = {
  initialInspections: ScanHistoryItem[];
  submissionMode: boolean;
  initialRepositoryUrl?: string;
};

async function responseJson<T>(response: Response): Promise<T> {
  const payload = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(payload.error ?? "Cordon could not start the inspection.");
  return payload;
}

function relativeTime(value?: string): string {
  if (!value) return "In progress";
  const delta = new Date(value).getTime() - Date.now();
  const minutes = Math.round(delta / 60_000);
  if (Math.abs(minutes) < 1) return "Just now";
  if (Math.abs(minutes) < 60) return new Intl.RelativeTimeFormat(undefined, { numeric: "auto" }).format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return new Intl.RelativeTimeFormat(undefined, { numeric: "auto" }).format(hours, "hour");
  return new Intl.RelativeTimeFormat(undefined, { numeric: "auto" }).format(Math.round(hours / 24), "day");
}

function currentStatus(item: ScanHistoryItem): string {
  if (item.runtimeStatus === "running" || item.runtimeStatus === "queued") return "Quarantine running";
  if (item.status === "failed") return "Inspection incomplete";
  if (item.status !== "completed") return INSPECTION_STAGE_LABELS[item.stage];
  return item.runtimeVerdict ? "Complete report" : "Static inspection complete";
}

export function Dashboard({ initialInspections, submissionMode, initialRepositoryUrl = "" }: DashboardProps) {
  const router = useRouter();
  const submissionKey = useRef<string | null>(null);
  const [repositoryUrl, setRepositoryUrl] = useState(initialRepositoryUrl);
  const [touched, setTouched] = useState(false);
  const [state, setState] = useState<"idle" | "submitting" | "error">("idle");
  const [error, setError] = useState("");
  const [history, setHistory] = useState(initialInspections);
  const [demoLoading, setDemoLoading] = useState<"normal" | "suspicious" | "reset" | null>(null);

  const validationError = useMemo(() => {
    if (!touched || !repositoryUrl) return "";
    try {
      const url = new URL(repositoryUrl);
      if (url.protocol !== "https:" || url.hostname !== "github.com" || url.pathname.split("/").filter(Boolean).length !== 2) {
        return "Use a public repository root URL such as https://github.com/owner/repository.";
      }
      return "";
    } catch {
      return "Enter a complete GitHub repository URL.";
    }
  }, [repositoryUrl, touched]);

  useEffect(() => {
    if (!history.some((item) => item.status === "queued" || item.status === "running" || item.runtimeStatus === "queued" || item.runtimeStatus === "running")) return;
    const timer = window.setTimeout(() => {
      void fetch("/api/scans", { cache: "no-store" }).then((response) => responseJson<{ inspections: ScanHistoryItem[] }>(response))
        .then((payload) => setHistory(payload.inspections))
        .catch(() => undefined);
    }, 1_200);
    return () => window.clearTimeout(timer);
  }, [history]);

  async function createInspection(body: { repositoryUrl?: string; demo?: "normal" | "suspicious" }) {
    const key = submissionKey.current ?? crypto.randomUUID();
    submissionKey.current = key;
    const payload = await responseJson<{ inspection: InspectionRecord }>(await fetch("/api/scans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, submissionKey: key }),
    }));
    router.push(`/reports/${payload.inspection.id}`);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTouched(true);
    if (!repositoryUrl || validationError || state === "submitting") return;
    setState("submitting");
    setError("");
    try {
      await createInspection({ repositoryUrl });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Cordon could not start the inspection.");
      setState("error");
    }
  }

  async function inspectDemo(demo: "normal" | "suspicious") {
    if (demoLoading) return;
    setDemoLoading(demo);
    setError("");
    submissionKey.current = crypto.randomUUID();
    try {
      await createInspection({ demo });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Cordon could not start the demonstration inspection.");
      setDemoLoading(null);
    }
  }

  async function resetDemos() {
    setDemoLoading("reset");
    try {
      await responseJson(await fetch("/api/submission/reset", { method: "POST" }));
      setHistory((current) => current.filter((item) => item.source !== "demo"));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Demonstration state could not be reset.");
    } finally {
      setDemoLoading(null);
    }
  }

  return (
    <div className="dashboard">
      <section className="scan-intro" aria-labelledby="scan-title">
        <div className="scan-intro__copy">
          <p className="product-promise">Inspect unknown code before it reaches your machine.</p>
          <h1 id="scan-title">Start with the repository, not trust.</h1>
          <p>Cordon inspects a public repository, recommends the safest useful next step, and observes selected behavior inside a disposable quarantine.</p>
        </div>

        <div className="scan-workbench">
          <div className="workbench-heading">
            <div><h2>Inspect a repository</h2><p>Paste one public GitHub repository URL.</p></div>
            <span className="system-state"><i aria-hidden="true" /> Evidence-first inspection</span>
          </div>
          <form className="scan-form" onSubmit={submit} noValidate>
            <label htmlFor="repository-url">GitHub repository URL</label>
            <div className="scan-form__row">
              <div className="input-shell" data-state={validationError ? "error" : repositoryUrl && touched ? "success" : "default"}>
                <span aria-hidden="true">github.com/</span>
                <input
                  id="repository-url"
                  name="repositoryUrl"
                  type="url"
                  inputMode="url"
                  autoComplete="url"
                  placeholder="owner/repository"
                  value={repositoryUrl.replace(/^https:\/\/github\.com\//, "")}
                  onChange={(event) => {
                    const value = event.target.value.trimStart();
                    setRepositoryUrl(value ? (value.startsWith("http") ? value : `https://github.com/${value}`) : "");
                    submissionKey.current = null;
                    if (state === "error") setState("idle");
                  }}
                  onBlur={() => setTouched(true)}
                  aria-invalid={Boolean(validationError)}
                  aria-describedby="repository-help"
                  disabled={state === "submitting"}
                />
              </div>
              <button className="primary-button" type="submit" disabled={state === "submitting" || Boolean(validationError)} data-state={state === "submitting" ? "loading" : state === "error" ? "error" : "default"}>
                {state === "submitting" ? "Opening inspection…" : "Inspect repository"}
                {state === "submitting" ? <span className="button-loader" aria-hidden="true" /> : <span aria-hidden="true">→</span>}
              </button>
            </div>
            <p className={validationError || error ? "field-message field-message--error" : "field-message"} id="repository-help" role={error ? "alert" : undefined}>
              {validationError || error || "Cordon keeps the entered URL here if validation fails. Private and oversized repositories are rejected before execution."}
            </p>
          </form>

          {submissionMode ? (
            <div className="demo-repositories" aria-label="Demonstration repositories">
              <div><strong>Demonstration repositories</strong><p>These run through the same scanner, planner, quarantine, telemetry, and report pipeline.</p></div>
              <div className="demo-repositories__actions">
                <button type="button" className="secondary-button" onClick={() => void inspectDemo("normal")} disabled={Boolean(demoLoading)}>Inspect normal demo repository</button>
                <button type="button" className="secondary-button" onClick={() => void inspectDemo("suspicious")} disabled={Boolean(demoLoading)}>Inspect suspicious demo repository</button>
                <button type="button" className="text-button" onClick={() => void resetDemos()} disabled={Boolean(demoLoading)}>{demoLoading === "reset" ? "Resetting…" : "Reset demonstration state"}</button>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <section className="inspection-scope" aria-labelledby="scope-title">
        <header><h2 id="scope-title">One inspection, one decision</h2><p>Cordon moves from archive safety to static evidence and, with approval, controlled runtime observation.</p></header>
        <dl>
          <div><dt>Inspect</dt><dd>Fetch the exact commit, reject unsafe archive paths, and map executable behavior.</dd></div>
          <div><dt>Recommend</dt><dd>Select the safest useful quarantine operation from repository evidence.</dd></div>
          <div><dt>Observe</dt><dd>Record process, file, canary, and network behavior under fixed policy.</dd></div>
          <div><dt>Decide</dt><dd>Combine static and runtime evidence into one report with a concrete next action.</dd></div>
        </dl>
      </section>

      <section className="recent-scans" aria-labelledby="recent-title">
        <header><div><h2 id="recent-title">Recent inspections</h2><p>Resume active work or open the latest evidence-backed report.</p></div><span>{history.length} retained</span></header>
        {history.length ? (
          <div className="scan-table" role="table" aria-label="Recent repository inspections">
            <div className="scan-table__head" role="row"><span role="columnheader">Repository</span><span role="columnheader">Commit</span><span role="columnheader">Current stage</span><span role="columnheader">Verdict</span><span role="columnheader">Updated</span><span role="columnheader">Action</span></div>
            {history.map((item) => (
              <div className="scan-table__row" role="row" key={item.id}>
                <span role="cell" data-label="Repository"><strong>{item.owner}/{item.name}</strong><small>{item.source === "demo" ? "Demonstration repository" : item.owner}</small></span>
                <span role="cell" data-label="Commit" className="mono">{item.commitHash ? shortHash(item.commitHash) : "Pending"}</span>
                <span role="cell" data-label="Current stage">{currentStatus(item)}</span>
                <span role="cell" data-label="Verdict">{item.runtimeVerdict ? formatVerdict(item.runtimeVerdict === "inconclusive" ? "needs-review" : item.runtimeVerdict) : item.staticVerdict ? formatVerdict(item.staticVerdict) : "Pending"}</span>
                <span role="cell" data-label="Updated">{relativeTime(item.completedAt ?? item.updatedAt)}</span>
                <span role="cell" data-label="Action"><Link className="table-action" href={`/reports/${item.id}`}>{item.status === "completed" ? "View report" : "Resume inspection"}</Link></span>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state"><span aria-hidden="true" className="empty-state__mark">{"//"}</span><div><h3>No repository has been inspected.</h3><p>Your first inspection will appear here with its current stage, exact commit, and available verdicts.</p></div><a href="#repository-url">Inspect a repository</a></div>
        )}
      </section>
    </div>
  );
}
