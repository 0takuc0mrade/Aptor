import type { AptorNetwork } from "@aptor/browser";

export type AptorReleaseNetwork = Extract<
  AptorNetwork,
  "undeployed" | "preprod"
>;

type EndpointDefaults = Readonly<{
  rpc: string;
  indexer: string;
  indexerWs: string;
  explorer: string;
  oneAmExplorer: string;
}>;

const endpointDefaults: Record<AptorReleaseNetwork, EndpointDefaults> = {
  undeployed: {
    rpc: "",
    indexer: "",
    indexerWs: "",
    explorer: "",
    oneAmExplorer: "",
  },
  preprod: {
    rpc: "https://rpc.preprod.midnight.network",
    indexer: "https://indexer.preprod.midnight.network/api/v4/graphql",
    indexerWs: "wss://indexer.preprod.midnight.network/api/v4/graphql/ws",
    explorer: "https://preprod.midnightexplorer.com",
    oneAmExplorer: "https://explorer.1am.xyz/?network=preprod",
  },
};

function releaseNetwork(value: string | undefined): AptorReleaseNetwork {
  const requested = value ?? "undeployed";
  if (requested === "undeployed" || requested === "preprod") return requested;
  throw new Error(
    `Unsupported Aptor network "${requested}". Use "undeployed" for LocalNet or "preprod" for the public release.`,
  );
}

function publicEnvironmentValue(
  value: string | undefined,
  fallback: string,
): string {
  return value?.trim() || fallback;
}

export const APTOR_NETWORK = releaseNetwork(
  process.env.NEXT_PUBLIC_APTOR_NETWORK,
);
const defaults = endpointDefaults[APTOR_NETWORK];

export const APTOR_CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_APTOR_CONTRACT_ADDRESS?.trim() ?? "";
export const APTOR_RPC_URL = publicEnvironmentValue(
  process.env.NEXT_PUBLIC_APTOR_RPC_URL,
  defaults.rpc,
);
export const APTOR_INDEXER_URL = publicEnvironmentValue(
  process.env.NEXT_PUBLIC_APTOR_INDEXER_URL,
  defaults.indexer,
);
export const APTOR_INDEXER_WS_URL = publicEnvironmentValue(
  process.env.NEXT_PUBLIC_APTOR_INDEXER_WS_URL,
  defaults.indexerWs,
);
export const APTOR_EXPLORER_URL = publicEnvironmentValue(
  process.env.NEXT_PUBLIC_APTOR_EXPLORER_URL,
  defaults.explorer,
);
export const APTOR_1AM_EXPLORER_URL = publicEnvironmentValue(
  process.env.NEXT_PUBLIC_APTOR_1AM_EXPLORER_URL,
  defaults.oneAmExplorer,
);
export const APTOR_ZK_ARTIFACTS_URL = publicEnvironmentValue(
  process.env.NEXT_PUBLIC_APTOR_ZK_ARTIFACTS_URL,
  "/zk/aptor",
);
export const APTOR_ARTIFACT_FINGERPRINT =
  process.env.NEXT_PUBLIC_APTOR_ARTIFACT_FINGERPRINT?.trim().toLowerCase() ??
  "";
export const APTOR_PREPROD_DEPLOYMENT_ENABLED =
  process.env.NEXT_PUBLIC_APTOR_ENABLE_PREPROD_DEPLOYMENT === "true";

const LOCAL_ENDPOINT_PATTERN =
  /^(?:https?|wss?):\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(?::|\/|$)/iu;
const SHA_256_PATTERN = /^[0-9a-f]{64}$/u;
const CONTRACT_ADDRESS_PATTERN = /^[0-9a-f]{64}$/u;

export type ReleaseConfigurationIssue = Readonly<{
  field: string;
  message: string;
}>;

