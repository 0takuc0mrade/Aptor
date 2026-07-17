import type {
  AptorCredentialPrivateState,
  Contract,
  Witnesses,
} from "@aptor/credential-contract";
import type { FoundContract } from "@midnight-ntwrk/midnight-js-contracts";
import type { MidnightProviders } from "@midnight-ntwrk/midnight-js-types";

export const aptorCredentialPrivateStateKey = "aptorCredentialPrivateState";
export type AptorCredentialPrivateStateId =
  typeof aptorCredentialPrivateStateKey;

export type AptorCredentialContract = Contract<
  AptorCredentialPrivateState,
  Witnesses<AptorCredentialPrivateState>
>;

export type AptorCredentialCircuitKey = Exclude<
  keyof AptorCredentialContract["impureCircuits"],
  number | symbol
>;

export type AptorCredentialProviders = MidnightProviders<
  AptorCredentialCircuitKey,
  AptorCredentialPrivateStateId,
  AptorCredentialPrivateState
>;

export type DeployedAptorCredentialContract =
  FoundContract<AptorCredentialContract>;
