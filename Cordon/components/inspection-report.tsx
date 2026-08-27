"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type { InspectionRecord } from "@/lib/inspection/types";
import { Report } from "@/components/report";

async function loadInspection(id: string): Promise<InspectionRecord> {
  const response = await fetch(`/api/scans/${id}`, { cache: "no-store" });
  const payload = await response.json() as { inspection?: InspectionRecord; error?: string };
  if (!response.ok || !payload.inspection) throw new Error(payload.error ?? "Cordon could not restore the inspection state.");
  return payload.inspection;
}

export function InspectionReport({ initialInspection }: { initialInspection: InspectionRecord }) {
  const [inspection, setInspection] = useState(initialInspection);
  const [connectionError, setConnectionError] = useState("");

  useEffect(() => {
    if (inspection.status !== "queued" && inspection.status !== "running") return;
    const timer = window.setTimeout(() => {
      void loadInspection(inspection.id)
        .then((next) => { setInspection(next); setConnectionError(""); })
        .catch((error) => setConnectionError(error instanceof Error ? error.message : "Cordon could not refresh this inspection."));
    }, 700);
    return () => window.clearTimeout(timer);
  }, [inspection]);

  if (inspection.scan) {
    return <Report scan={inspection.scan} recommendation={inspection.recommendation} initialRun={inspection.latestRun} inspectionFailure={inspection.error} />;
  }

  return (
    <article className="inspection-progress-page">
      <header className="inspection-progress-page__header">
        <div className="repository-state"><span className="progress-signal" aria-hidden="true" /> Repository inspection</div>
        <h1>{inspection.owner}/{inspection.name}</h1>
        <p>Cordon is building the static evidence report. You can leave this page and return to the same inspection.</p>
      </header>

      <section className="guided-progress" aria-labelledby="inspection-progress-title" aria-live="polite">
        <header><h2 id="inspection-progress-title">Inspection progress</h2><p>No repository code is executed during these stages.</p></header>
        <ol>
          {inspection.stages.map((stage) => (
            <li key={stage.id} data-state={stage.status} aria-current={stage.status === "active" ? "step" : undefined}>
              <span aria-hidden="true">{stage.status === "completed" ? "✓" : stage.status === "failed" ? "×" : stage.status === "active" ? "•" : ""}</span>
              <div><strong>{stage.label}</strong><small>{stage.status === "active" ? "In progress" : stage.status === "completed" ? "Completed" : stage.status === "failed" ? "Failed" : "Pending"}</small></div>
            </li>
          ))}
        </ol>
      </section>

      {inspection.error ? (
        <section className="recovery-panel" role="alert">
          <div><h2>{inspection.error.title}</h2><p>{inspection.error.message}</p></div>
          <dl><div><dt>What remains available</dt><dd>{inspection.error.staticAvailable ? "Completed static findings remain available." : "No repository code was executed."}</dd></div><div><dt>Can retry</dt><dd>{inspection.error.retryable ? "Yes. Start a new inspection from the dashboard." : "Not without changing the repository or configuration."}</dd></div></dl>
          {inspection.error.retryable ? <Link className="secondary-button" href={`/?repository=${encodeURIComponent(inspection.repositoryUrl)}`}>Inspect repository again</Link> : <Link className="secondary-button" href="/">Return to dashboard</Link>}
        </section>
      ) : null}

      {connectionError ? <p className="quarantine-error" role="alert">{connectionError} This page will retry while the inspection remains active.</p> : null}
    </article>
  );
}
