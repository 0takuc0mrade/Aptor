import type { Metadata } from "next";

import { PlannedAction, RoleWorkspace } from "@/components/role-placeholder";

export const metadata: Metadata = {
  title: "Verifier",
};

const requirements = [
  ["Required skill", "Exact skill match"],
  ["Minimum duration", "Month threshold"],
  ["Production delivery", "Required or omitted"],
  ["Minimum rating", "Bounded threshold"],
] as const;

export default function VerifierPage() {
  return (
    <RoleWorkspace
      description="Define only the requirements you need, send the bounded request, and inspect the returned verification result without opening the professional’s work history."
      headline="Ask for proof, not the project."
      privacyDetail="A pass confirms that an accepted issuer’s unmodified, unexpired credential satisfied the request. It does not establish that the issuer’s original statement was truthful."
      privacyStages={[
        "Bounded request",
        "Midnight verification",
        "Pass or fail only",
      ]}
      privacySummary="The result discloses pass or fail for requested conditions only."
      role="Verifier"
      status="Proof request creation and result verification are not connected yet."
    >
      <section
        className="requirement-builder"
        aria-labelledby="requirements-title"
      >
        <header className="section-heading">
          <div>
            <h2 id="requirements-title">Request requirements</h2>
            <p>Use supported conditions instead of open-ended policy text.</p>
          </div>
          <span className="section-heading__state">Draft empty</span>
        </header>

        <ul className="requirement-list">
          {requirements.map(([name, rule]) => (
            <li key={name}>
              <span aria-hidden="true" className="requirement-list__control" />
              <strong>{name}</strong>
              <span>{rule}</span>
            </li>
          ))}
        </ul>

        <PlannedAction
          detail="Available after proof request commitments are integrated."
          label="Create request"
        />
      </section>

      <section className="verification-results" aria-labelledby="results-title">
        <header className="section-heading section-heading--compact">
          <div>
            <h2 id="results-title">Verification results</h2>
            <p>Request-specific results will arrive here.</p>
          </div>
          <span className="section-heading__state">0 results</span>
        </header>

        <div className="empty-state empty-state--results">
          <span aria-hidden="true" className="empty-state__mark">
            —
          </span>
          <div>
            <h3>No proofs received</h3>
            <p>
              Create a request and wait for the professional to generate a
              request-bound proof.
            </p>
          </div>
        </div>
      </section>

      <section
        className="disclosure-contract"
        aria-labelledby="disclosure-title"
      >
        <header className="section-heading section-heading--compact">
          <div>
            <h2 id="disclosure-title">Result boundary</h2>
            <p>The verifier sees an answer, not the source credential.</p>
          </div>
        </header>

        <dl>
          <div>
            <dt>Disclosed</dt>
            <dd>Pass or fail for each requested condition</dd>
          </div>
          <div>
            <dt>Kept private</dt>
            <dd>Issuer identity, project details, and exact values</dd>
          </div>
        </dl>
      </section>
    </RoleWorkspace>
  );
}
