"use client";

import {
  APTOR_PRIVATE_STATE_KEY,
  AptorBrowserContract,
  AptorError,
  createBrowserProviders,
  createPrivateStateForRequest,
  createProfessionalVault,
  decryptCredentialPackage,
  downloadPortableFile,
  hydrateProofPrivateState,
  parseCredentialFile,
  parseRequestFile,
  portableRequestToContractRequest,
  queryPublicRequest,
  serializePortableFile,
  validateCredentialForHolder,
  validateRequestPackage,
  credentialSatisfiesRequest,
  type AptorEncryptedCredentialPackageV1,
  type EphemeralPrivateStateProvider,
} from "@aptor/browser";
import { useMemo, useRef, useState } from "react";

import { useAptorWallet } from "@/hooks/use-aptor-wallet";
import { useVaultSession } from "@/hooks/use-vault-session";
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
import { VaultAccess, VaultToolbar } from "./vault-access";
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
  idle: "Ready when one request and credential are selected.",
  validating: "Validating request registration and private credential…",
  "waiting-wallet": "Waiting for a connected Midnight wallet…",
  proving: "The wallet is generating the request-bound zero-knowledge proof…",
  submitting: "Submitting the proven transaction to Midnight…",
  finalizing: "Waiting for the public fulfillment receipt to finalize…",
  success: "The request is fulfilled on-chain.",
  failure: "The proof flow stopped safely. Private witness state was cleared.",
};

