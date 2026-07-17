import path from "node:path";
import { fileURLToPath } from "node:url";
import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import type { EnvironmentConfiguration } from "@midnight-ntwrk/testkit-js";

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
const moduleParent = path.dirname(moduleDirectory);
const packageRoot =
  path.basename(moduleParent) === "dist"
    ? path.dirname(moduleParent)
    : moduleParent;

export type LocalMidnightConfig = Readonly<{
  networkId: "undeployed";
  indexer: string;
  indexerWS: string;
  node: string;
  nodeWS: string;
  proofServer: string;
  zkConfigPath: string;
  privateStateRoot: string;
}>;

export function localMidnightConfig(): LocalMidnightConfig {
  const config: LocalMidnightConfig = {
    networkId: "undeployed",
    indexer:
      process.env.MIDNIGHT_INDEXER_URL ??
      "http://127.0.0.1:8088/api/v4/graphql",
    indexerWS:
      process.env.MIDNIGHT_INDEXER_WS_URL ??
      "ws://127.0.0.1:8088/api/v4/graphql/ws",
    node: process.env.MIDNIGHT_NODE_URL ?? "http://127.0.0.1:9944",
    nodeWS: process.env.MIDNIGHT_NODE_WS_URL ?? "ws://127.0.0.1:9944",
    proofServer:
      process.env.MIDNIGHT_PROOF_SERVER_URL ?? "http://127.0.0.1:6300",
    zkConfigPath: path.resolve(
      packageRoot,
      "..",
      "..",
      "contracts",
      "aptor-credential",
      "generated",
      "aptor",
    ),
    privateStateRoot: path.resolve(
      packageRoot,
      "..",
      "..",
      ".midnight",
      "private-state",
    ),
  };

  setNetworkId(config.networkId);
  return config;
}

export function environmentConfiguration(
  config: LocalMidnightConfig,
): EnvironmentConfiguration {
  return {
    walletNetworkId: config.networkId,
    networkId: config.networkId,
    indexer: config.indexer,
    indexerWS: config.indexerWS,
    node: config.node,
    nodeWS: config.nodeWS,
    proofServer: config.proofServer,
    faucet: "",
  };
}
