import { fetchZkArtifactManifest, queryContractPresence } from "@aptor/browser";
import { getDeliveryHealth } from "@aptor/delivery";

import {
  APTOR_ARTIFACT_FINGERPRINT,
  APTOR_CONTRACT_ADDRESS,
  APTOR_INDEXER_URL,
  APTOR_INDEXER_WS_URL,
  APTOR_NETWORK,
  APTOR_RPC_URL,
  APTOR_ZK_ARTIFACTS_URL,
} from "./midnight-config";
import { serverReleaseConfigurationIssues } from "./server-release-config";

export type ReleasePreflightCheck = Readonly<{
  id: string;
  label: string;
  status: "pass" | "fail" | "skip";
  detail: string;
}>;

async function check(
  id: string,
  label: string,
  operation: () => Promise<string> | string,
): Promise<ReleasePreflightCheck> {
  try {
    return { id, label, status: "pass", detail: await operation() };
  } catch (error) {
    return {
      id,
      label,
      status: "fail",
      detail: error instanceof Error ? error.message : "The check failed.",
    };
  }
}

async function fetchWithTimeout(
  input: string,
  init: RequestInit,
): Promise<Response> {
  const response = await fetch(input, {
    ...init,
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`${new URL(input).host} returned HTTP ${response.status}.`);
  }
  return response;
}

export async function runReleasePreflight(
  requestUrl: string,
  options: Readonly<{ requireContractAddress: boolean }>,
): Promise<ReleasePreflightCheck[]> {
  const checks: ReleasePreflightCheck[] = [];
  checks.push(
    await check("configuration", "Release configuration", () => {
      const issues = serverReleaseConfigurationIssues({
        ...options,
        requireHosting: options.requireContractAddress,
      });
      if (issues.length > 0) {
        throw new Error(
          issues.map((issue) => `${issue.field}: ${issue.message}`).join(" "),
        );
      }
      return `${APTOR_NETWORK} endpoints contain no LocalNet fallbacks.`;
    }),
  );
  checks.push(
    await check("delivery", "Delivery storage", () => {
      const health = getDeliveryHealth();
      return `SQLite is writable at schema v${health.schemaVersion}.`;
    }),
  );
  checks.push(
    await check("rpc", "Midnight Preprod RPC", async () => {
      const response = await fetchWithTimeout(APTOR_RPC_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "system_health",
          params: [],
        }),
      });
      const payload = (await response.json()) as {
        result?: { isSyncing?: boolean; peers?: number };
        error?: unknown;
      };
      if (payload.error !== undefined || payload.result === undefined) {
        throw new Error("The RPC health response was invalid.");
      }
      if (payload.result.isSyncing) {
        throw new Error("The Preprod RPC is still syncing.");
      }
      return `RPC is synced with ${payload.result.peers ?? "available"} peers.`;
    }),
  );
  checks.push(
    await check("indexer", "Midnight Preprod indexer", async () => {
      const response = await fetchWithTimeout(APTOR_INDEXER_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          query: "query AptorPreflight { __typename }",
        }),
      });
      const payload = (await response.json()) as {
        data?: { __typename?: string };
        errors?: unknown;
      };
      if (
        payload.errors !== undefined ||
        payload.data?.__typename !== "Query"
      ) {
        throw new Error("The v4 indexer GraphQL response was invalid.");
      }
      return "Indexer v4 GraphQL is responding.";
    }),
  );
  checks.push(
    await check("artifacts", "Contract and ZK artifacts", async () => {
      const baseUrl = new URL(APTOR_ZK_ARTIFACTS_URL, requestUrl).toString();
      const manifest = await fetchZkArtifactManifest(
        baseUrl,
        APTOR_ARTIFACT_FINGERPRINT,
      );
      return `Compiler ${manifest.compilerVersion}; fingerprint ${manifest.fingerprint.slice(0, 12)}…`;
    }),
  );
  if (APTOR_CONTRACT_ADDRESS.length === 0) {
    checks.push({
      id: "contract",
      label: "Configured Aptor contract",
      status: options.requireContractAddress ? "fail" : "skip",
      detail: options.requireContractAddress
        ? "NEXT_PUBLIC_APTOR_CONTRACT_ADDRESS is missing."
        : "No address yet; deployment mode permits this one skipped check.",
    });
  } else {
    checks.push(
      await check("contract", "Configured Aptor contract", async () => {
        let present = false;
        try {
          present = await queryContractPresence({
            network: APTOR_NETWORK,
            indexerUrl: APTOR_INDEXER_URL,
            indexerWsUrl: APTOR_INDEXER_WS_URL,
            contractAddress: APTOR_CONTRACT_ADDRESS,
          });
        } catch {
          throw new Error(
            "Aptor contract not deployed: the configured address is invalid or not queryable.",
          );
        }
        if (!present) {
          throw new Error(
            "Aptor contract not deployed: the v4 indexer cannot find the configured address.",
          );
        }
        return "The configured contract state is queryable through the indexer.";
      }),
    );
  }
  return checks;
}