export function ProfessionalWorkspace() {
  const vault = useVaultSession("professional");
  const wallet = useAptorWallet();
  const encryptedCredential = useRef<AptorEncryptedCredentialPackageV1 | null>(
    null,
  );
  const transientProvider = useRef<EphemeralPrivateStateProvider<
    typeof APTOR_PRIVATE_STATE_KEY,
    Parameters<typeof hydrateProofPrivateState>[2]
  > | null>(null);
  const [selectedRequestId, setSelectedRequestId] = useState("");
  const [selectedCredentialId, setSelectedCredentialId] = useState("");
  const [stage, setStage] = useState<ProofStage>("idle");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [receipt, setReceipt] = useState<{
    txId: string;
    blockHeight: number;
  } | null>(null);

  const selectedRequest = useMemo(
    () =>
      vault.value?.requests.find(
        (request) => request.request.requestId === selectedRequestId,
      ) ?? null,
    [selectedRequestId, vault.value],
  );
  const matchingCredentials = useMemo(
    () =>
      selectedRequest === null
        ? (vault.value?.credentials ?? [])
        : (vault.value?.credentials ?? []).filter((credential) =>
            credentialSatisfiesRequest(credential, selectedRequest),
          ),
    [selectedRequest, vault.value],
  );
  const selectedCredential = useMemo(
    () =>
      vault.value?.credentials.find(
        (credential) =>
          credential.credential.credentialId === selectedCredentialId,
      ) ?? null,
    [selectedCredentialId, vault.value],
  );

  const backup = async () => {
    const container = await vault.exportBackup();
    downloadPortableFile(
      "aptor-professional-vault-backup.json",
      serializePortableFile(container),
    );
  };

  const lock = () => {
    const provider = transientProvider.current;
    transientProvider.current = null;
    if (provider !== null) void provider.dispose();
    vault.lock();
    setSelectedCredentialId("");
    setSelectedRequestId("");
    setStage("idle");
    setReceipt(null);
  };

  const runProof = async () => {
    if (
      vault.value === null ||
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
      if (!publicState.registered) {
        throw new AptorError(
          "REQUEST_NOT_REGISTERED",
          "This request is not registered on the configured Aptor contract.",
        );
      }
      if (!publicState.commitmentMatches) {
        throw new AptorError(
          "REQUEST_COMMITMENT_MISMATCH",
          "The imported request does not match the on-chain commitment.",
        );
      }
      if (publicState.fulfilled) {
        throw new AptorError(
          "REQUEST_ALREADY_FULFILLED",
          "This request is already fulfilled. Aptor will not replay it.",
        );
      }
      const privateState = createPrivateStateForRequest(
        vault.value,
        selectedCredential,
        request,
      );
      setStage("waiting-wallet");
      const connected = wallet.getConnected();
      setStage("proving");
      const assembly = await createBrowserProviders(
        connected,
        APTOR_ZK_ARTIFACTS_URL,
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
      setReceipt(result);
      setStage("success");
      setSuccess(
        "Proof finalized. Only the registered request receipt is public.",
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
      description="Keep signed credentials in an encrypted local vault, inspect public requests, and decide which compatible credential to use without revealing the underlying work."
      headline="Turn private work into proof."
      privacyDetail="Aptor hydrates one selected credential into ephemeral proof state after confirmation, submits the request-bound proof, then clears witness state on success, failure, timeout, or vault lock."
      privacyStages={[
        "Encrypted credential",
        "Selected requirements",
        "Fulfillment receipt",
      ]}
      privacySummary="Raw credentials and exact values stay local to the professional."
      role="Professional"
      status={
        vault.value
          ? `${vault.value.credentials.length} credential${vault.value.credentials.length === 1 ? "" : "s"} · ${vault.value.requests.length} request${vault.value.requests.length === 1 ? "" : "s"}`
          : "The private identity remains unavailable until the vault is unlocked."
      }
    >
      {vault.value === null ? (
        <VaultAccess
          busy={vault.busy}
          error={vault.error}
          exists={vault.exists}
          onCreate={async (password) => {
            await vault.create(password, createProfessionalVault());
          }}
          onRestore={async (value, password) => {
            await vault.importBackup(value, password);
          }}
          onUnlock={vault.unlock}
          role="professional"
        />
      ) : (
        <>
          <section className="credential-vault" aria-labelledby="vault-title">
            <header className="section-heading">
              <div>
                <h2 id="vault-title">Credential vault</h2>
                <p>Signed credentials encrypted for this holder identity.</p>
              </div>
              <span className="section-heading__state">
                {vault.value.credentials.length} credential
                {vault.value.credentials.length === 1 ? "" : "s"}
              </span>
            </header>

            <dl className="credential-spec">
              <div>
                <dt>Profile</dt>
                <dd className="mono-value">{vault.value.profile.profileId}</dd>
                <span>Public ID</span>
              </div>
              <div>
                <dt>Holder commitment</dt>
                <dd
                  className="mono-value"
                  title={vault.value.profile.holderCommitment}
                >
                  {vault.value.profile.holderCommitment.slice(0, 24)}…
                </dd>
                <span>Public</span>
              </div>
            </dl>

            <div className="button-row">
              <button
                className="action-button"
                onClick={() =>
                  downloadPortableFile(
                    `${vault.value!.profile.profileId}.aptor-holder.json`,
                    serializePortableFile(vault.value!.profile),
                  )
                }
                type="button"
              >
                Export holder profile
              </button>
            </div>

            <VaultToolbar
              busy={vault.busy || stage === "proving" || stage === "finalizing"}
              onBackup={backup}
              onDelete={vault.deleteLocal}
              onLock={lock}
            />

            <div className="import-panel">
              <h3>Import encrypted credential</h3>
              <FileField
                accept=".aptor-credential,application/json"
                help="Aptor validates the encrypted container before asking for its passphrase."
                label="Aptor credential package"
                onText={(text) => {
                  try {
                    encryptedCredential.current = parseCredentialFile(text);
                    setError("");
                  } catch (fileError) {
                    setError(
                      fileError instanceof Error
                        ? fileError.message
                        : "The credential package could not be read.",
                    );
                  }
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
                  setError("");
                  setSuccess("");
                  void (async () => {
                    const decrypted = await decryptCredentialPackage(
                      encryptedCredential.current!,
                      passphrase,
                    );
                    const credential = validateCredentialForHolder(
                      decrypted,
                      vault.value!,
                    );
                    const withoutDuplicate = vault.value!.credentials.filter(
                      (item) =>
                        item.credential.credentialId !==
                        credential.credential.credentialId,
                    );
                    await vault.save({
                      ...vault.value!,
                      credentials: [...withoutDuplicate, credential],
                    });
                    encryptedCredential.current = null;
                    form.reset();
                    setSuccess(
                      "Credential signature and holder binding verified. Saved in the encrypted vault.",
                    );
                  })().catch((importError: unknown) =>
                    setError(
                      importError instanceof Error
                        ? importError.message
                        : "The credential could not be imported.",
                    ),
                  );
                }}
              >
                <label className="field">
                  <span>Transfer passphrase</span>
                  <input
                    autoComplete="off"
                    minLength={12}
                    name="transferPassphrase"
                    required
                    type="password"
                  />
                </label>
                <button
                  className="action-button"
                  disabled={vault.busy}
                  type="submit"
                >
                  {vault.busy
                    ? "Verifying credential…"
                    : "Verify and save credential"}
                </button>
              </form>
            </div>

            {vault.value.credentials.length === 0 ? (
              <div className="empty-state">
                <span aria-hidden="true" className="empty-state__mark">
                  —
                </span>
                <div>
                  <h3>No credentials yet</h3>
                  <p>Import an encrypted package received from an issuer.</p>
                </div>
              </div>
            ) : (
              <ul className="record-list">
                {vault.value.credentials.map((credential) => (
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
                    <span className="record-list__state">Signature valid</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="request-inbox" aria-labelledby="request-title">
            <header className="section-heading section-heading--compact">
              <div>
                <h2 id="request-title">Proof requests</h2>
                <p>Only registered request files are saved.</p>
              </div>
            </header>

            <FileField
              accept="application/json,.aptor-request.json"
              help="The network, contract, commitment, and registration are checked before storage."
              label="Aptor request package"
              onText={async (text) => {
                setError("");
                setSuccess("");
                setStage("validating");
                try {
                  const contractAddress = requireContractAddress();
                  const request = validateRequestPackage(
                    parseRequestFile(text),
                    {
                      network: APTOR_NETWORK,
                      contractAddress,
                    },
                  );
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
                  if (!publicState.registered) {
                    throw new AptorError(
                      "REQUEST_NOT_REGISTERED",
                      "This request is not registered on the configured Aptor contract.",
                    );
                  }
                  if (!publicState.commitmentMatches) {
                    throw new AptorError(
                      "REQUEST_COMMITMENT_MISMATCH",
                      "The request package does not match public state.",
                    );
                  }
                  const requests = vault.value!.requests.filter(
                    (item) =>
                      item.request.requestId !== request.request.requestId,
                  );
                  await vault.save({
                    ...vault.value!,
                    requests: [...requests, request],
                  });
                  setSelectedRequestId(request.request.requestId);
                  setStage("idle");
                  setSuccess(
                    publicState.fulfilled
                      ? "Request verified. It is already fulfilled."
                      : "Registered request verified and saved.",
                  );
                } catch (requestError) {
                  setStage("failure");
                  setError(
                    requestError instanceof Error
                      ? requestError.message
                      : "The request could not be imported.",
                  );
                }
              }}
            />

            {vault.value.requests.length === 0 ? (
              <div className="request-empty">
                <p>No proof requests imported.</p>
                <span>Nothing is being shared.</span>
              </div>
            ) : (
              <div
                className="selection-list"
                role="radiogroup"
                aria-label="Select proof request"
              >
                {vault.value.requests.map((request) => (
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
                        {request.network} ·{" "}
                        {request.request.requestId.slice(0, 10)}…
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
                  Choose one compatible private credential, then confirm the
                  disclosure boundary.
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
                No local credential can satisfy this request.
              </p>
            ) : (
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
            )}

            {selectedRequest !== null && selectedCredential !== null ? (
              <div className="disclosure-preview">
                <div>
                  <span>Becomes public</span>
                  <strong>Request fulfillment receipt</strong>
                  <p>
                    Request ID, registered criteria, contract, network, and
                    transaction.
                  </p>
                </div>
                <div>
                  <span>Remains private</span>
                  <strong>The credential and selected issuer</strong>
                  <p>
                    Exact values, full skills, credential ID, signature, holder
                    secret, and Merkle paths.
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
              Browser proof actions are disabled until
              NEXT_PUBLIC_APTOR_CONTRACT_ADDRESS is configured.
            </p>
          ) : null}
        </>
      )}
    </RoleWorkspace>
  );
}
