import {
  compiledAptorCredentialContract,
  ledger,
  type AptorCredentialPrivateState,
  type Ledger,
} from "@aptor/credential-contract";
import {
  deployContract,
  type FinalizedCallTxData,
} from "@midnight-ntwrk/midnight-js-contracts";
import type { JubjubPoint } from "@midnight-ntwrk/midnight-js-protocol/compact-runtime";
import type { ContractAddress } from "@midnight-ntwrk/midnight-js-protocol/ledger";

import type {
  AptorCredentialContract,
  AptorCredentialProviders,
  DeployedAptorCredentialContract,
} from "./types.js";
import { aptorCredentialPrivateStateKey } from "./types.js";

export type PublicCredentialTransactionResult = Readonly<{
  txId: string;
  blockHeight: number;
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
    acceptedIssuerPublicKey: JubjubPoint,
  ): Promise<AptorCredentialApi> {
    const deployedContract = await deployContract(providers, {
      compiledContract: compiledAptorCredentialContract,
      privateStateId: aptorCredentialPrivateStateKey,
      initialPrivateState,
      args: [acceptedIssuerPublicKey],
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

  async proveCredentialDuration(
    minimumDurationMonths: number | bigint,
  ): Promise<PublicCredentialTransactionResult> {
    const txData: FinalizedCallTxData<
      AptorCredentialContract,
      "proveCredentialDuration"
    > = await this.deployedContract.callTx.proveCredentialDuration(
      BigInt(minimumDurationMonths),
    );

    return {
      txId: txData.public.txId,
      blockHeight: txData.public.blockHeight,
      returnValue: txData.private.result,
    };
  }
}
