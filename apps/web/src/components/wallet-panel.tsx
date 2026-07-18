"use client";

import type { AptorWalletController } from "@/hooks/use-aptor-wallet";

const statusLabels = {
  checking: "Checking for wallet",
  "not-detected": "Wallet not detected",
  detected: "Wallet detected",
  "permission-requested": "Permission requested",
  connected: "Connected",
  "wrong-network": "Wrong network",
  rejected: "Connection rejected",
  "connection-lost": "Connection lost",
} as const;

function shorten(value: string): string {
  return value.length > 18 ? `${value.slice(0, 9)}…${value.slice(-7)}` : value;
}

export function WalletPanel({ wallet }: { wallet: AptorWalletController }) {
  const connected = wallet.status === "connected";

  return (
    <section className="wallet-panel" aria-labelledby="wallet-panel-title">
      <header className="section-heading section-heading--compact">
        <div>
          <h2 id="wallet-panel-title">Midnight wallet</h2>
          <p>Wallet permission is requested only for on-chain actions.</p>
        </div>
      </header>

      <div className="wallet-panel__status" data-status={wallet.status}>
        <span aria-hidden="true" />
        <strong>{statusLabels[wallet.status]}</strong>
        <small>{wallet.network}</small>
      </div>

      {wallet.wallets.length > 1 ? (
        <label className="field">
          <span>Wallet</span>
          <select
            onChange={(event) => wallet.setSelectedWalletId(event.target.value)}
            value={wallet.selectedWalletId}
          >
            {wallet.wallets.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.name} · {candidate.rdns}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {connected ? (
        <dl className="wallet-facts">
          <div>
            <dt>Address</dt>
            <dd title={wallet.address}>{shorten(wallet.address)}</dd>
          </div>
          <div>
            <dt>DUST</dt>
            <dd>
              {wallet.dustBalance === BigInt(0)
                ? "Insufficient test funds"
                : "Available"}
            </dd>
          </div>
        </dl>
      ) : null}

      {wallet.error ? (
        <p className="form-message form-message--error" role="alert">
          {wallet.error}
        </p>
      ) : null}

      <div className="button-row">
        {connected ? (
          <button
            className="action-button action-button--secondary"
            onClick={wallet.disconnect}
            type="button"
          >
            Disconnect locally
          </button>
        ) : (
          <button
            className="action-button"
            disabled={
              wallet.status === "checking" ||
              wallet.status === "permission-requested"
            }
            onClick={() => void wallet.connect().catch(() => undefined)}
            type="button"
          >
            {wallet.status === "permission-requested"
              ? "Waiting for wallet…"
              : "Connect wallet"}
          </button>
        )}
        <button className="text-button" onClick={wallet.refresh} type="button">
          Detect again
        </button>
      </div>
    </section>
  );
}
