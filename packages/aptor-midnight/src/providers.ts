import path from "node:path";
import { httpClientProofProvider } from "@midnight-ntwrk/midnight-js-http-client-proof-provider";
import { indexerPublicDataProvider } from "@midnight-ntwrk/midnight-js-indexer-public-data-provider";
import { levelPrivateStateProvider } from "@midnight-ntwrk/midnight-js-level-private-state-provider";
import { NodeZkConfigProvider } from "@midnight-ntwrk/midnight-js-node-zk-config-provider";
import type { ProofProvider } from "@midnight-ntwrk/midnight-js-types";
import type { AptorCredentialPrivateState } from "@aptor/credential-contract";
import type { LocalMidnightConfig } from "./config.js";
import type {
  AptorCredentialCircuitKey,
  AptorCredentialPrivateStateId,
  AptorCredentialProviders,
} from "./types.js";
import type { LocalWalletProvider } from "./wallet.js";

export type ProofInvocationMetrics = {
  proveTxCalls: number;
};

function measuredProofProvider(
  provider: ProofProvider,
  metrics: ProofInvocationMetrics,
): ProofProvider {
  return {
    async proveTx(transaction, config) {
      metrics.proveTxCalls += 1;
      return provider.proveTx(transaction, config);
    },
  };
}

export function createAptorProviders(
  config: LocalMidnightConfig,
  walletProvider: LocalWalletProvider,
  fixtureId: string,
  metrics: ProofInvocationMetrics,
): AptorCredentialProviders {
  const zkConfigProvider = new NodeZkConfigProvider<AptorCredentialCircuitKey>(
    config.zkConfigPath,
  );
  const databaseName = path.resolve(
    config.privateStateRoot,
    fixtureId,
    "midnight-level-db",
  );

  return {
    privateStateProvider: levelPrivateStateProvider<
      AptorCredentialPrivateStateId,
      AptorCredentialPrivateState
    >({
      midnightDbName: databaseName,
      privateStateStoreName: "private-states",
      signingKeyStoreName: "signing-keys",
      privateStoragePasswordProvider: () => "Aptor-Local-Test-2026!",
      accountId: `aptor-local-${fixtureId}`,
    }),
    publicDataProvider: indexerPublicDataProvider(
      config.indexer,
      config.indexerWS,
    ),
    zkConfigProvider,
    proofProvider: measuredProofProvider(
      httpClientProofProvider(config.proofServer, zkConfigProvider, {
        timeout: 600_000,
      }),
      metrics,
    ),
    walletProvider,
    midnightProvider: walletProvider,
  };
}
