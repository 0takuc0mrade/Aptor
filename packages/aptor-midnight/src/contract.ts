import {
  compiledAptorDurationContract,
  createDurationPrivateState,
  ledger,
  type AptorDurationPrivateState,
  type Ledger,
} from "@aptor/credential-contract";
import {
  deployContract,
  type FinalizedCallTxData,
} from "@midnight-ntwrk/midnight-js-contracts";
import type { ContractAddress } from "@midnight-ntwrk/midnight-js-protocol/ledger";
import type {
  AptorDurationContract,
  AptorDurationProviders,
  DeployedAptorDurationContract,
} from "./types.js";
import { aptorDurationPrivateStateKey } from "./types.js";

export type PublicTransactionResult = Readonly<{
  txId: string;
  blockHeight: number;
  returnValue: readonly [];
}>;

export class AptorDurationApi {
  readonly contractAddress: ContractAddress;
  readonly deploymentTransaction: Readonly<{
    txId: string;
    blockHeight: number;
  }>;

  private constructor(
    private readonly deployedContract: DeployedAptorDurationContract,
    private readonly providers: AptorDurationProviders,
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
    providers: AptorDurationProviders,
    initialPrivateState: AptorDurationPrivateState,
  ): Promise<AptorDurationApi> {
    const deployedContract = await deployContract(providers, {
      compiledContract: compiledAptorDurationContract,
      privateStateId: aptorDurationPrivateStateKey,
      initialPrivateState,
    });
    return new AptorDurationApi(deployedContract, providers);
  }

  static async deployWithDuration(
    providers: AptorDurationProviders,
    fixtureDurationMonths: number | bigint,
  ): Promise<AptorDurationApi> {
    return AptorDurationApi.deploy(
      providers,
      createDurationPrivateState(fixtureDurationMonths),
    );
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

  async proveDuration(
    minimumDurationMonths: number | bigint,
  ): Promise<PublicTransactionResult> {
    const txData: FinalizedCallTxData<AptorDurationContract, "proveDuration"> =
      await this.deployedContract.callTx.proveDuration(
        BigInt(minimumDurationMonths),
      );

    return {
      txId: txData.public.txId,
      blockHeight: txData.public.blockHeight,
      returnValue: txData.private.result,
    };
  }
}
