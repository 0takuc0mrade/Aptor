import assert from "node:assert/strict";
import test from "node:test";

import type {
  ConnectedAPI,
  InitialAPI,
} from "@midnight-ntwrk/dapp-connector-api";

import {
  AptorError,
  connectWallet,
  createBrowserProviders,
  discoverWallets,
  withFinalizationTimeout,
  type ConnectedWallet,
  type DiscoveredWallet,
} from "../src/index.js";

function connectedApi(overrides: Partial<ConnectedAPI> = {}): ConnectedAPI {
  return {
    getConnectionStatus: async () => ({
      status: "connected",
      networkId: "undeployed",
    }),
    getConfiguration: async () => ({
      networkId: "undeployed",
      indexerUri: "http://127.0.0.1:8088/api/v4/graphql",
      indexerWsUri: "ws://127.0.0.1:8088/api/v4/graphql/ws",
      proverServerUri: "http://127.0.0.1:6300",
    }),
    getShieldedAddresses: async () => ({
      shieldedCoinPublicKey: "coin-public-key",
      shieldedEncryptionPublicKey: "encryption-public-key",
    }),
    getUnshieldedAddress: async () => ({
      unshieldedAddress: "mn_addr_123456789",
    }),
    getDustBalance: async () => ({ balance: 10n, cap: 100n }),
    hintUsage: async () => undefined,
    getProvingProvider: async () => ({
      check: async () => [],
      prove: async () => new Uint8Array([1]),
    }),
    balanceUnsealedTransaction: async () => ({ tx: "00" }),
    submitTransaction: async () => undefined,
    ...overrides,
  } as unknown as ConnectedAPI;
}

function discoveredWallet(api: ConnectedAPI): DiscoveredWallet {
  const initial = {
    apiVersion: "4.0.1",
    icon: "data:image/svg+xml,<svg/>",
    name: "Test wallet",
    rdns: "network.midnight.test",
    connect: async () => api,
  } as unknown as InitialAPI;
  return {
    id: "wallet-id",
    name: initial.name,
    rdns: initial.rdns,
    apiVersion: initial.apiVersion,
    api: initial,
  };
}

function connectedWallet(api: ConnectedAPI): ConnectedWallet {
  return {
    wallet: discoveredWallet(api),
    api,
    network: "undeployed",
    address: "mn_addr_123456789",
    dustBalance: 10n,
  };
}

async function withFetch<T>(
  fetchStub: typeof fetch,
  operation: () => Promise<T>,
): Promise<T> {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = fetchStub;
  try {
    return await operation();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

test("wallet discovery filters incompatible connectors", () => {
  const api = discoveredWallet(connectedApi()).api;
  const incompatible = {
    ...api,
    apiVersion: "3.9.0",
  } as InitialAPI;
  const wallets = discoverWallets({ compatible: api, incompatible });

  assert.deepEqual(
    wallets.map(({ id }) => id),
    ["compatible"],
  );
  assert.deepEqual(discoverWallets(undefined), []);
});

test("wallet connection distinguishes rejection and wrong network", async () => {
  const rejected = discoveredWallet(connectedApi());
  rejected.api.connect = async () => {
    throw new Error("User rejected");
  };
  await assert.rejects(
    connectWallet(rejected, "undeployed"),
    (error: unknown) =>
      error instanceof AptorError &&
      error.code === "WALLET_CONNECTION_REJECTED",
  );

  const wrongNetwork = discoveredWallet(
    connectedApi({
      getConnectionStatus: async () => ({
        status: "connected",
        networkId: "preprod",
      }),
    }),
  );
  await assert.rejects(
    connectWallet(wrongNetwork, "undeployed"),
    (error: unknown) =>
      error instanceof AptorError && error.code === "WRONG_NETWORK",
  );
});

test("browser provider assembly succeeds with an official proving API", async () => {
  await withFetch(
    (async () => new Response(null, { status: 200 })) as typeof fetch,
    async () => {
      const result = await createBrowserProviders(
        connectedWallet(connectedApi()),
        "https://aptor.invalid/zk",
      );
      assert.ok(result.providers.publicDataProvider);
      assert.ok(result.providers.proofProvider);
      assert.ok(result.providers.walletProvider);
      await result.privateStateProvider.dispose();
    },
  );
});

test("browser provider assembly reports missing artifacts and proving failures", async () => {
  await withFetch(
    (async () => new Response(null, { status: 404 })) as typeof fetch,
    async () => {
      await assert.rejects(
        createBrowserProviders(
          connectedWallet(connectedApi()),
          "https://aptor.invalid/missing",
        ),
        (error: unknown) =>
          error instanceof AptorError && error.code === "MISSING_ZK_ARTIFACTS",
      );
    },
  );

  await withFetch(
    (async () => new Response(null, { status: 200 })) as typeof fetch,
    async () => {
      await assert.rejects(
        createBrowserProviders(
          connectedWallet(
            connectedApi({
              getProvingProvider: async () => {
                throw new Error("Prover unavailable");
              },
            }),
          ),
          "https://aptor.invalid/zk",
        ),
        (error: unknown) =>
          error instanceof AptorError &&
          error.code === "PROOF_GENERATION_FAILED",
      );
    },
  );
});

test("transaction finalization has a retry-safe timeout", async () => {
  await assert.rejects(
    withFinalizationTimeout(new Promise<never>(() => undefined), 5),
    (error: unknown) =>
      error instanceof AptorError && error.code === "FINALIZATION_TIMEOUT",
  );
});
