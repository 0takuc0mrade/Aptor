import type {
  AptorDurationPrivateState,
  Contract,
  Witnesses,
} from "@aptor/credential-contract";
import type { FoundContract } from "@midnight-ntwrk/midnight-js-contracts";
import type { MidnightProviders } from "@midnight-ntwrk/midnight-js-types";

export const aptorDurationPrivateStateKey = "aptorDurationPrivateState";
export type AptorDurationPrivateStateId = typeof aptorDurationPrivateStateKey;

export type AptorDurationContract = Contract<
  AptorDurationPrivateState,
  Witnesses<AptorDurationPrivateState>
>;

export type AptorDurationCircuitKey = Exclude<
  keyof AptorDurationContract["impureCircuits"],
  number | symbol
>;

export type AptorDurationProviders = MidnightProviders<
  AptorDurationCircuitKey,
  AptorDurationPrivateStateId,
  AptorDurationPrivateState
>;

export type DeployedAptorDurationContract =
  FoundContract<AptorDurationContract>;
