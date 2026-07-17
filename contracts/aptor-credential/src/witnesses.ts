import type { Ledger, Witnesses } from "../generated/aptor/contract/index.js";
import type { WitnessContext } from "@midnight-ntwrk/compact-runtime";

export type AptorDurationPrivateState = Readonly<{
  durationMonths: bigint;
}>;

export function createDurationPrivateState(
  durationMonths: number | bigint,
): AptorDurationPrivateState {
  const normalizedDuration = BigInt(durationMonths);

  if (normalizedDuration < 0n || normalizedDuration > 65_535n) {
    throw new RangeError("durationMonths must fit within Compact Uint<16>");
  }

  return { durationMonths: normalizedDuration };
}

export const witnesses: Witnesses<AptorDurationPrivateState> = {
  durationMonths: ({
    privateState,
  }: WitnessContext<Ledger, AptorDurationPrivateState>): [
    AptorDurationPrivateState,
    bigint,
  ] => [privateState, privateState.durationMonths],
};
