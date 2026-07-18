"use client";

import {
  AptorBrowserContract,
  createBrowserProviders,
  createRequestDraft,
  downloadPortableFile,
  encryptEnvelopePayload,
  finalizeRequestDraftPackage,
  parseIssuerFile,
  portableRequestFieldsToContractRequest,
  queryPublicRequest,
  serializePortableFile,
  type AptorProofRequestPackageV1,
} from "@aptor/browser";
import type { AptorProfileV1, AptorRequestTrackingV1 } from "@aptor/shared";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useAptorWallet } from "@/hooks/use-aptor-wallet";
import {
  APTOR_CONTRACT_ADDRESS,
  APTOR_INDEXER_URL,
  APTOR_INDEXER_WS_URL,
  APTOR_NETWORK,
  APTOR_ZK_ARTIFACTS_URL,
  requireContractAddress,
} from "@/lib/midnight-config";
import {
  createRequestTracking,
  getPublicProfile,
  listRequestTracking,
  sendEnvelope,
  updateRequestTracking,
} from "@/lib/delivery-client";

import { useAptorAccount } from "./account-provider";
import { FileField } from "./file-field";
import { AccountToolbar, ProfileAccess } from "./profile-access";
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
  | "delivering"
  | "success"
  | "failure";

export function VerifierWorkspace() {
  const account = useAptorAccount();
  const accountValue = account.value;
  const refreshAccountNotifications = account.refreshNotifications;
  const wallet = useAptorWallet();
  const pollingStartedAt = useRef(0);
  const [professional, setProfessional] = useState<AptorProfileV1 | null>(null);
  const [draft, setDraft] = useState<RequestDraft | null>(null);
  const [registeredPackage, setRegisteredPackage] =
    useState<AptorProofRequestPackageV1 | null>(null);
  const [tracking, setTracking] = useState<AptorRequestTrackingV1[]>([]);
  const [durationEnabled, setDurationEnabled] = useState(false);
  const [ratingEnabled, setRatingEnabled] = useState(false);
  const [stage, setStage] = useState<RegistrationStage>("idle");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const trustedProfiles = useMemo(
    () => accountValue?.verifier.trustedProfiles ?? [],
    [accountValue],
  );
  const issuerProfiles = useMemo(
    () => trustedProfiles.map((profile) => profile.issuerProfile),
    [trustedProfiles],
  );

  const refreshStatuses = useCallback(async () => {
    if (accountValue === null) return;
    const token = accountValue.privateProfile.accessToken;
    await listRequestTracking(token);
    const active = accountValue.verifier.activeRequests;
    const contractAddress = APTOR_CONTRACT_ADDRESS;
    if (contractAddress) {
      for (const item of active) {
        const state = await queryPublicRequest(
          {
            network: APTOR_NETWORK,
            indexerUrl: APTOR_INDEXER_URL,
            indexerWsUrl: APTOR_INDEXER_WS_URL,
            contractAddress,
          },
          item.request.request.requestId,
          item.request.requestCommitment,
        );
        if (state.fulfilled && state.commitmentMatches) {
          await updateRequestTracking(token, item.request.request.requestId, {
            status: "fulfilled",
          });
        }
      }
    }
    setTracking(await listRequestTracking(token));
    await refreshAccountNotifications();
  }, [accountValue, refreshAccountNotifications]);

  useEffect(() => {
    if (
      accountValue === null ||
      accountValue.verifier.activeRequests.length === 0
    )
      return;
    pollingStartedAt.current = Date.now();
    let timeout = 0;
    let failures = 0;
    let cancelled = false;
    const poll = async () => {
      if (cancelled || Date.now() - pollingStartedAt.current > 10 * 60 * 1_000)
        return;
      try {
        await refreshStatuses();
        failures = 0;
      } catch {
        failures += 1;
      }
      if (!cancelled) {
        timeout = window.setTimeout(
          poll,
          Math.min(30_000, 6_000 * 2 ** failures),
        );
      }
    };
    const onFocus = () => void refreshStatuses().catch(() => undefined);
    window.addEventListener("focus", onFocus);
    void poll();
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      window.removeEventListener("focus", onFocus);
    };
  }, [accountValue, refreshStatuses]);

  const addTrustedProfile = async (handle: string) => {
    if (account.value === null) return;
    const profile = await getPublicProfile(handle);
    await account.save({
      ...account.value,
      verifier: {
        ...account.value.verifier,
        trustedProfiles: [
          ...account.value.verifier.trustedProfiles.filter(
            (item) => item.profileId !== profile.profileId,
          ),
          profile,
        ],
      },
    });
  };

  const registerAndSend = async () => {
    if (
      account.value === null ||
      professional === null ||
      draft === null ||
      issuerProfiles.length === 0
    ) {
      setError(
        "Choose a Professional, trust at least one Issuer, and review the request first.",
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
          issuerProfiles,
          draft.portable,
          registration.txId,
        );
        setStage("delivering");
        await createRequestTracking(account.value.privateProfile.accessToken, {
          requestId: requestPackage.request.requestId,
          verifierProfileId: account.value.profile.profileId,
          professionalProfileId: professional.profileId,
          contractAddress,
          networkId: APTOR_NETWORK,
          registrationTransactionId: registration.txId,
        });
        const envelope = await encryptEnvelopePayload(
          requestPackage,
          account.value.profile.profileId,
          professional.profileId,
          "proof_request",
          professional.publicEncryptionKey,
        );
        const delivered = await sendEnvelope(
          account.value.privateProfile.accessToken,
          envelope,
        );
        await account.save({
          ...account.value,
          verifier: {
            ...account.value.verifier,
            activeRequests: [
              ...account.value.verifier.activeRequests.filter(
                (item) =>
                  item.request.request.requestId !==
                  requestPackage.request.requestId,
              ),
              {
                professionalProfileId: professional.profileId,
                professionalHandle: professional.handle,
                request: requestPackage,
                envelopeId: delivered.envelopeId,
              },
            ],
          },
        });
        setRegisteredPackage(requestPackage);
        setStage("success");
        setSuccess(
          `Request registered in block ${registration.blockHeight} and sent to @${professional.handle}.`,
        );
        await refreshStatuses();
      } finally {
        await privateStateProvider.dispose();
      }
    } catch (registrationError) {
      setStage("failure");
      setError(
        registrationError instanceof Error
          ? registrationError.message
          : "The request could not be registered and delivered.",
      );
    }
  };

  return (
    <RoleWorkspace
      description="Trust Aptor Issuer profiles, select a Professional, register bounded requirements on Midnight, send the request, and monitor fulfillment automatically."
      headline="Ask for proof, not the project."
      privacyDetail="The delivery service routes an encrypted request and caches public status. Midnight contract state remains authoritative; the Verifier never receives the source credential."
      privacyStages={[
        "Public criteria",
        "Midnight verification",
        "Automatic receipt",
      ]}
      privacySummary="The Verifier receives a registered answer, not the Professional's credential."
      role="Verifier"
      status={
        account.value
          ? `${trustedProfiles.length} trusted Issuer profile${trustedProfiles.length === 1 ? "" : "s"} · ${account.value.verifier.activeRequests.length} active request${account.value.verifier.activeRequests.length === 1 ? "" : "s"}`
          : "Unlock the shared Aptor profile to create and monitor requests."
      }
    >
      {account.value === null ? (
        <ProfileAccess />
      ) : (
        <>
          <section
            className="verifier-studio"
            aria-labelledby="requirements-title"
          >
            <header className="section-heading">
              <div>
                <h2 id="requirements-title">Create proof request</h2>
                <p>
                  Choose who you trust, who should answer, and the minimum
                  public claim.
                </p>
              </div>
              <span className="section-heading__state">
                @{account.value.profile.handle}
              </span>
            </header>

            <ol className="verifier-steps" aria-label="Request progress">
              <li data-complete={issuerProfiles.length > 0}>
                <span>1</span>
                <div>
                  <strong>Trust</strong>
                  <small>
                    {issuerProfiles.length || "No"} Issuer profile
                    {issuerProfiles.length === 1 ? "" : "s"}
                  </small>
                </div>
              </li>
              <li data-complete={professional !== null}>
                <span>2</span>
                <div>
                  <strong>Route</strong>
                  <small>
                    {professional
                      ? `@${professional.handle}`
                      : "No Professional"}
                  </small>
                </div>
              </li>
              <li data-complete={draft !== null}>
                <span>3</span>
                <div>
                  <strong>Ask</strong>
                  <small>
                    {draft ? draft.input.requiredSkill : "No criteria yet"}
                  </small>
                </div>
              </li>
              <li data-complete={registeredPackage !== null}>
                <span>4</span>
                <div>
                  <strong>Send</strong>
                  <small>
                    {registeredPackage ? "Delivered" : "Not registered"}
                  </small>
                </div>
              </li>
            </ol>

            <div className="verifier-studio__grid">
              <div className="verifier-compose">
                <div className="verifier-block">
                  <div className="verifier-block__heading">
                    <h3>Trusted Issuers</h3>
                    <span>{issuerProfiles.length}/32 profiles</span>
                  </div>
                  <form
                    className="form-stack inline-lookup"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const form = event.currentTarget;
                      const handle = String(
                        new FormData(form).get("issuerHandle") ?? "",
                      );
                      setError("");
                      void addTrustedProfile(handle)
                        .then(() => form.reset())
                        .catch((lookupError: unknown) =>
                          setError(
                            lookupError instanceof Error
                              ? lookupError.message
                              : "The Issuer profile could not be added.",
                          ),
                        );
                    }}
                  >
                    <label className="field">
                      <span>Issuer Aptor handle</span>
                      <input
                        autoCapitalize="none"
                        name="issuerHandle"
                        placeholder="northstar-studio"
                        required
                        type="text"
                      />
                    </label>
                    <button
                      className="action-button action-button--secondary"
                      type="submit"
                    >
                      Add trusted Issuer
                    </button>
                  </form>
                  {trustedProfiles.length === 0 ? (
                    <div className="request-empty verifier-empty">
                      <p>Add an Issuer by Aptor handle.</p>
                      <span>
                        Display names are public metadata, not verified legal
                        identities.
                      </span>
                    </div>
                  ) : (
                    <ul className="record-list record-list--compact verifier-issuer-list">
                      {trustedProfiles.map((profile) => (
                        <li key={profile.profileId}>
                          <div>
                            <strong>{profile.displayName}</strong>
                            <span>
                              @{profile.handle} · Credential issued by this
                              Aptor profile
                            </span>
                          </div>
                          <button
                            className="text-button text-button--danger"
                            onClick={() =>
                              void account.save({
                                ...account.value!,
                                verifier: {
                                  ...account.value!.verifier,
                                  trustedProfiles:
                                    account.value!.verifier.trustedProfiles.filter(
                                      (item) =>
                                        item.profileId !== profile.profileId,
                                    ),
                                },
                              })
                            }
                            type="button"
                          >
                            Remove
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="verifier-block">
                  <div className="verifier-block__heading">
                    <h3>Professional</h3>
                    <span>Encrypted recipient</span>
                  </div>
                  <form
                    className="form-stack inline-lookup"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const form = event.currentTarget;
                      setError("");
                      void getPublicProfile(
                        String(
                          new FormData(form).get("professionalHandle") ?? "",
                        ),
                      )
                        .then((profile) => {
                          setProfessional(profile);
                          form.reset();
                        })
                        .catch((lookupError: unknown) =>
                          setError(
                            lookupError instanceof Error
                              ? lookupError.message
                              : "The Professional was not found.",
                          ),
                        );
                    }}
                  >
                    <label className="field">
                      <span>Professional Aptor handle</span>
                      <input
                        autoCapitalize="none"
                        name="professionalHandle"
                        placeholder="maya-chen"
                        required
                        type="text"
                      />
                    </label>
                    <button
                      className="action-button action-button--secondary"
                      type="submit"
                    >
                      Select Professional
                    </button>
                  </form>
                  {professional ? (
                    <p className="import-state">
                      <strong>{professional.displayName}</strong> · @
                      {professional.handle}
                    </p>
                  ) : null}
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
                      if (
                        issuerProfiles.length === 0 ||
                        professional === null
                      ) {
                        setError(
                          "Add an Issuer and select a Professional first.",
                        );
                        return;
                      }
                      const data = new FormData(event.currentTarget);
                      const input: RequestInput = {
                        requiredSkill: String(
                          data.get("requiredSkill") ?? "",
                        ).trim(),
                        ...(durationEnabled
                          ? {
                              minimumDurationMonths: Number(
                                data.get("minimumDurationMonths"),
                              ),
                            }
                          : {}),
                        requireProductionDelivery:
                          data.get("production") === "on",
                        ...(ratingEnabled
                          ? {
                              minimumClientRatingHundredths: Math.round(
                                Number(data.get("minimumRating")) * 100,
                              ),
                            }
                          : {}),
                      };
                      try {
                        setDraft({
                          input,
                          portable: createRequestDraft({
                            acceptedIssuerProfiles: issuerProfiles,
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

              <aside
                className="verifier-register"
                aria-label="Register and send request"
              >
                <div className="verifier-register__heading">
                  <span>Registration desk</span>
                  <h3>Register and send</h3>
                  <p>
                    Wallet approval is requested only for the Midnight
                    registration.
                  </p>
                </div>
                {draft ? (
                  <dl className="verifier-request-summary">
                    <div>
                      <dt>Professional</dt>
                      <dd>
                        {professional
                          ? `@${professional.handle}`
                          : "Not selected"}
                      </dd>
                    </div>
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
                      <dt>Issuer profiles</dt>
                      <dd>{issuerProfiles.length}</dd>
                    </div>
                  </dl>
                ) : (
                  <div className="request-empty verifier-register__empty">
                    <p>No reviewed request yet.</p>
                    <span>Complete the workflow blocks first.</span>
                  </div>
                )}
                <WalletPanel wallet={wallet} />
                <button
                  className="action-button verifier-register__action"
                  disabled={
                    draft === null ||
                    professional === null ||
                    wallet.status !== "connected" ||
                    !["idle", "failure"].includes(stage)
                  }
                  onClick={() => void registerAndSend()}
                  type="button"
                >
                  {["proving", "submitting", "finalizing"].includes(stage)
                    ? "Registering request…"
                    : stage === "delivering"
                      ? "Encrypting delivery…"
                      : "Register and send request"}
                </button>
                <div
                  className="action-progress"
                  data-stage={stage}
                  role="status"
                >
                  <span>{stage.replaceAll("-", " ")}</span>
                  <p>
                    {stage === "idle" && wallet.status !== "connected"
                      ? "Connect a wallet to enable registration."
                      : stage === "idle"
                        ? "The reviewed request is ready."
                        : stage === "success"
                          ? "Finalized and delivered to the Professional inbox."
                          : stage === "failure"
                            ? "The flow stopped safely. Review the message and retry."
                            : "Aptor is processing the real Midnight transaction and encrypted delivery."}
                  </p>
                </div>
              </aside>
            </div>
            <AccountToolbar />
          </section>

          <section
            className="verification-results"
            aria-labelledby="results-title"
          >
            <header className="section-heading">
              <div>
                <h2 id="results-title">Monitor verification status</h2>
                <p>
                  Chain state refreshes while this dashboard is open and when
                  the window regains focus.
                </p>
              </div>
              <button
                className="text-button"
                onClick={() =>
                  void refreshStatuses().catch((statusError: unknown) =>
                    setError(
                      statusError instanceof Error
                        ? statusError.message
                        : "Status refresh failed.",
                    ),
                  )
                }
                type="button"
              >
                Retry status refresh
              </button>
            </header>
            {account.value.verifier.activeRequests.length === 0 ? (
              <div className="verifier-query-placeholder">
                <span aria-hidden="true">?</span>
                <div>
                  <h3>No active requests</h3>
                  <p>
                    Create and send a registered request to begin monitoring.
                  </p>
                </div>
              </div>
            ) : (
              <ul className="active-request-list">
                {account.value.verifier.activeRequests.map((item) => {
                  const status = tracking.find(
                    (entry) =>
                      entry.requestId === item.request.request.requestId,
                  );
                  const label =
                    status?.publicStatus === "fulfilled"
                      ? "Request fulfilled"
                      : status?.publicStatus === "proof_submitted"
                        ? "Proof submitted"
                        : "Registered — awaiting proof";
                  return (
                    <li
                      key={item.request.request.requestId}
                      data-status={status?.publicStatus ?? "registered"}
                    >
                      <div>
                        <span
                          className="request-status-dot"
                          aria-hidden="true"
                        />
                        <strong>{label}</strong>
                        <p>
                          {item.request.request.requiredSkill} · @
                          {item.professionalHandle}
                        </p>
                      </div>
                      <dl>
                        <div>
                          <dt>Registration</dt>
                          <dd className="mono-value">
                            {item.request.registrationTransactionId}
                          </dd>
                        </div>
                        <div>
                          <dt>Fulfillment</dt>
                          <dd className="mono-value">
                            {status?.fulfillmentTransactionId ??
                              "Waiting for proof"}
                          </dd>
                        </div>
                      </dl>
                    </li>
                  );
                })}
              </ul>
            )}
            <div className="verifier-boundary">
              <div>
                <h3>What a fulfilled result means</h3>
                <p>
                  All enabled criteria were satisfied by a signed credential
                  from the accepted Issuer set.
                </p>
              </div>
              <dl>
                <div>
                  <dt>Public</dt>
                  <dd>
                    Criteria, issuer-set root, request commitment, and
                    fulfillment status
                  </dd>
                </div>
                <div>
                  <dt>Private</dt>
                  <dd>
                    Selected Issuer, credential, exact values, holder secret,
                    signature, and Merkle paths
                  </dd>
                </div>
              </dl>
            </div>
          </section>

          <details className="advanced-panel portable-panel">
            <summary>Advanced · Portable backup, import, or export</summary>
            <div className="portable-grid">
              <div className="import-panel">
                <h3>Import Issuer profile</h3>
                <FileField
                  accept="application/json,.aptor-issuer.json"
                  help="Fallback for an Issuer profile shared outside Aptor."
                  label="Accepted issuer profile"
                  onText={(text) => {
                    try {
                      const issuer = parseIssuerFile(text);
                      const synthetic: AptorProfileV1 = {
                        ...account.value!.profile,
                        profileId: `apt_${issuer.issuerPublicKey.slice(-32)}`,
                        handle: `portable-${issuer.issuerPublicKey.slice(-8)}`,
                        displayName: issuer.displayName ?? "Portable Issuer",
                        issuerProfile: issuer,
                      };
                      void account.save({
                        ...account.value!,
                        verifier: {
                          ...account.value!.verifier,
                          trustedProfiles: [
                            ...account.value!.verifier.trustedProfiles.filter(
                              (item) =>
                                item.issuerProfile.issuerPublicKey !==
                                issuer.issuerPublicKey,
                            ),
                            synthetic,
                          ],
                        },
                      });
                    } catch (fileError) {
                      setError(
                        fileError instanceof Error
                          ? fileError.message
                          : "The Issuer profile could not be imported.",
                      );
                    }
                  }}
                />
              </div>
              {registeredPackage ? (
                <button
                  className="text-button"
                  onClick={() =>
                    downloadPortableFile(
                      `${registeredPackage.request.requestId.slice(0, 12)}.aptor-request.json`,
                      serializePortableFile(registeredPackage),
                    )
                  }
                  type="button"
                >
                  Export request package
                </button>
              ) : null}
            </div>
          </details>

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
              Request registration and monitoring require
              NEXT_PUBLIC_APTOR_CONTRACT_ADDRESS.
            </p>
          ) : null}
        </>
      )}
    </RoleWorkspace>
  );
}
