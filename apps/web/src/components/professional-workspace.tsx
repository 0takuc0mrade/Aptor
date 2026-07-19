"use client";

import {
  APTOR_PRIVATE_STATE_KEY,
  AptorBrowserContract,
  AptorError,
  createBrowserProviders,
  createCapabilityToken,
  createPrivateStateForRequest,
  credentialSatisfiesRequest,
  decryptCredentialPackage,
  decryptEnvelopePayload,
  downloadPortableFile,
  hashCapability,
  hydrateProofPrivateState,
  parseCredentialFile,
  parseRequestFile,
  portableRequestToContractRequest,
  queryPublicRequest,
  serializePortableFile,
  validateCredentialForHolder,
  validateRequestPackage,
  type AptorEncryptedCredentialPackageV1,
  type EphemeralPrivateStateProvider,
} from "@aptor/browser";
import type { AptorEncryptedEnvelopeV1 } from "@aptor/shared";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useAptorWallet } from "@/hooks/use-aptor-wallet";
import {
  APTOR_CONTRACT_ADDRESS,
  APTOR_ARTIFACT_FINGERPRINT,
  APTOR_INDEXER_URL,
  APTOR_INDEXER_WS_URL,
  APTOR_NETWORK,
  APTOR_ZK_ARTIFACTS_URL,
  requireContractAddress,
} from "@/lib/midnight-config";
import {
  createInvitation,
  listInbox,
  listInvitations,
  markEnvelopeReceived,
  markNotificationRead,
  updateRequestTracking,
  type AptorInvitationView,
} from "@/lib/delivery-client";

import { useAptorAccount } from "./account-provider";
import { FileField } from "./file-field";
import { AccountToolbar, ProfileAccess } from "./profile-access";
import { RoleWorkspace } from "./role-placeholder";
import { WalletPanel } from "./wallet-panel";

type ProofStage =
  | "idle"
  | "validating"
  | "waiting-wallet"
  | "proving"
  | "submitting"
  | "finalizing"
  | "success"
  | "failure";

const proofStageCopy: Record<ProofStage, string> = {
  idle: "Ready when one request and compatible credential are selected.",
  validating: "Validating request registration and private credential…",
  "waiting-wallet": "Waiting for a connected Midnight wallet…",
  proving: "The wallet is generating the request-bound zero-knowledge proof…",
  submitting: "Submitting the proven transaction to Midnight…",
  finalizing: "Waiting for the public fulfillment receipt to finalize…",
  success: "The request is fulfilled on-chain.",
  failure: "The proof flow stopped safely. Private witness state was cleared.",
};

