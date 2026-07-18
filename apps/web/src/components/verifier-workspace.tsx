"use client";

import {
  AptorBrowserContract,
  createBrowserProviders,
  createRequestDraft,
  downloadPortableFile,
  finalizeRequestDraftPackage,
  parseIssuerFile,
  parseRequestFile,
  portableRequestFieldsToContractRequest,
  queryPublicRequest,
  serializePortableFile,
  validateRequestPackage,
  type AptorIssuerProfileV1,
  type AptorProofRequestPackageV1,
} from "@aptor/browser";
import { useState } from "react";

import { useAptorWallet } from "@/hooks/use-aptor-wallet";
import {
  APTOR_CONTRACT_ADDRESS,
  APTOR_INDEXER_URL,
  APTOR_INDEXER_WS_URL,
  APTOR_NETWORK,
  APTOR_ZK_ARTIFACTS_URL,
  requireContractAddress,
} from "@/lib/midnight-config";

import { FileField } from "./file-field";
import { RoleWorkspace } from "./role-placeholder";
import { WalletPanel } from "./wallet-panel";

type RequestInput = Readonly<{
  requiredSkill: string;
  minimumDurationMonths?: number;
  requireProductionDelivery: boolean;
  minimumClientRatingHundredths?: number;
}>;

type RequestDraft = Readonly<{
  input: RequestInput;
  portable: ReturnType<typeof createRequestDraft>;
}>;

type RegistrationStage =
  | "idle"
  | "validating"
  | "waiting-wallet"
  | "proving"
  | "submitting"
  | "finalizing"
  | "success"
  | "failure";

type QueryResult = Readonly<{
  package: AptorProofRequestPackageV1 | null;
  requestId: string;
  registered: boolean;
  fulfilled: boolean;
  commitmentMatches: boolean;
}>;

