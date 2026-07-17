import { CompiledContract } from "@midnight-ntwrk/midnight-js-protocol/compact-js";
import * as CompiledAptorContract from "../generated/aptor/contract/index.js";
import * as Witnesses from "./witnesses.js";

export * from "../generated/aptor/contract/index.js";
export * from "./issuer.js";
export * from "./merkle.js";
export * from "./request.js";
export * from "./witnesses.js";

export const compiledAptorCredentialContract = CompiledContract.make<
  CompiledAptorContract.Contract<Witnesses.AptorCredentialPrivateState>
>(
  "AptorCredential",
  CompiledAptorContract.Contract<Witnesses.AptorCredentialPrivateState>,
).pipe(
  CompiledContract.withWitnesses(Witnesses.witnesses),
  CompiledContract.withCompiledFileAssets("./generated/aptor"),
);
