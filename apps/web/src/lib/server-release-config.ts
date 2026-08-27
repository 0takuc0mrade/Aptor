import { isAbsolute, resolve } from "node:path";

import {
  APTOR_NETWORK,
  releaseConfigurationIssues,
  type ReleaseConfigurationIssue,
} from "./midnight-config";
import {
  APTOR_CHAIN_MODE,
  HSK_CHAIN_ID,
  HSK_CREDENTIAL_REGISTRY_ADDRESS,
  HSK_PROOF_REQUESTS_ADDRESS,
  HSK_RPC_URL,
} from "./hsk-config";

export const APTOR_DELIVERY_DB_PATH =
  process.env.APTOR_DELIVERY_DB_PATH ??
  resolve(process.cwd(), ".aptor-delivery", "aptor.sqlite");
export const APTOR_PUBLIC_URL = process.env.APTOR_PUBLIC_URL?.trim() ?? "";

function isPublicHttpsOrigin(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.username.length === 0 &&
      url.password.length === 0 &&
      url.pathname === "/" &&
      url.search.length === 0 &&
      url.hash.length === 0 &&
      (value === url.origin || value === `${url.origin}/`)
    );
  } catch {
    return false;
  }
}

function hskReleaseConfigurationIssues(
  options: Readonly<{ requireContractAddress?: boolean }>,
): ReleaseConfigurationIssue[] {
  const issues: ReleaseConfigurationIssue[] = [];
  if (options.requireContractAddress !== false) {
    if (!HSK_CREDENTIAL_REGISTRY_ADDRESS) {
      issues.push({
        field: "NEXT_PUBLIC_HSK_CREDENTIAL_REGISTRY_ADDRESS",
        message: "Set the deployed Aptor credential registry address.",
      });
    }
    if (!HSK_PROOF_REQUESTS_ADDRESS) {
      issues.push({
        field: "NEXT_PUBLIC_HSK_PROOF_REQUESTS_ADDRESS",
        message: "Set the deployed Aptor proof requests address.",
      });
    }
  }
  if (![133, 177, 31_337].includes(HSK_CHAIN_ID)) {
    issues.push({
      field: "NEXT_PUBLIC_HSK_CHAIN_ID",
      message: "Use HSK testnet 133, HSK mainnet 177, or local Anvil 31337.",
    });
  }
  if (HSK_CHAIN_ID !== 31_337 && !HSK_RPC_URL.startsWith("https://")) {
    issues.push({
      field: "NEXT_PUBLIC_HSK_RPC_URL",
      message: "A public HSK deployment must use an HTTPS RPC endpoint.",
    });
  }
  return issues;
}

export function serverReleaseConfigurationIssues(
  options: Readonly<{
    requireContractAddress?: boolean;
    requireHosting?: boolean;
  }> = {},
): ReleaseConfigurationIssue[] {
  const issues =
    APTOR_CHAIN_MODE === "hsk"
      ? hskReleaseConfigurationIssues(options)
      : releaseConfigurationIssues(options);
  const isHostedRelease =
    APTOR_CHAIN_MODE === "hsk"
      ? HSK_CHAIN_ID !== 31_337
      : APTOR_NETWORK === "preprod";
  if (!isHostedRelease || options.requireHosting === false) {
    return issues;
  }
  if (!isAbsolute(APTOR_DELIVERY_DB_PATH)) {
    issues.push({
      field: "APTOR_DELIVERY_DB_PATH",
      message: "Use an absolute path on the host's persistent disk.",
    });
  }
  if (!isPublicHttpsOrigin(APTOR_PUBLIC_URL)) {
    issues.push({
      field: "APTOR_PUBLIC_URL",
      message: "Set the final public HTTPS origin without a path or query.",
    });
  }
  return issues;
}
