import { defineChain, getAddress, type Address } from "viem";

export const APTOR_CHAIN_MODE =
  process.env.NEXT_PUBLIC_APTOR_CHAIN_MODE === "hsk" ? "hsk" : "midnight";

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function optionalAddress(value: string | undefined): Address | undefined {
  const trimmed = value?.trim();
  return trimmed ? getAddress(trimmed) : undefined;
}

export const HSK_CHAIN_ID = positiveInteger(
  process.env.NEXT_PUBLIC_HSK_CHAIN_ID,
  31_337,
);
export const HSK_RPC_URL =
  process.env.NEXT_PUBLIC_HSK_RPC_URL?.trim() || "http://127.0.0.1:8545";
export const HSK_EXPLORER_URL =
  process.env.NEXT_PUBLIC_HSK_EXPLORER_URL?.trim() || "";
export const HSK_CREDENTIAL_REGISTRY_ADDRESS = optionalAddress(
  process.env.NEXT_PUBLIC_HSK_CREDENTIAL_REGISTRY_ADDRESS,
);
export const HSK_PROOF_REQUESTS_ADDRESS = optionalAddress(
  process.env.NEXT_PUBLIC_HSK_PROOF_REQUESTS_ADDRESS,
);
export const HSK_NETWORK =
  HSK_CHAIN_ID === 31_337
    ? "hsk-local"
    : process.env.NEXT_PUBLIC_HSK_NETWORK === "mainnet"
      ? "hsk-mainnet"
      : "hsk-testnet";

export const HSK_CHAIN = defineChain({
  id: HSK_CHAIN_ID,
  name: HSK_NETWORK === "hsk-local" ? "Anvil" : "HSK Chain",
  nativeCurrency: { name: "HSK", symbol: "HSK", decimals: 18 },
  rpcUrls: { default: { http: [HSK_RPC_URL] } },
  ...(HSK_EXPLORER_URL
    ? {
        blockExplorers: {
          default: { name: "HSK Explorer", url: HSK_EXPLORER_URL },
        },
      }
    : {}),
});

export function requireHskContracts(): {
  credentialRegistry: Address;
  proofRequests: Address;
} {
  if (!HSK_CREDENTIAL_REGISTRY_ADDRESS || !HSK_PROOF_REQUESTS_ADDRESS) {
    throw new Error(
      "HSK contracts are not configured. Set both NEXT_PUBLIC_HSK_CREDENTIAL_REGISTRY_ADDRESS and NEXT_PUBLIC_HSK_PROOF_REQUESTS_ADDRESS.",
    );
  }
  return {
    credentialRegistry: HSK_CREDENTIAL_REGISTRY_ADDRESS,
    proofRequests: HSK_PROOF_REQUESTS_ADDRESS,
  };
}

export function hskTransactionUrl(hash: string): string | undefined {
  return HSK_EXPLORER_URL
    ? `${HSK_EXPLORER_URL.replace(/\/$/u, "")}/tx/${hash}`
    : undefined;
}
