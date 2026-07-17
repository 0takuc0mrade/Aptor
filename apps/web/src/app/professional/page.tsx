import type { Metadata } from "next";

import {
  PlannedAction,
  RoleWorkspace,
  WorkflowSequence,
} from "@/components/role-placeholder";

export const metadata: Metadata = {
  title: "Professional",
};

export default function ProfessionalPage() {
  return (
    <RoleWorkspace
      description="Keep credentials locally, inspect bounded proof requests, and choose what to prove. A verifier receives only request-specific results."
      headline="Turn private work into proof."
      privacyDetail="A selected credential enters the local proof flow. Exact ratings, client identities, project names, repositories, and internal metrics are never shown to the verifier."
      privacyStages={[
        "Local credential",
        "Requested conditions",
        "Proof result",
      ]}
      privacySummary="Raw credentials stay local to the professional."
      role="Professional"
      status="Private storage and proof generation are not connected yet."
    >
      <section className="credential-vault" aria-labelledby="vault-title">
        <header className="section-heading">
          <div>
            <h2 id="vault-title">Credential vault</h2>
            <p>Private credentials available for request matching.</p>
          </div>
          <span className="section-heading__state">0 credentials</span>
        </header>

        <div className="empty-state">
          <span aria-hidden="true" className="empty-state__mark">
            —
          </span>
          <div>
            <h3>No credentials yet</h3>
            <p>
              An issuer-authorized credential will appear here after private
              delivery is connected.
            </p>
          </div>
        </div>

        <PlannedAction
          detail="Available after private credential storage is integrated."
          label="Receive credential"
        />
      </section>

      <section className="request-inbox" aria-labelledby="request-title">
        <header className="section-heading section-heading--compact">
          <div>
            <h2 id="request-title">Proof requests</h2>
            <p>Review the conditions before selecting a credential.</p>
          </div>
          <span className="section-heading__state">Inbox empty</span>
        </header>

        <div className="request-empty">
          <p>No proof requests have been received.</p>
          <span>Nothing is being shared.</span>
        </div>
      </section>

      <section className="proof-readiness" aria-labelledby="proof-title">
        <header className="section-heading section-heading--compact">
          <div>
            <h2 id="proof-title">Proof readiness</h2>
            <p>Both inputs must be present before generation can begin.</p>
          </div>
        </header>

        <WorkflowSequence
          steps={[
            {
              title: "Select credential",
              detail: "A private credential is required.",
            },
            {
              title: "Review request",
              detail: "The requested conditions are shown before proving.",
            },
            {
              title: "Generate proof",
              detail: "Midnight checks only the bounded requirements.",
            },
          ]}
        />

        <PlannedAction
          detail="Requires one credential and one proof request."
          label="Generate proof"
        />
      </section>
    </RoleWorkspace>
  );
}