export function ProfessionalWorkspace() {
  const account = useAptorAccount();
  const wallet = useAptorWallet();
  const encryptedCredential = useRef<AptorEncryptedCredentialPackageV1 | null>(
    null,
  );
  const transientProvider = useRef<EphemeralPrivateStateProvider<
    typeof APTOR_PRIVATE_STATE_KEY,
    Parameters<typeof hydrateProofPrivateState>[2]
  > | null>(null);
  const [inbox, setInbox] = useState<AptorEncryptedEnvelopeV1[]>([]);
  const [sentInvitations, setSentInvitations] = useState<AptorInvitationView[]>(
    [],
  );
  const [inviteLink, setInviteLink] = useState("");
  const [selectedRequestId, setSelectedRequestId] = useState("");
  const [selectedCredentialId, setSelectedCredentialId] = useState("");
  const [stage, setStage] = useState<ProofStage>("idle");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [receipt, setReceipt] = useState<{
    txId: string;
    blockHeight: number;
  } | null>(null);

  const professional = account.value?.professional ?? null;
  const selectedRequest = useMemo(
    () =>
      professional?.requests.find(
        (request) => request.request.requestId === selectedRequestId,
      ) ?? null,
    [professional, selectedRequestId],
  );
  const matchingCredentials = useMemo(
    () =>
      selectedRequest === null
        ? []
        : (professional?.credentials ?? []).filter((credential) =>
            credentialSatisfiesRequest(credential, selectedRequest),
          ),
    [professional, selectedRequest],
  );
  const selectedCredential = useMemo(
    () =>
      professional?.credentials.find(
        (credential) =>
          credential.credential.credentialId === selectedCredentialId,
      ) ?? null,
    [professional, selectedCredentialId],
  );

  const refreshInbox = useCallback(async () => {
    if (account.value === null) return;
    const token = account.value.privateProfile.accessToken;
    const [envelopes, invitations] = await Promise.all([
      listInbox(token),
      listInvitations(token, "sent"),
    ]);
    setInbox(envelopes);
    setSentInvitations(invitations);
  }, [account.value]);

  useEffect(() => {
    if (account.value === null) return;
    const timeout = window.setTimeout(
      () => void refreshInbox().catch(() => undefined),
      0,
    );
    const interval = window.setInterval(
      () => void refreshInbox().catch(() => undefined),
      12_000,
    );
    const onFocus = () => void refreshInbox().catch(() => undefined);
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearTimeout(timeout);
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [account.value, refreshInbox]);

  const acceptEnvelope = async (envelope: AptorEncryptedEnvelopeV1) => {
    if (account.value === null) return;
    setError("");
    setSuccess("");
    const payload = await decryptEnvelopePayload(
      envelope,
      account.value.profile.profileId,
      account.value.privateProfile.privateEncryptionKey,
    );
    if (envelope.envelopeType === "work_credential") {
      const credential = validateCredentialForHolder(
        payload,
        account.value.professional,
      );
      await account.save({
        ...account.value,
        professional: {
          ...account.value.professional,
          credentials: [
            ...account.value.professional.credentials.filter(
              (item) =>
                item.credential.credentialId !==
                credential.credential.credentialId,
            ),
            credential,
          ],
        },
      });
      setSuccess(
        "Envelope integrity, Issuer signature, and holder binding verified. Credential saved in the encrypted vault.",
      );
    } else {
      const contractAddress = requireContractAddress();
      const request = validateRequestPackage(payload, {
        network: APTOR_NETWORK,
        contractAddress,
      });
      const publicState = await queryPublicRequest(
        {
          network: APTOR_NETWORK,
          indexerUrl: APTOR_INDEXER_URL,
          indexerWsUrl: APTOR_INDEXER_WS_URL,
          contractAddress,
        },
        request.request.requestId,
        request.requestCommitment,
      );
      if (!publicState.registered || !publicState.commitmentMatches) {
        throw new AptorError(
          "REQUEST_NOT_REGISTERED",
          "This delivered request does not match registered Midnight state.",
        );
      }
      await account.save({
        ...account.value,
        professional: {
          ...account.value.professional,
          requests: [
            ...account.value.professional.requests.filter(
              (item) => item.request.requestId !== request.request.requestId,
            ),
            request,
          ],
        },
      });
      setSelectedRequestId(request.request.requestId);
      setSuccess(
        "Registered proof request decrypted, validated, and matched locally.",
      );
    }
    await markEnvelopeReceived(
      account.value.privateProfile.accessToken,
      envelope.envelopeId,
    );
    const relatedNotification = account.notifications.find(
      (notification) =>
        notification.relatedEntityId === envelope.envelopeId &&
        notification.readAt === null,
    );
    if (relatedNotification) {
      await markNotificationRead(
        account.value.privateProfile.accessToken,
        relatedNotification.notificationId,
      );
    }
    await refreshInbox();
    await account.refreshNotifications();
  };

  const runProof = async () => {
    if (
      account.value === null ||
      selectedCredential === null ||
      selectedRequest === null
    ) {
      setError("Select a compatible credential and proof request first.");
      return;
    }
    setError("");
    setSuccess("");
    setReceipt(null);
    setStage("validating");
    let provider: typeof transientProvider.current = null;
    try {
      const contractAddress = requireContractAddress();
      const request = validateRequestPackage(selectedRequest, {
        network: APTOR_NETWORK,
        contractAddress,
      });
      const publicState = await queryPublicRequest(
        {
          network: APTOR_NETWORK,
          indexerUrl: APTOR_INDEXER_URL,
          indexerWsUrl: APTOR_INDEXER_WS_URL,
          contractAddress,
        },
        request.request.requestId,
        request.requestCommitment,
      );
      if (!publicState.registered)
        throw new AptorError(
          "REQUEST_NOT_REGISTERED",
          "This request is not registered on the configured Aptor contract.",
        );
      if (!publicState.commitmentMatches)
        throw new AptorError(
          "REQUEST_COMMITMENT_MISMATCH",
          "This request does not match the on-chain commitment.",
        );
      if (publicState.fulfilled)
        throw new AptorError(
          "REQUEST_ALREADY_FULFILLED",
          "This request is already fulfilled. Aptor will not replay it.",
        );
      const privateState = createPrivateStateForRequest(
        account.value.professional,
        selectedCredential,
        request,
      );
      setStage("waiting-wallet");
      const connected = await wallet.connect();
      setStage("proving");
      const assembly = await createBrowserProviders(
        connected,
        APTOR_ZK_ARTIFACTS_URL,
        { expectedArtifactFingerprint: APTOR_ARTIFACT_FINGERPRINT },
      );
      provider = assembly.privateStateProvider;
      transientProvider.current = provider;
      await hydrateProofPrivateState(provider, contractAddress, privateState);
      const contract = await AptorBrowserContract.connect(
        assembly.providers,
        contractAddress,
        "proof",
      );
      setStage("submitting");
      const resultPromise = contract.fulfillRequest(
        portableRequestToContractRequest(request),
      );
      setStage("finalizing");
      const result = await resultPromise;
      await updateRequestTracking(
        account.value.privateProfile.accessToken,
        request.request.requestId,
        { status: "proof_submitted", fulfillmentTransactionId: result.txId },
      );
      setReceipt(result);
      setStage("success");
      setSuccess(
        "Proof finalized. The Verifier will see the fulfilled receipt automatically.",
      );
    } catch (proofError) {
      setStage("failure");
      setError(
        proofError instanceof Error
          ? proofError.message
          : "The proof flow could not be completed.",
      );
    } finally {
      transientProvider.current = null;
      if (provider !== null) await provider.dispose();
    }
  };

  return (
    <RoleWorkspace
      description="Invite previous clients, receive encrypted credentials and proof requests, then choose a compatible credential and generate the real Midnight proof."
      headline="Turn private work into proof."
      privacyDetail="Inbox ciphertext decrypts only after profile unlock. Credential matching happens inside the encrypted local vault, and one selected credential enters ephemeral proof state."
      privacyStages={[
        "Encrypted inbox",
        "Local matching",
        "Fulfillment receipt",
      ]}
      privacySummary="Credentials, matching results, and exact values stay local to the Professional."
      role="Professional"
      status={
        professional
          ? `${professional.credentials.length} credential${professional.credentials.length === 1 ? "" : "s"} · ${professional.requests.length} request${professional.requests.length === 1 ? "" : "s"}`
          : "Unlock the shared Aptor profile to open the private inbox."
      }
    >
      {account.value === null || professional === null ? (
        <ProfileAccess />
      ) : (
        <>
          <section
            className="professional-invite"
            aria-labelledby="invite-title"
          >
            <header className="section-heading">
              <div>
                <h2 id="invite-title">Invite previous client</h2>
                <p>Create a single-use link that expires after seven days.</p>
              </div>
              <span className="section-heading__state">
                @{account.value.profile.handle}
              </span>
            </header>
            <div className="button-row">
              <button
                className="action-button"
                onClick={() => {
                  setError("");
                  void (async () => {
                    const rawToken = createCapabilityToken();
                    await createInvitation(
                      account.value!.privateProfile.accessToken,
                      await hashCapability(rawToken),
                    );
                    setInviteLink(
                      `${window.location.origin}/invite/${rawToken}`,
                    );
                    await refreshInbox();
                  })().catch((inviteError: unknown) =>
                    setError(
                      inviteError instanceof Error
                        ? inviteError.message
                        : "The invitation could not be created.",
                    ),
                  );
                }}
                type="button"
              >
                Create Issuer invite
              </button>
            </div>
            {inviteLink ? (
              <div className="invite-link" role="status">
                <label className="field">
                  <span>Shareable invite link</span>
                  <input
                    aria-label="Shareable invite link"
                    readOnly
                    value={inviteLink}
                  />
                </label>
                <button
                  className="text-button"
                  onClick={() => void navigator.clipboard.writeText(inviteLink)}
                  type="button"
                >
                  Copy invite link
                </button>
              </div>
            ) : null}
            <p className="privacy-note">
              The link contains only a one-time invitation capability. It does
              not contain your account access token or private holder secret.
            </p>
            <AccountToolbar />
          </section>

          <section className="request-inbox" aria-labelledby="inbox-title">
            <header className="section-heading">
              <div>
                <h2 id="inbox-title">Inbox</h2>
                <p>
                  Encrypted credentials and registered requests arrive here.
                </p>
              </div>
              <span className="section-heading__state">
                {
                  inbox.filter((item) => item.deliveryStatus === "pending")
                    .length
                }{" "}
                new
              </span>
            </header>
            {inbox.length === 0 ? (
              <div className="empty-state">
                <span aria-hidden="true" className="empty-state__mark">
                  —
                </span>
                <div>
                  <h3>Your inbox is private and empty</h3>
                  <p>
                    Invite a previous client or wait for a Verifier request.
                  </p>
                </div>
              </div>
            ) : (
              <ul className="record-list inbox-list">
                {inbox.map((envelope) => (
                  <li key={envelope.envelopeId}>
                    <div>
                      <strong>
                        {envelope.envelopeType === "work_credential"
                          ? "Encrypted credential"
                          : "New proof request"}
                      </strong>
                      <span>
                        {envelope.deliveryStatus === "received"
                          ? "Received locally"
                          : "Waiting for local decryption"}{" "}
                        · {new Date(envelope.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <button
                      className={
                        envelope.deliveryStatus === "received"
                          ? "text-button"
                          : "action-button action-button--small"
                      }
                      disabled={envelope.deliveryStatus === "received"}
                      onClick={() =>
                        void acceptEnvelope(envelope).catch(
                          (inboxError: unknown) =>
                            setError(
                              inboxError instanceof Error
                                ? inboxError.message
                                : "The delivery could not be opened.",
                            ),
                        )
                      }
                      type="button"
                    >
                      {envelope.deliveryStatus === "received"
                        ? "Accepted"
                        : envelope.envelopeType === "work_credential"
                          ? "Verify and save"
                          : "Review request"}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {sentInvitations.length > 0 ? (
              <p className="import-state">
                <strong>Invitations sent:</strong> {sentInvitations.length}
              </p>
            ) : null}
            {account.notifications.length > 0 ? (
              <div
                className="notification-list"
                aria-label="Aptor notifications"
              >
                <h3>Status notifications</h3>
                <ul className="record-list record-list--compact">
                  {account.notifications.map((notification) => (
                    <li key={notification.notificationId}>
                      <div>
                        <strong>
                          {
                            {
                              invitation_redeemed:
                                "Issuer accepted your invitation",
                              credential_received:
                                "Encrypted credential received",
                              proof_request_received:
                                "New proof request received",
                              request_fulfilled:
                                "Request fulfilled on Midnight",
                            }[notification.type]
                          }
                        </strong>
                        <span>
                          {new Date(notification.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <button
                        className="text-button"
                        disabled={notification.readAt !== null}
                        onClick={() => {
                          void markNotificationRead(
                            account.value!.privateProfile.accessToken,
                            notification.notificationId,
                          ).then(account.refreshNotifications);
                        }}
                        type="button"
                      >
                        {notification.readAt === null ? "Mark read" : "Read"}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>

          <section
            className="credential-vault credential-library"
            aria-labelledby="vault-title"
          >
            <header className="section-heading section-heading--compact">
              <div>
                <h2 id="vault-title">View credentials</h2>
                <p>
                  Only verified credentials accepted into this encrypted vault
                  appear here.
                </p>
              </div>
              <span className="section-heading__state">
                {professional.credentials.length} saved
              </span>
            </header>
            {professional.credentials.length === 0 ? (
              <div className="request-empty">
                <p>No credentials accepted yet.</p>
                <span>
                  Private work facts never appear in notification previews.
                </span>
              </div>
            ) : (
              <ul className="record-list">
                {professional.credentials.map((credential) => (
                  <li key={credential.credential.credentialId}>
                    <div>
                      <strong>
                        {credential.skills
                          .map((skill) => skill.display)
                          .join(", ")}
                      </strong>
                      <span>
                        {credential.credential.durationMonths} months ·{" "}
                        {(
                          credential.credential.clientRatingHundredths / 100
                        ).toFixed(2)}{" "}
                        / 5.00
                      </span>
                    </div>
                    <span className="record-list__state">
                      Signature verified
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="request-inbox" aria-labelledby="requests-title">
            <header className="section-heading section-heading--compact">
              <div>
                <h2 id="requests-title">Review proof requests</h2>
                <p>Credential compatibility is computed locally.</p>
              </div>
            </header>
            {professional.requests.length === 0 ? (
              <div className="request-empty">
                <p>No accepted proof requests.</p>
                <span>Nothing is being shared.</span>
              </div>
            ) : (
              <div
                className="selection-list"
                role="radiogroup"
                aria-label="Select proof request"
              >
                {professional.requests.map((request) => (
                  <label key={request.request.requestId}>
                    <input
                      checked={selectedRequestId === request.request.requestId}
                      name="selectedRequest"
                      onChange={() => {
                        setSelectedRequestId(request.request.requestId);
                        setSelectedCredentialId("");
                        setReceipt(null);
                      }}
                      type="radio"
                    />
                    <span>
                      <strong>{request.request.requiredSkill}</strong>
                      <small>
                        {request.network} · Compatible credentials:{" "}
                        {
                          professional.credentials.filter((credential) =>
                            credentialSatisfiesRequest(credential, request),
                          ).length
                        }
                      </small>
                    </span>
                  </label>
                ))}
              </div>
            )}
          </section>

          <WalletPanel wallet={wallet} />

          <section className="proof-readiness" aria-labelledby="proof-title">
            <header className="section-heading section-heading--compact">
              <div>
                <h2 id="proof-title">Generate proof</h2>
                <p>
                  Select one compatible credential and confirm the disclosure
                  boundary.
                </p>
              </div>
            </header>
            {selectedRequest === null ? (
              <div className="request-empty">
                <p>Select a proof request first.</p>
                <span>No credential has entered proof state.</span>
              </div>
            ) : matchingCredentials.length === 0 ? (
              <p className="form-message form-message--error" role="status">
                Compatible credentials: 0
              </p>
            ) : (
              <>
                <p className="match-count">
                  Compatible credentials:{" "}
                  <strong>{matchingCredentials.length}</strong>
                </p>
                <div
                  className="selection-list"
                  role="radiogroup"
                  aria-label="Select credential"
                >
                  {matchingCredentials.map((credential) => (
                    <label key={credential.credential.credentialId}>
                      <input
                        checked={
                          selectedCredentialId ===
                          credential.credential.credentialId
                        }
                        name="selectedCredential"
                        onChange={() =>
                          setSelectedCredentialId(
                            credential.credential.credentialId,
                          )
                        }
                        type="radio"
                      />
                      <span>
                        <strong>
                          {credential.skills
                            .map((skill) => skill.display)
                            .join(", ")}
                        </strong>
                        <small>Private credential · signature verified</small>
                      </span>
                    </label>
                  ))}
                </div>
              </>
            )}
            {selectedRequest && selectedCredential ? (
              <div className="disclosure-preview">
                <div>
                  <span>Becomes public</span>
                  <strong>Request fulfillment receipt</strong>
                  <p>
                    Request criteria, status, contract, network, and
                    transaction.
                  </p>
                </div>
                <div>
                  <span>Remains private</span>
                  <strong>Credential and selected Issuer</strong>
                  <p>
                    Exact values, full skill list, holder secret, signature, and
                    Merkle paths.
                  </p>
                </div>
              </div>
            ) : null}
            <div
              className="action-progress"
              data-stage={stage}
              role="status"
              aria-live="polite"
            >
              <span>{stage.replaceAll("-", " ")}</span>
              <p>{proofStageCopy[stage]}</p>
            </div>
            <button
              className="action-button"
              disabled={
                selectedRequest === null ||
                selectedCredential === null ||
                !["idle", "failure"].includes(stage)
              }
              onClick={() => void runProof()}
              type="button"
            >
              {stage === "proving" || stage === "finalizing"
                ? "Proof in progress…"
                : "Generate and submit proof"}
            </button>
            {receipt ? (
              <dl className="receipt-card">
                <div>
                  <dt>Status</dt>
                  <dd>Fulfilled</dd>
                </div>
                <div>
                  <dt>Transaction</dt>
                  <dd className="mono-value">{receipt.txId}</dd>
                </div>
                <div>
                  <dt>Block</dt>
                  <dd>{receipt.blockHeight}</dd>
                </div>
                <div>
                  <dt>Network</dt>
                  <dd>{APTOR_NETWORK}</dd>
                </div>
              </dl>
            ) : null}
          </section>

          <details className="advanced-panel portable-panel">
            <summary>Advanced · Portable backup, import, or export</summary>
            <div className="portable-grid">
              <button
                className="text-button"
                onClick={() =>
                  downloadPortableFile(
                    `${professional.profile.profileId}.aptor-holder.json`,
                    serializePortableFile(professional.profile),
                  )
                }
                type="button"
              >
                Export holder profile
              </button>
              <div className="import-panel">
                <h3>Import portable credential</h3>
                <FileField
                  accept=".aptor-credential,application/json"
                  help="Fallback for encrypted files shared outside Aptor."
                  label="Aptor credential package"
                  onText={(text) => {
                    encryptedCredential.current = parseCredentialFile(text);
                  }}
                />
                <form
                  className="form-stack"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (encryptedCredential.current === null) {
                      setError("Choose an Aptor credential package first.");
                      return;
                    }
                    const form = event.currentTarget;
                    const passphrase = String(
                      new FormData(form).get("transferPassphrase") ?? "",
                    );
                    void (async () => {
                      const decrypted = await decryptCredentialPackage(
                        encryptedCredential.current!,
                        passphrase,
                      );
                      const credential = validateCredentialForHolder(
                        decrypted,
                        account.value!.professional,
                      );
                      await account.save({
                        ...account.value!,
                        professional: {
                          ...account.value!.professional,
                          credentials: [
                            ...account.value!.professional.credentials.filter(
                              (item) =>
                                item.credential.credentialId !==
                                credential.credential.credentialId,
                            ),
                            credential,
                          ],
                        },
                      });
                      encryptedCredential.current = null;
                      form.reset();
                      setSuccess("Portable credential verified and saved.");
                    })().catch((importError: unknown) =>
                      setError(
                        importError instanceof Error
                          ? importError.message
                          : "Portable import failed.",
                      ),
                    );
                  }}
                >
                  <label className="field">
                    <span>Transfer passphrase</span>
                    <input
                      minLength={12}
                      name="transferPassphrase"
                      required
                      type="password"
                    />
                  </label>
                  <button
                    className="action-button action-button--secondary"
                    type="submit"
                  >
                    Verify portable credential
                  </button>
                </form>
              </div>
              <div className="import-panel">
                <h3>Import portable request</h3>
                <FileField
                  accept="application/json,.aptor-request.json"
                  help="Fallback for a registered request package."
                  label="Aptor request package"
                  onText={async (text) => {
                    try {
                      const request = validateRequestPackage(
                        parseRequestFile(text),
                        {
                          network: APTOR_NETWORK,
                          contractAddress: requireContractAddress(),
                        },
                      );
                      await account.save({
                        ...account.value!,
                        professional: {
                          ...account.value!.professional,
                          requests: [
                            ...account.value!.professional.requests.filter(
                              (item) =>
                                item.request.requestId !==
                                request.request.requestId,
                            ),
                            request,
                          ],
                        },
                      });
                      setSuccess("Portable request verified and saved.");
                    } catch (requestError) {
                      setError(
                        requestError instanceof Error
                          ? requestError.message
                          : "Portable request import failed.",
                      );
                    }
                  }}
                />
              </div>
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
              Proof actions are disabled until
              NEXT_PUBLIC_APTOR_CONTRACT_ADDRESS is configured.
            </p>
          ) : null}
        </>
      )}
    </RoleWorkspace>
  );
}
