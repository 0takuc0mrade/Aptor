"use client";

import {
  AptorBrowserContract,
  AptorError,
  createBrowserProviders,
  createDeploymentPrivateState,
  isOneAmWallet,
} from "@aptor/browser";
import { useCallback, useEffect, useMemo, useState } from "react";

import { WalletPanel } from "@/components/wallet-panel";
import { useAptorWallet } from "@/hooks/use-aptor-wallet";
import {
  APTOR_1AM_EXPLORER_URL,
  APTOR_ARTIFACT_FINGERPRINT,
  APTOR_EXPLORER_URL,
  APTOR_INDEXER_URL,
  APTOR_NETWORK,
  APTOR_PREPROD_DEPLOYMENT_ENABLED,
  APTOR_RPC_URL,
  APTOR_ZK_ARTIFACTS_URL,
} from "@/lib/midnight-config";
import type { ReleasePreflightCheck } from "@/lib/release-preflight";

const CONFIRMATION_PHRASE = "Deploy Aptor to Midnight Preprod.";
const WALLET_READ_TIMEOUT_MS = 15_000;
const PROVING_PROVIDER_TIMEOUT_MS = 45_000;

type WalletCheckFeedback = Readonly<{
  tone: "progress" | "success" | "error";
  message: string;
}>;

type PreflightResponse = Readonly<{
  ready: boolean;
  checks: ReleasePreflightCheck[];
}>;

type DeploymentEvidence = Readonly<{
  network: "preprod";
  contractAddress: string;
  deploymentTransactionId: string;
  deploymentBlockHeight: number;
  deploymentTimestamp: string;
  artifactFingerprint: string;
  indexerQueryVerified: true;
  explorerUrl: string;
  oneAmExplorerUrl: string;
}>;

function statusLabel(status: ReleasePreflightCheck["status"]): string {
  if (status === "pass") return "Passed";
  if (status === "skip") return "Skipped";
  return "Failed";
}

async function withWalletTimeout<T>(
  operation: Promise<T>,
  action: string,
  timeoutMs = WALLET_READ_TIMEOUT_MS,
): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => {
          reject(
            new AptorError(
              "WALLET_CONNECTION_LOST",
              `1AM did not respond while ${action}. Open 1AM, confirm it is fully synced, then disconnect and reconnect it in Aptor.`,
            ),
          );
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
  }
}

