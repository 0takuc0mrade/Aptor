import {
  compiledAptorCredentialContract,
  deriveProofRequestCommitment,
  ledger,
  type AptorCredentialPrivateState,
  type Contract,
  type Ledger,
  type ProofRequestV1,
  type Witnesses,
} from "@aptor/credential-contract";
import {
  findDeployedContract,
  type FinalizedCallTxData,
  type FoundContract,
} from "@midnight-ntwrk/midnight-js-contracts";
import type { ContractAddress } from "@midnight-ntwrk/midnight-js-protocol/ledger";
import { asContractAddress } from "@midnight-ntwrk/midnight-js-types";

import { equalBytes, hexToBytes } from "./encoding.js";
import { AptorError } from "./errors.js";
import {
  APTOR_PRIVATE_STATE_KEY,
  type AptorBrowserProviders,
} from "./providers.js";

type AptorContract = Contract<
  AptorCredentialPrivateState,
  Witnesses<AptorCredentialPrivateState>
>;
type DeployedAptorContract = FoundContract<AptorContract>;

type ContractMode = "public" | "proof";

export type PublicRequestState = Readonly<{
  registered: boolean;
  fulfilled: boolean;
  commitmentMatches: boolean;
}>;

export async function withFinalizationTimeout<T>(
  promise: Promise<T>,
  milliseconds: number,
): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_resolve, reject) => {
        timeout = setTimeout(
          () =>
            reject(
              new AptorError(
                "FINALIZATION_TIMEOUT",
                "Midnight did not finalize the transaction in time. Check the transaction before retrying.",
              ),
            ),
          milliseconds,
        );
      }),
    ]);
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
  }
}

async function findContract(
  providers: AptorBrowserProviders,
  contractAddress: ContractAddress,
  mode: ContractMode,
): Promise<DeployedAptorContract> {
  const find = findDeployedContract as unknown as (
    providers: AptorBrowserProviders,
    options: Record<string, unknown>,
  ) => Promise<DeployedAptorContract>;
  return find(providers, {
    compiledContract: compiledAptorCredentialContract,
    contractAddress,
    ...(mode === "proof" ? { privateStateId: APTOR_PRIVATE_STATE_KEY } : {}),
  });
}

export class AptorBrowserContract {
  readonly contractAddress: ContractAddress;

  private constructor(
    readonly providers: AptorBrowserProviders,
    readonly deployed: DeployedAptorContract,
  ) {
    this.contractAddress = deployed.deployTxData.public.contractAddress;
  }

  static async connect(
    providers: AptorBrowserProviders,
    contractAddress: string,
    mode: ContractMode,
  ): Promise<AptorBrowserContract> {
    const deployed = await findContract(
      providers,
      asContractAddress(contractAddress),
      mode,
    );
    return new AptorBrowserContract(providers, deployed);
  }

  async publicState(): Promise<Ledger> {
    const state = await this.providers.publicDataProvider.queryContractState(
      this.contractAddress,
    );
    if (state === null) {
      throw new Error(`No Aptor contract exists at ${this.contractAddress}.`);
    }
    return ledger(state.data);
  }

  async requestState(
    requestIdHex: string,
    expectedCommitmentHex?: string,
  ): Promise<PublicRequestState> {
    const requestId = hexToBytes(requestIdHex, 32);
    const state = await this.publicState();
    const registered = state.requestCommitments.member(requestId);
    const actualCommitment = registered
      ? state.requestCommitments.lookup(requestId)
      : null;
    return {
      registered,
      fulfilled: registered && state.fulfilledRequests.member(requestId),
      commitmentMatches:
        expectedCommitmentHex === undefined || actualCommitment === null
          ? expectedCommitmentHex === undefined
          : equalBytes(actualCommitment, hexToBytes(expectedCommitmentHex, 32)),
    };
  }

  async registerRequest(
    request: ProofRequestV1,
    timeoutMilliseconds = 180_000,
  ): Promise<{
    txId: string;
    blockHeight: number;
    requestCommitment: Uint8Array;
  }> {
    const requestCommitment = deriveProofRequestCommitment(request);
    const transaction = this.deployed.callTx.createProofRequest(
      request.requestId,
      requestCommitment,
    ) as Promise<FinalizedCallTxData<AptorContract, "createProofRequest">>;
    const finalized = await withFinalizationTimeout(
      transaction,
      timeoutMilliseconds,
    );
    return {
      txId: finalized.public.txId,
      blockHeight: finalized.public.blockHeight,
      requestCommitment,
    };
  }

  async fulfillRequest(
    request: ProofRequestV1,
    timeoutMilliseconds = 600_000,
  ): Promise<{ txId: string; blockHeight: number }> {
    const transaction = this.deployed.callTx.proveAgainstRequest(
      request,
    ) as Promise<FinalizedCallTxData<AptorContract, "proveAgainstRequest">>;
    const finalized = await withFinalizationTimeout(
      transaction,
      timeoutMilliseconds,
    );
    return {
      txId: finalized.public.txId,
      blockHeight: finalized.public.blockHeight,
    };
  }
}
