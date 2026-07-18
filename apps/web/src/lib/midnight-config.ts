import type { AptorNetwork } from "@aptor/browser";

const requestedNetwork = process.env.NEXT_PUBLIC_APTOR_NETWORK ?? "preprod";

export const APTOR_NETWORK: AptorNetwork = (
  ["mainnet", "preview", "preprod", "undeployed"] as const
).includes(requestedNetwork as AptorNetwork)
  ? (requestedNetwork as AptorNetwork)
  : "preprod";

const endpointDefaults = {
  mainnet: {
    indexer: "https://indexer.mainnet.midnight.network/api/v4/graphql",
    indexerWs: "wss://indexer.mainnet.midnight.network/api/v4/graphql/ws",
  },
  preview: {
    indexer: "https://indexer.preview.midnight.network/api/v4/graphql",
    indexerWs: "wss://indexer.preview.midnight.network/api/v4/graphql/ws",
  },
  preprod: {
    indexer: "https://indexer.preprod.midnight.network/api/v4/graphql",
    indexerWs: "wss://indexer.preprod.midnight.network/api/v4/graphql/ws",
  },
  undeployed: {
    indexer: "http://127.0.0.1:8088/api/v4/graphql",
    indexerWs: "ws://127.0.0.1:8088/api/v4/graphql/ws",
  },
} as const;

export const APTOR_CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_APTOR_CONTRACT_ADDRESS ?? "";
export const APTOR_INDEXER_URL =
  process.env.NEXT_PUBLIC_APTOR_INDEXER_URL ??
  endpointDefaults[APTOR_NETWORK].indexer;
export const APTOR_INDEXER_WS_URL =
  process.env.NEXT_PUBLIC_APTOR_INDEXER_WS_URL ??
  endpointDefaults[APTOR_NETWORK].indexerWs;
export const APTOR_ZK_ARTIFACTS_URL =
  process.env.NEXT_PUBLIC_APTOR_ZK_ARTIFACTS_URL ?? "/zk/aptor";

export function requireContractAddress(): string {
  if (APTOR_CONTRACT_ADDRESS.trim().length === 0) {
    throw new Error(
      "No Aptor contract address is configured. Set NEXT_PUBLIC_APTOR_CONTRACT_ADDRESS and restart the app.",
    );
  }
  return APTOR_CONTRACT_ADDRESS;
}