export function VerifierWorkspace() {
  const wallet = useAptorWallet();
  const [issuers, setIssuers] = useState<AptorIssuerProfileV1[]>([]);
  const [draft, setDraft] = useState<RequestDraft | null>(null);
  const [registeredPackage, setRegisteredPackage] =
    useState<AptorProofRequestPackageV1 | null>(null);
  const [queryPackage, setQueryPackage] =
    useState<AptorProofRequestPackageV1 | null>(null);
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [durationEnabled, setDurationEnabled] = useState(false);
  const [ratingEnabled, setRatingEnabled] = useState(false);
  const [stage, setStage] = useState<RegistrationStage>("idle");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const resetRegistration = () => {
    setDraft(null);
    setRegisteredPackage(null);
    setStage("idle");
  };

  const registerRequest = async () => {
    if (draft === null || issuers.length === 0) {
      setError(
        "Import at least one issuer profile and review a request first.",
      );
      return;
    }
    setError("");
    setSuccess("");
    setRegisteredPackage(null);
    setStage("validating");
    try {
      const contractAddress = requireContractAddress();
      setStage("waiting-wallet");
      const connected = wallet.getConnected();
      setStage("proving");
      const { providers, privateStateProvider } = await createBrowserProviders(
        connected,
        APTOR_ZK_ARTIFACTS_URL,
      );
      try {
        const contract = await AptorBrowserContract.connect(
          providers,
          contractAddress,
          "public",
        );
        setStage("submitting");
        const registrationPromise = contract.registerRequest(
          portableRequestFieldsToContractRequest(draft.portable.request),
        );
        setStage("finalizing");
        const registration = await registrationPromise;
        const requestPackage = finalizeRequestDraftPackage(
          APTOR_NETWORK,
          contractAddress,
          issuers,
          draft.portable,
          registration.txId,
        );
        setRegisteredPackage(requestPackage);
        setStage("success");
        setSuccess(
          `Request registered in block ${registration.blockHeight}. Download the public package for the professional.`,
        );
      } finally {
        await privateStateProvider.dispose();
      }
    } catch (registrationError) {
      setStage("failure");
      setError(
        registrationError instanceof Error
          ? registrationError.message
          : "The request could not be registered.",
      );
    }
  };

  const inspectRequest = async (
    requestId: string,
    requestPackage: AptorProofRequestPackageV1 | null,
  ) => {
    setError("");
    setSuccess("");
    try {
      const contractAddress = requireContractAddress();
      const validated =
        requestPackage === null
          ? null
          : validateRequestPackage(requestPackage, {
              network: APTOR_NETWORK,
              contractAddress,
            });
      const result = await queryPublicRequest(
        {
          network: APTOR_NETWORK,
          indexerUrl: APTOR_INDEXER_URL,
          indexerWsUrl: APTOR_INDEXER_WS_URL,
          contractAddress,
        },
        requestId,
        validated?.requestCommitment,
      );
      setQueryResult({ package: validated, requestId, ...result });
    } catch (queryError) {
      setQueryResult(null);
      setError(
        queryError instanceof Error
          ? queryError.message
          : "Public request state could not be queried.",
      );
    }
  };

  return (
    <RoleWorkspace
      description="Choose accepted issuer keys, define one bounded request, register its commitment, and inspect the public fulfillment receipt without opening the professional’s credential."
      headline="Ask for proof, not the project."
      privacyDetail="A fulfilled receipt confirms that a valid signed credential from the accepted issuer set satisfied the registered criteria. It does not reveal which issuer or the credential’s exact values."
      privacyStages={[
        "Public criteria",
        "Midnight verification",
        "Fulfillment receipt",
      ]}
      privacySummary="The verifier receives a registered answer, not the source credential."
      role="Verifier"
      status={
        registeredPackage
          ? "One request package is ready to share."
          : `${issuers.length} accepted issuer profile${issuers.length === 1 ? "" : "s"} loaded.`
      }
    >
      <section className="verifier-studio" aria-labelledby="requirements-title">
        <header className="section-heading">
          <div>
            <h2 id="requirements-title">Create a proof request</h2>
            <p>
              Choose who you trust, define the minimum claim, then register one
              public request on Midnight.
            </p>
          </div>
          <span className="section-heading__state">
            {registeredPackage
              ? "Registered"
              : draft
                ? "Ready to register"
                : "Building request"}
          </span>
        </header>

        <ol className="verifier-steps" aria-label="Request progress">
          <li data-complete={issuers.length > 0}>
            <span>1</span>
            <div>
              <strong>Trust</strong>
              <small>
                {issuers.length || "No"} issuer key
                {issuers.length === 1 ? "" : "s"}
              </small>
            </div>
          </li>
          <li data-complete={draft !== null}>
            <span>2</span>
            <div>
              <strong>Ask</strong>
              <small>
                {draft ? draft.input.requiredSkill : "No criteria yet"}
              </small>
            </div>
          </li>
          <li data-complete={registeredPackage !== null}>
            <span>3</span>
            <div>
              <strong>Register</strong>
              <small>
                {registeredPackage ? "Ready to share" : "Not on-chain"}
              </small>
            </div>
          </li>
        </ol>

        <div className="verifier-studio__grid">
          <div className="verifier-compose">
            <div className="verifier-block">
              <div className="verifier-block__heading">
                <h3>Accepted issuers</h3>
                <span>{issuers.length}/32 keys</span>
              </div>
              <FileField
                accept="application/json,.aptor-issuer.json"
                help="The key is trusted for this request. Display names remain unverified metadata."
                label="Accepted issuer profile"
                onText={(text) => {
                  try {
                    const issuer = parseIssuerFile(text);
                    setIssuers((current) => [
                      ...current.filter(
                        (item) =>
                          item.issuerPublicKey !== issuer.issuerPublicKey,
                      ),
                      issuer,
                    ]);
                    resetRegistration();
                    setError("");
                  } catch (fileError) {
                    setError(
                      fileError instanceof Error
                        ? fileError.message
                        : "The issuer profile could not be imported.",
                    );
                  }
                }}
              />

              {issuers.length === 0 ? (
                <div className="request-empty verifier-empty">
                  <p>Start with a public issuer profile.</p>
                  <span>
                    No legal identity is inferred from its display name.
                  </span>
                </div>
              ) : (
                <ul className="record-list record-list--compact verifier-issuer-list">
                  {issuers.map((issuer) => (
                    <li key={issuer.issuerPublicKey}>
                      <div>
                        <strong>
                          {issuer.displayName ?? "Unnamed issuer"}
                        </strong>
                        <span className="mono-value">
                          {issuer.issuerPublicKey.slice(0, 26)}…
                        </span>
                      </div>
                      <button
                        className="text-button text-button--danger"
                        onClick={() => {
                          setIssuers((current) =>
                            current.filter(
                              (item) =>
                                item.issuerPublicKey !== issuer.issuerPublicKey,
                            ),
                          );
                          resetRegistration();
                        }}
                        type="button"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="verifier-block verifier-block--criteria">
              <div className="verifier-block__heading">
                <h3>Minimum claim</h3>
                <span>Public criteria</span>
              </div>
              <form
                className="form-stack verifier-criteria-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  setError("");
                  if (issuers.length === 0) {
                    setError(
                      "Import at least one accepted issuer profile first.",
                    );
                    return;
                  }
                  const data = new FormData(event.currentTarget);
                  const requiredSkill = String(
                    data.get("requiredSkill") ?? "",
                  ).trim();
                  const durationValue = String(
                    data.get("minimumDurationMonths") ?? "",
                  ).trim();
                  const ratingValue = String(
                    data.get("minimumRating") ?? "",
                  ).trim();
                  if (durationEnabled && durationValue === "") {
                    setError("Enter the minimum duration in whole months.");
                    return;
                  }
                  if (ratingEnabled && ratingValue === "") {
                    setError("Enter the minimum client rating.");
                    return;
                  }
                  const input: RequestInput = {
                    requiredSkill,
                    ...(durationEnabled
                      ? { minimumDurationMonths: Number(durationValue) }
                      : {}),
                    requireProductionDelivery: data.get("production") === "on",
                    ...(ratingEnabled
                      ? {
                          minimumClientRatingHundredths: Math.round(
                            Number(ratingValue) * 100,
                          ),
                        }
                      : {}),
                  };
                  try {
                    setDraft({
                      input,
                      portable: createRequestDraft({
                        acceptedIssuerProfiles: issuers,
                        ...input,
                      }),
                    });
                    setRegisteredPackage(null);
                    setStage("idle");
                  } catch (draftError) {
                    setError(
                      draftError instanceof Error
                        ? draftError.message
                        : "The request draft is invalid.",
                    );
                  }
                }}
              >
                <label className="field verifier-skill-field">
                  <span>Required skill</span>
                  <input name="requiredSkill" required type="text" />
                </label>
                <div className="verifier-options">
                  <div className="optional-requirement">
                    <label className="check-field">
                      <input
                        checked={durationEnabled}
                        name="checkDuration"
                        onChange={(event) =>
                          setDurationEnabled(event.target.checked)
                        }
                        type="checkbox"
                      />
                      <span>Minimum duration</span>
                    </label>
                    <label className="field">
                      <span>Months</span>
                      <input
                        disabled={!durationEnabled}
                        inputMode="numeric"
                        max={65_535}
                        min={0}
                        name="minimumDurationMonths"
                        required={durationEnabled}
                        step={1}
                        type="number"
                      />
                    </label>
                  </div>
                  <div className="optional-requirement">
                    <label className="check-field">
                      <input
                        checked={ratingEnabled}
                        name="checkRating"
                        onChange={(event) =>
                          setRatingEnabled(event.target.checked)
                        }
                        type="checkbox"
                      />
                      <span>Minimum rating</span>
                    </label>
                    <label className="field">
                      <span>Rating / 5.00</span>
                      <input
                        disabled={!ratingEnabled}
                        inputMode="decimal"
                        max={5}
                        min={0}
                        name="minimumRating"
                        required={ratingEnabled}
                        step={0.01}
                        type="number"
                      />
                    </label>
                  </div>
                </div>
                <label className="check-field verifier-production-check">
                  <input name="production" type="checkbox" />
                  <span>Require production delivery</span>
                </label>
                <button className="action-button" type="submit">
                  Review public request
                </button>
              </form>
            </div>
          </div>

          <aside className="verifier-register" aria-label="Register request">
            <div className="verifier-register__heading">
              <span>Registration desk</span>
              <h3>Complete public request</h3>
              <p>
                Review exactly what will be committed before using a wallet.
              </p>
            </div>

            {draft ? (
              <dl className="verifier-request-summary">
                <div>
                  <dt>Skill</dt>
                  <dd>{draft.input.requiredSkill}</dd>
                </div>
                <div>
                  <dt>Duration</dt>
                  <dd>
                    {draft.input.minimumDurationMonths === undefined
                      ? "Not checked"
                      : `${draft.input.minimumDurationMonths}+ months`}
                  </dd>
                </div>
                <div>
                  <dt>Production</dt>
                  <dd>
                    {draft.input.requireProductionDelivery
                      ? "Required"
                      : "Not checked"}
                  </dd>
                </div>
                <div>
                  <dt>Rating</dt>
                  <dd>
                    {draft.input.minimumClientRatingHundredths === undefined
                      ? "Not checked"
                      : `${(draft.input.minimumClientRatingHundredths / 100).toFixed(2)}+`}
                  </dd>
                </div>
                <div>
                  <dt>Issuer keys</dt>
                  <dd>{issuers.length}</dd>
                </div>
                <div>
                  <dt>Commitment</dt>
                  <dd className="mono-value">
                    {draft.portable.requestCommitment}
                  </dd>
                </div>
              </dl>
            ) : (
              <div className="request-empty verifier-register__empty">
                <p>No reviewed request yet.</p>
                <span>Complete the two blocks on the left first.</span>
              </div>
            )}

            <WalletPanel wallet={wallet} />

            <button
              className="action-button verifier-register__action"
              disabled={
                draft === null ||
                wallet.status !== "connected" ||
                !["idle", "failure"].includes(stage)
              }
              onClick={() => void registerRequest()}
              type="button"
            >
              {stage === "proving" || stage === "finalizing"
                ? "Registering request…"
                : "Register request on Midnight"}
            </button>
            <div className="action-progress" data-stage={stage} role="status">
              <span>{stage.replaceAll("-", " ")}</span>
              <p>
                {stage === "idle" && wallet.status !== "connected"
                  ? "Connect a wallet to enable registration."
                  : stage === "idle"
                    ? "The reviewed request is ready to register."
                    : stage === "success"
                      ? "Finalized. Share the request package with the professional."
                      : stage === "failure"
                        ? "Registration stopped safely. Review the message below and retry."
                        : "Aptor is processing the real Midnight transaction."}
              </p>
            </div>

            {registeredPackage ? (
              <div className="package-actions verifier-package-actions">
                <button
                  className="action-button"
                  onClick={() =>
                    downloadPortableFile(
                      `${registeredPackage.request.requestId.slice(0, 12)}.aptor-request.json`,
                      serializePortableFile(registeredPackage),
                    )
                  }
                  type="button"
                >
                  Download request package
                </button>
                <button
                  className="text-button"
                  onClick={() =>
                    void navigator.clipboard.writeText(
                      serializePortableFile(registeredPackage),
                    )
                  }
                  type="button"
                >
                  Copy request JSON
                </button>
              </div>
            ) : null}
          </aside>
        </div>
      </section>

      <section className="verification-results" aria-labelledby="results-title">
        <header className="section-heading">
          <div>
            <h2 id="results-title">Inspect a receipt</h2>
            <p>
              A request package shows its criteria; a request ID checks only
              registration and fulfillment.
            </p>
          </div>
          <span className="section-heading__state">Public lookup</span>
        </header>

        <div className="verifier-query-grid">
          <div className="verifier-query-controls">
            <FileField
              accept="application/json,.aptor-request.json"
              help="Use a package to also validate its commitment and display its public criteria."
              label="Aptor request package"
              onText={(text) => {
                try {
                  const parsed = parseRequestFile(text);
                  setQueryPackage(parsed);
                  setQueryResult(null);
                  setError("");
                } catch (fileError) {
                  setQueryPackage(null);
                  setQueryResult(null);
                  setError(
                    fileError instanceof Error
                      ? fileError.message
                      : "The request package could not be read.",
                  );
                }
              }}
            />
            <div className="verifier-query-divider">
              <span>or</span>
            </div>
            <form
              className="form-stack"
              onSubmit={(event) => {
                event.preventDefault();
                const requestId = String(
                  new FormData(event.currentTarget).get("requestId") ?? "",
                ).trim();
                const effectiveId =
                  queryPackage?.request.requestId || requestId;
                if (!/^[0-9a-f]{64}$/u.test(effectiveId)) {
                  setError(
                    "Request ID must be exactly 32 bytes of lowercase hex.",
                  );
                  return;
                }
                void inspectRequest(effectiveId, queryPackage);
              }}
            >
              <label className="field">
                <span>Request ID</span>
                <input
                  defaultValue={queryPackage?.request.requestId ?? ""}
                  key={queryPackage?.request.requestId ?? "empty"}
                  name="requestId"
                  pattern="[0-9a-f]{64}"
                  placeholder="64 lowercase hex characters"
                  type="text"
                />
              </label>
              <button className="action-button" type="submit">
                Query public state
              </button>
            </form>
          </div>

          <div className="verifier-query-outcome">
            {queryResult ? (
              <div
                className="verification-card"
                data-fulfilled={queryResult.fulfilled}
              >
                <span className="eyebrow">
                  {!queryResult.registered
                    ? "Request not found"
                    : !queryResult.commitmentMatches
                      ? "Commitment mismatch"
                      : queryResult.fulfilled
                        ? "Request fulfilled"
                        : "Request pending"}
                </span>
                <h3>
                  {queryResult.fulfilled
                    ? "This registered request was satisfied by a valid Aptor credential from an issuer in the accepted issuer set."
                    : queryResult.registered
                      ? "This request is registered and has not been fulfilled."
                      : "No registered request was found at this ID."}
                </h3>
                <dl className="receipt-card">
                  <div>
                    <dt>Network</dt>
                    <dd>{APTOR_NETWORK}</dd>
                  </div>
                  <div>
                    <dt>Contract</dt>
                    <dd className="mono-value">
                      {APTOR_CONTRACT_ADDRESS || "Not configured"}
                    </dd>
                  </div>
                  <div>
                    <dt>Request ID</dt>
                    <dd className="mono-value">{queryResult.requestId}</dd>
                  </div>
                  <div>
                    <dt>Registration transaction</dt>
                    <dd className="mono-value">
                      {queryResult.package?.registrationTransactionId ??
                        "Not supplied"}
                    </dd>
                  </div>
                  <div>
                    <dt>Fulfillment transaction</dt>
                    <dd>Not exposed by current public receipt state</dd>
                  </div>
                  {queryResult.package ? (
                    <div>
                      <dt>Criteria</dt>
                      <dd>
                        {queryResult.package.request.requiredSkill}
                        {queryResult.package.request.checkDuration
                          ? ` · ${queryResult.package.request.minimumDurationMonths}+ months`
                          : ""}
                        {queryResult.package.request.requireProductionDelivery
                          ? " · production"
                          : ""}
                        {queryResult.package.request.checkClientRating
                          ? ` · ${(queryResult.package.request.minimumClientRatingHundredths / 100).toFixed(2)}+ rating`
                          : ""}
                      </dd>
                    </div>
                  ) : null}
                </dl>
              </div>
            ) : (
              <div className="verifier-query-placeholder">
                <span aria-hidden="true">?</span>
                <div>
                  <h3>No receipt inspected</h3>
                  <p>
                    Import a public request package or enter its request ID.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="verifier-boundary" aria-labelledby="disclosure-title">
          <div>
            <h3 id="disclosure-title">What the result means</h3>
            <p>The receipt proves satisfaction, not provenance details.</p>
          </div>
          <dl>
            <div>
              <dt>Public</dt>
              <dd>
                Criteria, issuer-set root, request commitment, and fulfillment
                status
              </dd>
            </div>
            <div>
              <dt>Private</dt>
              <dd>
                Selected issuer, credential, exact values, holder secret,
                signature, and Merkle paths
              </dd>
            </div>
          </dl>
        </div>
      </section>

      {error ? (
        <p
          className="workspace-message form-message form-message--error"
          role="alert"
        >
          {error}
        </p>
      ) : null}
      {success ? (
        <p
          className="workspace-message form-message form-message--success"
          role="status"
        >
          {success}
        </p>
      ) : null}
      {!APTOR_CONTRACT_ADDRESS ? (
        <p className="workspace-message form-message form-message--warning">
          Request registration and querying require
          NEXT_PUBLIC_APTOR_CONTRACT_ADDRESS.
        </p>
      ) : null}
    </RoleWorkspace>
  );
}
