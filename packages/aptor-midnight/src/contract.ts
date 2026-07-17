import {
  compiledAptorCredentialContract,
  deriveProofRequestCommitment,
  ledger,
  type AptorCredentialPrivateState,
  type Ledger,
  type ProofRequestV1,
} from "@aptor/credential-contract";
import {
  deployContract,
  type FinalizedCallTxData,
} from "@midnight-ntwrk/midnight-js-contracts";
import type { ContractAddress } from "@midnight-ntwrk/midnight-js-protocol/ledger";

import type {
  AptorCredentialContract,
  AptorCredentialProviders,
  DeployedAptorCredentialContract,
} from "./types.js";
import { aptorCredentialPrivateStateKey } from "./types.js";

export type PublicRequestRegistrationResult = Readonly<{
  txId: string;
  blockHeight: number;
  requestId: Uint8Array;
  requestCommitment: Uint8Array;
  returnValue: readonly [];
}>;

export type PublicProofReceiptResult = Readonly<{
  txId: string;
  blockHeight: number;
  requestId: Uint8Array;
  fulfilled: true;
  returnValue: readonly [];
}>;

export class AptorCredentialApi {
  readonly contractAddress: ContractAddress;
  readonly deploymentTransaction: Readonly<{
    txId: string;
    blockHeight: number;
  }>;

  private constructor(
    private readonly deployedContract: DeployedAptorCredentialContract,
    private readonly providers: AptorCredentialProviders,
  ) {
    this.contractAddress =
      this.deployedContract.deployTxData.public.contractAddress;
    this.deploymentTransaction = {
      txId: this.deployedContract.deployTxData.public.txId,
      blockHeight: this.deployedContract.deployTxData.public.blockHeight,
    };
    this.providers.privateStateProvider.setContractAddress(
      this.contractAddress,
    );
  }

  static async deploy(
    providers: AptorCredentialProviders,
    initialPrivateState: AptorCredentialPrivateState,
  ): Promise<AptorCredentialApi> {
    const deployedContract = await deployContract(providers, {
      compiledContract: compiledAptorCredentialContract,
      privateStateId: aptorCredentialPrivateStateKey,
      initialPrivateState,
    });
    return new AptorCredentialApi(deployedContract, providers);
  }

  async publicState(): Promise<Ledger> {
    const state = await this.providers.publicDataProvider.queryContractState(
      this.contractAddress,
    );
    if (state === null) {
      throw new Error(
        `No public contract state found for ${this.contractAddress}`,
      );
    }
    return ledger(state.data);
  }

  async createProofRequest(
    request: ProofRequestV1,
  ): Promise<PublicRequestRegistrationResult> {
    const requestCommitment = deriveProofRequestCommitment(request);
    const txData: FinalizedCallTxData<
      AptorCredentialContract,
      "createProofRequest"
    > = await this.deployedContract.callTx.createProofRequest(
      request.requestId,
      requestCommitment,
    );

    return {
      txId: txData.public.txId,
      blockHeight: txData.public.blockHeight,
      requestId: new Uint8Array(request.requestId),
      requestCommitment,
      returnValue: txData.private.result,
    };
  }

  async proveAgainstRequest(
    request: ProofRequestV1,
  ): Promise<PublicProofReceiptResult> {
    const txData: FinalizedCallTxData<
      AptorCredentialContract,
      "proveAgainstRequest"
    > = await this.deployedContract.callTx.proveAgainstRequest(request);

    return {
      txId: txData.public.txId,
      blockHeight: txData.public.blockHeight,
      requestId: new Uint8Array(request.requestId),
      fulfilled: true,
      returnValue: txData.private.result,
    };
  }
}
