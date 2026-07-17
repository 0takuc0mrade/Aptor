import assert from "node:assert/strict";
import { describe, it } from "node:test";

import * as compactRuntime from "@midnight-ntwrk/compact-runtime";

import { Contract, ledger } from "../generated/aptor/contract/index.js";
import { createDurationPrivateState, witnesses } from "../src/witnesses.ts";

type DurationRun = ReturnType<
  Contract<
    ReturnType<typeof createDurationPrivateState>
  >["provableCircuits"]["proveDuration"]
>;

function executeDurationCheck(
  durationMonths: number,
  minimumDurationMonths: number,
): DurationRun {
  const privateState = createDurationPrivateState(durationMonths);
  const contract = new Contract(witnesses);
  const initial = contract.initialState(
    compactRuntime.createConstructorContext(privateState, {
      bytes: new Uint8Array(32),
    }),
  );
  const context = compactRuntime.createCircuitContext(
    compactRuntime.dummyContractAddress(),
    initial.currentZswapLocalState,
    initial.currentContractState.data,
    initial.currentPrivateState,
  );

  return contract.provableCircuits.proveDuration(
    context,
    BigInt(minimumDurationMonths),
  );
}

function stableJson(value: unknown): string {
  return JSON.stringify(value, (_key, item: unknown) =>
    typeof item === "bigint" ? `${item}n` : item,
  );
}

function publicSurface(result: DurationRun) {
  return {
    circuitInput: result.proofData.input,
    circuitOutput: result.proofData.output,
    publicTranscript: result.proofData.publicTranscript,
    returnedValue: result.result,
    ledgerKeys: Object.keys(
      ledger(result.context.currentQueryContext.state.state),
    ),
  };
}

describe("Aptor duration threshold circuit", () => {
  it("accepts 12 private months for a public minimum of 6", () => {
    const result = executeDurationCheck(12, 6);
    const publicLedger = ledger(result.context.currentQueryContext.state.state);

    assert.deepEqual(result.result, []);
    assert.equal(publicLedger.successfulProofs, 1n);
  });

  it("accepts the exact boundary of 6 private months for a minimum of 6", () => {
    const result = executeDurationCheck(6, 6);
    const publicLedger = ledger(result.context.currentQueryContext.state.state);

    assert.deepEqual(result.result, []);
    assert.equal(publicLedger.successfulProofs, 1n);
  });

  it("rejects 3 private months for a public minimum of 6", () => {
    assert.throws(
      () => executeDurationCheck(3, 6),
      /Private duration does not satisfy the public minimum/,
    );
  });

  it("does not expose the exact private duration on the public surface", () => {
    const result = executeDurationCheck(12, 6);
    const serializedPublicSurface = stableJson(publicSurface(result));

    assert.deepEqual(
      Object.keys(ledger(result.context.currentQueryContext.state.state)),
      ["successfulProofs"],
    );
    assert.match(
      stableJson(result.proofData.privateTranscriptOutputs),
      /"0":12/,
    );
    assert.doesNotMatch(serializedPublicSurface, /12n|"0":12/);
    assert.match(serializedPublicSurface, /"0":6/);
  });
});
