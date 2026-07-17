import { CompiledContract } from "@midnight-ntwrk/midnight-js-protocol/compact-js";
import * as CompiledAptorContract from "../generated/aptor/contract/index.js";
import * as Witnesses from "./witnesses.js";

export * from "../generated/aptor/contract/index.js";
export * from "./witnesses.js";

export const compiledAptorDurationContract = CompiledContract.make<
  CompiledAptorContract.Contract<Witnesses.AptorDurationPrivateState>
>(
  "AptorDuration",
  CompiledAptorContract.Contract<Witnesses.AptorDurationPrivateState>,
).pipe(
  CompiledContract.withWitnesses(Witnesses.witnesses),
  CompiledContract.withCompiledFileAssets("./generated/aptor"),
);
