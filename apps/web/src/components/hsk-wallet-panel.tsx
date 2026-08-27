"use client";

import type { HskWalletController } from "@/hooks/use-hsk-wallet";

const labels = {
  checking: "Checking for wallet",
  "not-detected": "Wallet not detected",
  disconnected: "Ready to connect",
  connecting: "Permission requested",
  "wrong-network": "Wrong network",
  ready: "Connected",
  rejected: "Connection rejected",
} as const;

function shorten(value: string): string {
  return value.length > 18 ? `${value.slice(0, 9)}…${value.slice(-7)}` : value;
}

export function HskWalletPanel({ wallet }: { wallet: HskWalletController }) {
  return (
    <section className="wallet-panel" aria-labelledby="hsk-wallet-panel-title">
      <header className="section-heading section-heading--compact">
        <div>
          <h2 id="hsk-wallet-panel-title">HSK wallet</h2>
          <p>Wallet permission is requested only for on-chain actions.</p>
        </div>
      </header>
      <div className="wallet-panel__status" data-status={wallet.status}>
        <span aria-hidden="true" />
        <strong>{labels[wallet.status]}</strong>
        <small>Chain {wallet.chainId}</small>
      </div>
      {wallet.status === "ready" ? (
        <dl className="wallet-facts">
          <div>
            <dt>Address</dt>
            <dd title={wallet.address}>{shorten(wallet.address)}</dd>
          </div>
          <div>
            <dt>Network</dt>
            <dd>HSK testnet · chain 133</dd>
          </div>
        </dl>
      ) : null}
      {wallet.status === "not-detected" ? (
        <p className="form-message" role="status">
          No wallet detected. Add HashKey Chain testnet (chain ID 133) and
          connect, then click Detect again.
        </p>
      ) : null}
      {wallet.error ? (
        <p className="form-message form-message--error" role="alert">
          {wallet.error}
        </p>
      ) : null}
      <div className="button-row">
        {wallet.status === "ready" ? (
          <button
            className="action-button action-button--secondary"
            onClick={wallet.disconnect}
            type="button"
          >
            Forget local connection
          </button>
        ) : (
          <button
            className="action-button"
            disabled={
              wallet.status === "checking" || wallet.status === "connecting"
            }
            onClick={() => void wallet.connect().catch(() => undefined)}
            type="button"
          >
            {wallet.status === "connecting"
              ? "Waiting for wallet…"
              : "Connect wallet"}
          </button>
        )}
        <button
          className="text-button"
          onClick={() => void wallet.refresh()}
          type="button"
        >
          Detect again
        </button>
      </div>
    </section>
  );
}
