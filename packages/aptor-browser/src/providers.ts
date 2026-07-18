import type {
  ConnectedAPI,
  InitialAPI,
} from "@midnight-ntwrk/dapp-connector-api";
import {
  Transaction,
  type FinalizedTransaction,
  type TransactionId,
} from "@midnight-ntwrk/ledger-v8";
import { indexerPublicDataProvider } from "@midnight-ntwrk/midnight-js-indexer-public-data-provider";
import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import {
  asContractAddress,
  createProofProvider,
  type MidnightProviders,
  type UnboundTransaction,
} from "@midnight-ntwrk/midnight-js-types";
import type { AptorCredentialPrivateState } from "@aptor/credential-contract";

import { bytesToHex, hexToBytes } from "./encoding.js";
import { AptorError } from "./errors.js";
import { EphemeralPrivateStateProvider } from "./private-state.js";
import type { AptorNetwork } from "./schemas.js";
import {
  AptorFetchZkConfigProvider,
  validateZkArtifactManifest,
  type AptorCircuit,
} from "./zk.js";

export const APTOR_PRIVATE_STATE_KEY = "aptorCredentialPrivateState" as const;
export type AptorBrowserProviders = MidnightProviders<
  AptorCircuit,
  typeof APTOR_PRIVATE_STATE_KEY,
  AptorCredentialPrivateState
>;

export type DiscoveredWallet = Readonly<{
  id: string;
  name: string;
  rdns: string;
  apiVersion: string;
  api: InitialAPI;
}>;

export type ConnectedWallet = Readonly<{
  wallet: DiscoveredWallet;
  api: ConnectedAPI;
  network: AptorNetwork;
  address: string;
  dustBalance: bigint;
}>;

function isCompatibleVersion(value: string): boolean {
  const major = Number.parseInt(value.split(".")[0] ?? "", 10);
  return major === 4;
}

export function discoverWallets(
  source: Record<string, InitialAPI> | undefined = typeof window === "undefined"
    ? undefined
    : (window as Window & { midnight?: Record<string, InitialAPI> }).midnight,
): DiscoveredWallet[] {
  if (source === undefined) return [];
  return Object.entries(source)
    .filter(([, wallet]) => isCompatibleVersion(wallet.apiVersion))
    .map(([id, api]) => ({
      id,
      name: api.name,
      rdns: api.rdns,
      apiVersion: api.apiVersion,
      api,
    }));
}

export async function connectWallet(
  wallet: DiscoveredWallet,
  network: AptorNetwork,
): Promise<ConnectedWallet> {
  try {
    const api = await wallet.api.connect(network);
    const status = await api.getConnectionStatus();
    if (status.status !== "connected") {
      throw new AptorError(
        "WALLET_CONNECTION_LOST",
        "The wallet connection closed before Aptor could use it.",
      );
    }
    if (status.networkId !== network) {
      throw new AptorError(
        "WRONG_NETWORK",
        `Switch the wallet to ${network} and connect again.`,
      );
    }
    const config = await api.getConfiguration();
    if (config.networkId !== network) {
      throw new AptorError(
        "WRONG_NETWORK",
        `The wallet services target ${config.networkId}, not ${network}.`,
      );
    }
    const [{ unshieldedAddress }, dust] = await Promise.all([
      api.getUnshieldedAddress(),
      api.getDustBalance(),
    ]);
    return {
      wallet,
      api,
      network,
      address: unshieldedAddress,
      dustBalance: dust.balance,
    };
  } catch (error) {
    if (error instanceof AptorError) throw error;
    throw new AptorError(
      "WALLET_CONNECTION_REJECTED",
      "The wallet did not approve Aptor. Unlock it and approve the connection to retry.",
      { cause: error },
    );
  }
}

export async function createBrowserProviders(
  connected: ConnectedWallet,
  zkArtifactsUrl: string,
  privateStateProvider = new EphemeralPrivateStateProvider<
    typeof APTOR_PRIVATE_STATE_KEY,
    AptorCredentialPrivateState
  >(),
): Promise<{
  providers: AptorBrowserProviders;
  privateStateProvider: EphemeralPrivateStateProvider<
    typeof APTOR_PRIVATE_STATE_KEY,
    AptorCredentialPrivateState
  >;
}> {
  const { api } = connected;
  const status = await api.getConnectionStatus();
  if (status.status !== "connected") {
    throw new AptorError(
      "WALLET_CONNECTION_LOST",
      "Reconnect the wallet before continuing.",
    );
  }
  if (status.networkId !== connected.network) {
    throw new AptorError(
      "WRONG_NETWORK",
      `Switch the wallet back to ${connected.network}.`,
    );
  }
  const configuration = await api.getConfiguration();
  const shielded = await api.getShieldedAddresses();
  setNetworkId(connected.network);
  await validateZkArtifactManifest(zkArtifactsUrl);
  const zkConfigProvider = new AptorFetchZkConfigProvider(zkArtifactsUrl);

  try {
    await api.hintUsage([
      "getConfiguration",
      "getShieldedAddresses",
      "getProvingProvider",
      "balanceUnsealedTransaction",
      "submitTransaction",
    ]);
    const provingProvider = await api.getProvingProvider(
      zkConfigProvider.asKeyMaterialProvider(),
    );
    const walletProvider = {
      getCoinPublicKey: () => shielded.shieldedCoinPublicKey,
      getEncryptionPublicKey: () => shielded.shieldedEncryptionPublicKey,
      async balanceTx(tx: UnboundTransaction): Promise<FinalizedTransaction> {
        const result = await api.balanceUnsealedTransaction(
          bytesToHex(tx.serialize()),
        );
        return Transaction.deserialize(
          "signature",
          "proof",
          "binding",
          hexToBytes(result.tx),
        );
      },
    };
    const midnightProvider = {
      async submitTx(tx: FinalizedTransaction): Promise<TransactionId> {
        const [identifier] = tx.identifiers();
        if (identifier === undefined) {
          throw new AptorError(
            "TRANSACTION_SUBMISSION_FAILED",
            "The finalized transaction has no identifier.",
          );
        }
        await api.submitTransaction(bytesToHex(tx.serialize()));
        return identifier;
      },
    };
    const providers: AptorBrowserProviders = {
      privateStateProvider,
      publicDataProvider: indexerPublicDataProvider(
        configuration.indexerUri,
        configuration.indexerWsUri,
      ),
      zkConfigProvider,
      proofProvider: createProofProvider(provingProvider),
      walletProvider,
      midnightProvider,
      loggerProvider: {
        isLevelEnabled: () => false,
      },
    };
    return { providers, privateStateProvider };
  } catch (error) {
    await privateStateProvider.dispose();
    if (error instanceof AptorError) throw error;
    throw new AptorError(
      "PROOF_GENERATION_FAILED",
      "The wallet could not prepare Aptor's proof provider. Check its proving service and retry.",
      { cause: error },
    );
  }
}

export async function hydrateProofPrivateState(
  provider: EphemeralPrivateStateProvider<
    typeof APTOR_PRIVATE_STATE_KEY,
    AptorCredentialPrivateState
  >,
  contractAddress: string,
  privateState: AptorCredentialPrivateState,
): Promise<void> {
  provider.setContractAddress(asContractAddress(contractAddress));
  await provider.set(APTOR_PRIVATE_STATE_KEY, privateState);
}
