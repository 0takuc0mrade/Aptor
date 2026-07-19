import { ledger } from "@aptor/credential-contract";
import { indexerPublicDataProvider } from "@midnight-ntwrk/midnight-js-indexer-public-data-provider";
import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";

import { equalBytes, hexToBytes } from "./encoding.js";
import type { AptorNetwork } from "./schemas.js";

export type PublicRequestQuery = Readonly<{
  registered: boolean;
  fulfilled: boolean;
  commitmentMatches: boolean;
}>;

export async function queryContractPresence(
  config: Readonly<{
    network: AptorNetwork;
    indexerUrl: string;
    indexerWsUrl: string;
    contractAddress: string;
  }>,
): Promise<boolean> {
  setNetworkId(config.network);
  const provider = indexerPublicDataProvider(
    config.indexerUrl,
    config.indexerWsUrl,
  );
  return (await provider.queryContractState(config.contractAddress)) !== null;
}

export async function queryPublicRequest(
  config: Readonly<{
    network: AptorNetwork;
    indexerUrl: string;
    indexerWsUrl: string;
    contractAddress: string;
  }>,
  requestIdHex: string,
  expectedCommitmentHex?: string,
): Promise<PublicRequestQuery> {
  setNetworkId(config.network);
  const provider = indexerPublicDataProvider(
    config.indexerUrl,
    config.indexerWsUrl,
  );
  const contractState = await provider.queryContractState(
    config.contractAddress,
  );
  if (contractState === null) {
    return {
      registered: false,
      fulfilled: false,
      commitmentMatches: false,
    };
  }
  const state = ledger(contractState.data);
  const requestId = hexToBytes(requestIdHex, 32);
  const registered = state.requestCommitments.member(requestId);
  const commitmentMatches =
    registered &&
    (expectedCommitmentHex === undefined ||
      equalBytes(
        state.requestCommitments.lookup(requestId),
        hexToBytes(expectedCommitmentHex, 32),
      ));
  return {
    registered,
    fulfilled: registered && state.fulfilledRequests.member(requestId),
    commitmentMatches,
  };
}
