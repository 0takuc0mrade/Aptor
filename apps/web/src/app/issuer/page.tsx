import type { Metadata } from "next";

import {
  PlannedAction,
  RoleWorkspace,
  WorkflowSequence,
} from "@/components/role-placeholder";

export const metadata: Metadata = {
  title: "Issuer",
};

const credentialFields = [
  ["Holder", "Private identifier"],
  ["Work", "Category and skills"],
  ["Delivery", "Duration and production status"],
  ["Assessment", "Client rating"],
  ["Validity", "Issued and expiry dates"],
] as const;

export default function IssuerPage() {
  return (
    <RoleWorkspace
      description="Create a bounded credential, review exactly what it attests to, then authorize it for a professional. The underlying project stays out of public state."
      headline="Issue work without exposing it."
      privacyDetail="The professional receives the signed private credential. Public state should contain only the minimum issuer trust material or commitment required by the Compact contract."
      privacyStages={[
        "Private attributes",
        "Credential checks",
        "Issuer commitment",
      ]}
      privacySummary="Credential attributes remain between the issuer and professional."
      role="Issuer"
      status="Credential signing and delivery are not connected yet."
    >
      <section className="issuer-flow" aria-labelledby="issuer-flow-title">
        <header className="section-heading">
          <div>
            <h2 id="issuer-flow-title">Credential issue flow</h2>
            <p>Three explicit checks before anything is authorized.</p>
          </div>
          <span className="section-heading__state">No draft</span>
        </header>

        <WorkflowSequence
          steps={[
            {
              title: "Create",
              detail:
                "Enter bounded work attributes for the intended professional.",
            },
            {
              title: "Review",
              detail:
                "Confirm the holder, validity window, and exact private claims.",
            },
            {
              title: "Issue",
              detail:
                "Sign the credential commitment and deliver the private payload.",
            },
          ]}
        />
      </section>

      <section
        className="issuer-review"
        aria-labelledby="credential-review-title"
      >
        <header className="section-heading section-heading--compact">
          <div>
            <h2 id="credential-review-title">Credential review</h2>
            <p>The review surface appears after a private draft exists.</p>
          </div>
        </header>

        <dl className="credential-spec">
          {credentialFields.map(([term, detail]) => (
            <div key={term}>
              <dt>{term}</dt>
              <dd>{detail}</dd>
              <span>Private input</span>
            </div>
          ))}
        </dl>

        <PlannedAction
          detail="Available after credential signing is integrated."
          label="Create credential"
        />
      </section>
    </RoleWorkspace>
  );
}