export function releaseConfigurationIssues(
  options: Readonly<{ requireContractAddress?: boolean }> = {},
): ReleaseConfigurationIssue[] {
  const issues: ReleaseConfigurationIssue[] = [];
  const requireContractAddress = options.requireContractAddress ?? true;
  if (requireContractAddress && APTOR_CONTRACT_ADDRESS.length === 0) {
    issues.push({
      field: "NEXT_PUBLIC_APTOR_CONTRACT_ADDRESS",
      message:
        APTOR_NETWORK === "preprod"
          ? "Set the finalized Preprod contract address."
          : "Set the deployed LocalNet contract address.",
    });
  }
  if (
    APTOR_CONTRACT_ADDRESS.length > 0 &&
    !CONTRACT_ADDRESS_PATTERN.test(APTOR_CONTRACT_ADDRESS)
  ) {
    issues.push({
      field: "NEXT_PUBLIC_APTOR_CONTRACT_ADDRESS",
      message: "Use the finalized 32-byte hexadecimal contract address.",
    });
  }
  if (
    APTOR_ARTIFACT_FINGERPRINT.length > 0 &&
    !SHA_256_PATTERN.test(APTOR_ARTIFACT_FINGERPRINT)
  ) {
    issues.push({
      field: "NEXT_PUBLIC_APTOR_ARTIFACT_FINGERPRINT",
      message: "Use the 64-character SHA-256 emitted by npm run zk:sync.",
    });
  }
  if (APTOR_NETWORK === "preprod" && APTOR_ARTIFACT_FINGERPRINT.length === 0) {
    issues.push({
      field: "NEXT_PUBLIC_APTOR_ARTIFACT_FINGERPRINT",
      message: "Configure the exact contract and ZK artifact fingerprint.",
    });
  }
  if (APTOR_NETWORK === "preprod") {
    for (const [field, value] of [
      ["NEXT_PUBLIC_APTOR_RPC_URL", APTOR_RPC_URL],
      ["NEXT_PUBLIC_APTOR_INDEXER_URL", APTOR_INDEXER_URL],
      ["NEXT_PUBLIC_APTOR_INDEXER_WS_URL", APTOR_INDEXER_WS_URL],
      ["NEXT_PUBLIC_APTOR_EXPLORER_URL", APTOR_EXPLORER_URL],
      ["NEXT_PUBLIC_APTOR_1AM_EXPLORER_URL", APTOR_1AM_EXPLORER_URL],
    ] as const) {
      if (LOCAL_ENDPOINT_PATTERN.test(value)) {
        issues.push({
          field,
          message: "A Preprod release cannot use a LocalNet endpoint.",
        });
      }
    }
    if (!APTOR_RPC_URL.startsWith("https://")) {
      issues.push({
        field: "NEXT_PUBLIC_APTOR_RPC_URL",
        message: "The Preprod RPC must use HTTPS.",
      });
    }
    if (!APTOR_INDEXER_URL.startsWith("https://")) {
      issues.push({
        field: "NEXT_PUBLIC_APTOR_INDEXER_URL",
        message: "The Preprod indexer must use HTTPS.",
      });
    }
    if (!APTOR_INDEXER_WS_URL.startsWith("wss://")) {
      issues.push({
        field: "NEXT_PUBLIC_APTOR_INDEXER_WS_URL",
        message: "The Preprod indexer WebSocket must use WSS.",
      });
    }
  }
  return issues;
}

export function requireContractAddress(): string {
  if (APTOR_CONTRACT_ADDRESS.length === 0) {
    throw new Error(
      "No Aptor contract address is configured. Set NEXT_PUBLIC_APTOR_CONTRACT_ADDRESS and restart the app.",
    );
  }
  if (!CONTRACT_ADDRESS_PATTERN.test(APTOR_CONTRACT_ADDRESS)) {
    throw new Error(
      "The configured Aptor contract address is not a 32-byte hexadecimal Midnight address.",
    );
  }
  return APTOR_CONTRACT_ADDRESS;
}
