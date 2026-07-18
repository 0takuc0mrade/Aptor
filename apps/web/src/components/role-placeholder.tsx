import type { ReactNode } from "react";

type RoleWorkspaceProps = Readonly<{
  children: ReactNode;
  description: string;
  headline: string;
  privacyDetail: string;
  privacyStages: readonly [string, string, string];
  privacySummary: string;
  role: "Issuer" | "Professional" | "Verifier";
  status: string;
}>;

export function RoleWorkspace({
  children,
  description,
  headline,
  privacyDetail,
  privacyStages,
  privacySummary,
  role,
  status,
}: RoleWorkspaceProps) {
  const roleSequence = {
    Issuer: "01",
    Professional: "02",
    Verifier: "03",
  }[role];
  const currentStage = {
    Issuer: 0,
    Professional: 1,
    Verifier: 2,
  }[role];
  const trustPath = ["Issue", "Hold", "Verify"] as const;

  return (
    <article className="role-workspace" data-role={role.toLowerCase()}>
      <header className="role-hero">
        <p aria-hidden="true" className="role-hero__poster-word">
          {trustPath[currentStage]}
        </p>
        <div className="role-hero__identity">
          <p className="role-state">
            <span aria-hidden="true" className="role-state__marker" />
            {role} workspace
          </p>
          <h1>{headline}</h1>
          <span aria-hidden="true" className="redaction-mark">
            <i />
            <i />
            <i />
          </span>
          <p aria-hidden="true" className="role-hero__sequence">
            {roleSequence}
            <span>/03</span>
          </p>
        </div>

        <div className="role-hero__brief">
          <p>{description}</p>
          <div className="foundation-state" role="status">
            <strong>Browser workflow</strong>
            <span>{status}</span>
          </div>
        </div>

        <ol aria-label="Credential trust path" className="trust-path">
          {trustPath.map((stage, index) => (
            <li
              data-current={currentStage === index ? "true" : "false"}
              key={stage}
            >
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{stage}</strong>
            </li>
          ))}
        </ol>
      </header>

      <div className="role-canvas">{children}</div>

      <aside className="privacy-boundary" aria-labelledby="privacy-title">
        <div className="privacy-boundary__title">
          <span aria-hidden="true" className="privacy-boundary__marker" />
          <div>
            <p>Private by default</p>
            <h2 id="privacy-title">Privacy boundary</h2>
          </div>
        </div>
        <p className="privacy-boundary__summary">{privacySummary}</p>
        <p className="privacy-boundary__detail">{privacyDetail}</p>
        <ol className="privacy-path">
          {(["Local", "Proof", "Public"] as const).map((stage, index) => (
            <li key={stage}>
              <span>{stage}</span>
              <strong>{privacyStages[index]}</strong>
            </li>
          ))}
        </ol>
      </aside>
    </article>
  );
}

type PlannedActionProps = Readonly<{
  detail: string;
  label: string;
}>;

export function PlannedAction({ detail, label }: PlannedActionProps) {
  const descriptionId = `${label.toLowerCase().replaceAll(" ", "-")}-status`;

  return (
    <div className="planned-action">
      <button
        aria-describedby={descriptionId}
        className="action-button"
        disabled
        type="button"
      >
        {label}
      </button>
      <p id={descriptionId}>{detail}</p>
    </div>
  );
}

type WorkflowStep = Readonly<{
  detail: string;
  title: string;
}>;

type WorkflowSequenceProps = Readonly<{
  steps: readonly WorkflowStep[];
}>;

export function WorkflowSequence({ steps }: WorkflowSequenceProps) {
  return (
    <ol className="workflow-sequence">
      {steps.map((step, index) => (
        <li key={step.title}>
          <span className="workflow-sequence__index">
            {String(index + 1).padStart(2, "0")}
          </span>
          <div>
            <h3>{step.title}</h3>
            <p>{step.detail}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