export function PreprodReleaseConsole() {
  const wallet = useAptorWallet();
  const [serverChecks, setServerChecks] = useState<ReleasePreflightCheck[]>([]);
  const [serverReady, setServerReady] = useState(false);
  const [walletChecks, setWalletChecks] = useState<ReleasePreflightCheck[]>([]);
  const [walletReady, setWalletReady] = useState(false);
  const [walletCheckFeedback, setWalletCheckFeedback] =
    useState<WalletCheckFeedback | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState<
    "server-preflight" | "wallet-preflight" | "deploy" | null
  >(null);
  const [error, setError] = useState("");
  const [evidence, setEvidence] = useState<DeploymentEvidence | null>(null);

  const runServerChecks = useCallback(async () => {
    setBusy("server-preflight");
    setError("");
    try {
      const response = await fetch("/api/release/preflight?mode=deployment", {
        cache: "no-store",
      });
      const payload = (await response.json()) as PreflightResponse;
      setServerChecks(payload.checks);
      setServerReady(payload.ready);
      if (!payload.ready) {
        setError("Resolve every failed server check before connecting 1AM.");
      }
    } catch (preflightError) {
      setServerReady(false);
      setError(
        preflightError instanceof Error
          ? preflightError.message
          : "The server preflight did not complete.",
      );
    } finally {
      setBusy(null);
    }
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => void runServerChecks(), 0);
    return () => window.clearTimeout(timeout);
  }, [runServerChecks]);

  const runWalletChecks = useCallback(async () => {
    setBusy("wallet-preflight");
    setError("");
    setWalletReady(false);
    setWalletChecks([]);
    setWalletCheckFeedback({
      tone: "progress",
      message: "Reading the active 1AM connection…",
    });
    const results: ReleasePreflightCheck[] = [];
    const record = (result: ReleasePreflightCheck) => {
      results.push(result);
      setWalletChecks([...results]);
    };
    try {
      const connected =
        wallet.status === "connected"
          ? wallet.getConnected()
          : await withWalletTimeout(
              wallet.connect(),
              "requesting connection permission",
              30_000,
            );
      const oneAm = isOneAmWallet(connected.wallet);
      record({
        id: "one-am",
        label: "1AM wallet",
        status: oneAm ? "pass" : "fail",
        detail: oneAm
          ? `${connected.wallet.name} (${connected.wallet.rdns})`
          : "Aptor's public deployment must be approved through 1AM.",
      });

      const compatibleApi = /^4\./u.test(connected.wallet.apiVersion);
      record({
        id: "connector-api",
        label: "Connector API version",
        status: compatibleApi ? "pass" : "fail",
        detail: compatibleApi
          ? `1AM exposes compatible API ${connected.wallet.apiVersion}.`
          : `Connector API ${connected.wallet.apiVersion} is not compatible with Aptor's v4 integration.`,
      });

      setWalletCheckFeedback({
        tone: "progress",
        message: "Confirming that 1AM and its services are on Preprod…",
      });
      const [connection, configuration] = await Promise.all([
        withWalletTimeout(
          connected.api.getConnectionStatus(),
          "checking its Preprod connection",
        ),
        withWalletTimeout(
          connected.api.getConfiguration(),
          "reading its service configuration",
        ),
      ]);
      const networkMatches =
        connection.status === "connected" &&
        connection.networkId === "preprod" &&
        configuration.networkId === "preprod";
      record({
        id: "wallet-network",
        label: "1AM Preprod connection",
        status: networkMatches ? "pass" : "fail",
        detail: networkMatches
          ? "Connector and wallet services both report preprod."
          : "Switch 1AM and its services to Preprod, then reconnect.",
      });

      setWalletCheckFeedback({
        tone: "progress",
        message: "Refreshing spendable DUST from 1AM…",
      });
      const dust = await withWalletTimeout(
        connected.api.getDustBalance(),
        "refreshing its spendable DUST",
      );
      const hasDust = dust.balance > 0n;
      record({
        id: "wallet-dust",
        label: "Spendable DUST",
        status: hasDust ? "pass" : "fail",
        detail: hasDust
          ? `1AM reports ${dust.balance.toString()} spendable DUST units (cap ${dust.cap.toString()}).`
          : "1AM reports zero spendable DUST. Wait for DUST maturation before deploying.",
      });

      if (oneAm && compatibleApi && networkMatches && hasDust) {
        setWalletCheckFeedback({
          tone: "progress",
          message: "Asking 1AM to prepare Aptor’s proving provider…",
        });
        let provider:
          | Awaited<
              ReturnType<typeof createBrowserProviders>
            >["privateStateProvider"]
          | undefined;
        try {
          const assembly = await withWalletTimeout(
            createBrowserProviders(connected, APTOR_ZK_ARTIFACTS_URL, {
              expectedArtifactFingerprint: APTOR_ARTIFACT_FINGERPRINT,
            }),
            "preparing Aptor’s proving provider",
            PROVING_PROVIDER_TIMEOUT_MS,
          );
          provider = assembly.privateStateProvider;
          record({
            id: "wallet-proving",
            label: "1AM proving provider",
            status: "pass",
            detail:
              "1AM accepted Aptor's exact ZK key-material provider through Connector API v4.",
          });
        } catch (providerError) {
          record({
            id: "wallet-proving",
            label: "1AM proving provider",
            status: "fail",
            detail:
              providerError instanceof Error
                ? providerError.message
                : "1AM could not create a proving provider.",
          });
        } finally {
          await provider?.dispose();
        }
      } else {
        record({
          id: "wallet-proving",
          label: "1AM proving provider",
          status: "skip",
          detail: "Fix the wallet identity, network, and DUST checks first.",
        });
      }
      const ready = results.every((result) => result.status === "pass");
      setWalletReady(ready);
      if (ready) {
        setWalletCheckFeedback({
          tone: "success",
          message:
            "1AM is ready. Type the exact approval phrase to enable the one-time deployment.",
        });
      } else {
        const message = "1AM is not ready to deploy this release yet.";
        setError(message);
        setWalletCheckFeedback({ tone: "error", message });
      }
    } catch (walletError) {
      setWalletReady(false);
      const message =
        walletError instanceof Error
          ? walletError.message
          : "The 1AM preflight did not complete.";
      record({
        id: "wallet-preflight-error",
        label: "1AM readiness check",
        status: "fail",
        detail: message,
      });
      setError(message);
      setWalletCheckFeedback({ tone: "error", message });
    } finally {
      setBusy(null);
    }
  }, [wallet]);

  const deploy = useCallback(async () => {
    if (!APTOR_PREPROD_DEPLOYMENT_ENABLED || APTOR_NETWORK !== "preprod") {
      setError(
        "Preprod deployment is disabled. Enable it explicitly for this local deployment build.",
      );
      return;
    }
    if (!serverReady || !walletReady) {
      setError("Pass both preflight groups before deployment.");
      return;
    }
    if (confirmation !== CONFIRMATION_PHRASE) {
      setError("Type the exact confirmation phrase before deployment.");
      return;
    }
    setBusy("deploy");
    setError("");
    let provider:
      | Awaited<
          ReturnType<typeof createBrowserProviders>
        >["privateStateProvider"]
      | undefined;
    try {
      const connected = wallet.getConnected();
      if (!isOneAmWallet(connected.wallet)) {
        throw new AptorError(
          "UNSUPPORTED_WALLET",
          "The deployment connection is no longer 1AM. Re-run its preflight.",
        );
      }
      const assembly = await createBrowserProviders(
        connected,
        APTOR_ZK_ARTIFACTS_URL,
        { expectedArtifactFingerprint: APTOR_ARTIFACT_FINGERPRINT },
      );
      provider = assembly.privateStateProvider;
      const contract = await AptorBrowserContract.deploy(
        assembly.providers,
        createDeploymentPrivateState(),
      );
      provider.setContractAddress(contract.contractAddress);
      await contract.publicState();
      setEvidence({
        network: "preprod",
        contractAddress: contract.contractAddress,
        deploymentTransactionId: contract.deploymentTransaction.txId,
        deploymentBlockHeight: contract.deploymentTransaction.blockHeight,
        deploymentTimestamp: new Date().toISOString(),
        artifactFingerprint: APTOR_ARTIFACT_FINGERPRINT,
        indexerQueryVerified: true,
        explorerUrl: APTOR_EXPLORER_URL,
        oneAmExplorerUrl: APTOR_1AM_EXPLORER_URL,
      });
      setConfirmation("");
    } catch (deploymentError) {
      setError(
        deploymentError instanceof Error
          ? deploymentError.message
          : "The deployment did not finalize.",
      );
    } finally {
      await provider?.dispose();
      setBusy(null);
    }
  }, [confirmation, serverReady, wallet, walletReady]);

  const evidenceJson = useMemo(
    () => (evidence === null ? "" : JSON.stringify(evidence, null, 2)),
    [evidence],
  );

  const allChecks = [...serverChecks, ...walletChecks];

  return (
    <div className="release-console">
      <header className="release-console__hero">
        <p className="role-state">
          <span aria-hidden="true" className="role-state__marker" />
          Release authority · Browser only
        </p>
        <h1>Midnight Preprod release gate</h1>
        <p>
          This route prepares one real contract deployment. It never uses a seed
          phrase or CLI wallet; 1AM must approve the actual transaction.
        </p>
      </header>

      <section
        className="release-console__configuration"
        aria-labelledby="release-config-title"
      >
        <div className="section-heading">
          <div>
            <h2 id="release-config-title">Pinned public configuration</h2>
            <p>
              Review the exact network boundary before asking 1AM for
              permission.
            </p>
          </div>
          <span className="section-heading__state">{APTOR_NETWORK}</span>
        </div>
        <dl className="release-facts">
          <div>
            <dt>RPC</dt>
            <dd>{APTOR_RPC_URL}</dd>
          </div>
          <div>
            <dt>Indexer</dt>
            <dd>{APTOR_INDEXER_URL}</dd>
          </div>
          <div>
            <dt>Artifacts</dt>
            <dd>{APTOR_ARTIFACT_FINGERPRINT || "Not configured"}</dd>
          </div>
        </dl>
      </section>

      <section
        className="release-console__checks"
        aria-labelledby="release-checks-title"
      >
        <div className="section-heading">
          <div>
            <h2 id="release-checks-title">Preflight</h2>
            <p>
              Every real dependency must pass. The absent contract is the only
              deployment-mode skip.
            </p>
          </div>
          <button
            className="action-button action-button--secondary"
            disabled={busy !== null}
            onClick={() => void runServerChecks()}
            type="button"
          >
            Re-run server checks
          </button>
        </div>
        <ol className="release-check-list">
          {allChecks.map((check) => (
            <li data-status={check.status} key={check.id}>
              <span>{statusLabel(check.status)}</span>
              <div>
                <strong>{check.label}</strong>
                <p>{check.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <div className="release-console__wallet">
        <WalletPanel wallet={wallet} />
        {wallet.status === "not-detected" ? (
          <p className="form-message form-message--error" role="alert">
            Connect 1AM: install or enable the 1AM extension, then detect again.
          </p>
        ) : null}
        <button
          className="action-button"
          data-state={busy === "wallet-preflight" ? "loading" : undefined}
          disabled={!serverReady || busy !== null}
          onClick={() => void runWalletChecks()}
          type="button"
        >
          {busy === "wallet-preflight"
            ? "Checking 1AM…"
            : "Verify 1AM readiness"}
        </button>
        {walletCheckFeedback !== null ? (
          <p
            aria-live="polite"
            className={`release-wallet-feedback release-wallet-feedback--${walletCheckFeedback.tone}`}
            role={walletCheckFeedback.tone === "error" ? "alert" : "status"}
          >
            {walletCheckFeedback.message}
          </p>
        ) : null}
      </div>

      <section
        className="release-console__approval"
        aria-labelledby="release-approval-title"
      >
        <div className="section-heading">
          <div>
            <h2 id="release-approval-title">Explicit deployment approval</h2>
            <p>
              1AM will still show the final transaction approval after this
              local confirmation.
            </p>
          </div>
          <span className="section-heading__state">One deployment</span>
        </div>
        <label className="field">
          <span>Type {CONFIRMATION_PHRASE}</span>
          <input
            autoComplete="off"
            onChange={(event) => setConfirmation(event.target.value)}
            spellCheck={false}
            value={confirmation}
          />
        </label>
        <button
          className="action-button action-button--danger"
          disabled={
            !serverReady ||
            !walletReady ||
            confirmation !== CONFIRMATION_PHRASE ||
            busy !== null ||
            evidence !== null
          }
          onClick={() => void deploy()}
          type="button"
        >
          {busy === "deploy"
            ? "Waiting for 1AM and finalization…"
            : "Deploy once to Preprod"}
        </button>
        {error ? (
          <p className="form-message form-message--error" role="alert">
            {error}
          </p>
        ) : null}
      </section>

      {evidence !== null ? (
        <section
          className="release-console__evidence"
          aria-labelledby="release-evidence-title"
        >
          <div className="section-heading">
            <div>
              <h2 id="release-evidence-title">Verified deployment record</h2>
              <p>
                The contract was queried through the configured indexer after
                finalization.
              </p>
            </div>
            <button
              className="action-button action-button--secondary"
              onClick={() => void navigator.clipboard.writeText(evidenceJson)}
              type="button"
            >
              Copy evidence JSON
            </button>
          </div>
          <pre>{evidenceJson}</pre>
          <div className="button-row">
            <a
              className="text-button"
              href={evidence.explorerUrl}
              rel="noreferrer"
              target="_blank"
            >
              Open Midnight Explorer
            </a>
            <a
              className="text-button"
              href={evidence.oneAmExplorerUrl}
              rel="noreferrer"
              target="_blank"
            >
              Open 1AM Explorer
            </a>
          </div>
        </section>
      ) : null}
    </div>
  );
}
