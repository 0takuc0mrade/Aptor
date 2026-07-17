import assert from "node:assert/strict";
import { describe, it } from "node:test";

import * as compactRuntime from "@midnight-ntwrk/compact-runtime";

import {
  Contract,
  ledger,
  pureCircuits,
  type DurationCredential,
} from "../generated/aptor/contract/index.js";
import {
  createDurationCredential,
  deriveCredentialDigest,
  deriveHolderCommitment,
  verifyCredentialSignature,
} from "../src/issuer.ts";
import {
  createCredentialPrivateState,
  witnesses,
  type AptorCredentialPrivateState,
} from "../src/witnesses.ts";
import {
  createSignedTestFixture,
  fixedBytes,
  TEST_WRONG_ISSUER_SIGNING_KEY,
} from "./fixtures.ts";

type CredentialRun = ReturnType<
  Contract<AptorCredentialPrivateState>["provableCircuits"]["proveCredentialDuration"]
>;

function executeCredentialCheck(
  privateState: AptorCredentialPrivateState,
  minimumDurationMonths: number | bigint,
  acceptedIssuerPublicKey = createSignedTestFixture(12).acceptedIssuerPublicKey,
): CredentialRun {
  const contract = new Contract(witnesses);
  const initial = contract.initialState(
    compactRuntime.createConstructorContext(privateState, {
      bytes: new Uint8Array(32),
    }),
    acceptedIssuerPublicKey,
  );
  const context = compactRuntime.createCircuitContext(
    compactRuntime.dummyContractAddress(),
    initial.currentZswapLocalState,
    initial.currentContractState.data,
    initial.currentPrivateState,
  );

  return contract.provableCircuits.proveCredentialDuration(
    context,
    BigInt(minimumDurationMonths),
  );
}

function withCredential(
  privateState: AptorCredentialPrivateState,
  credential: DurationCredential,
): AptorCredentialPrivateState {
  return createCredentialPrivateState(
    credential,
    privateState.issuerSignature,
    privateState.holderSecret,
  );
}

function publicSurface(result: CredentialRun) {
  return {
    circuitInput: result.proofData.input,
    circuitOutput: result.proofData.output,
    publicTranscript: result.proofData.publicTranscript,
    returnedValue: result.result,
    ledger: ledger(result.context.currentQueryContext.state.state),
  };
}

function serialized(value: unknown): string {
  return JSON.stringify(value, (_key, item: unknown) =>
    typeof item === "bigint" ? `${item}n` : item,
  );
}

describe("Aptor authenticated private credential circuit", () => {
  it("accepts a credential signed for 12 months at a public minimum of 6", () => {
    const fixture = createSignedTestFixture(12);
    const result = executeCredentialCheck(fixture.privateState, 6);
    const publicLedger = ledger(result.context.currentQueryContext.state.state);

    assert.deepEqual(result.result, []);
    assert.equal(publicLedger.successfulCredentialProofs, 1n);
  });

  it("accepts the exact signed boundary of 6 months", () => {
    const fixture = createSignedTestFixture(6);
    const result = executeCredentialCheck(fixture.privateState, 6);

    assert.equal(
      ledger(result.context.currentQueryContext.state.state)
        .successfulCredentialProofs,
      1n,
    );
  });

  it("rejects a signed duration below the requested threshold", () => {
    const fixture = createSignedTestFixture(3);
    assert.throws(
      () => executeCredentialCheck(fixture.privateState, 6),
      /Signed private duration does not satisfy the public minimum/,
    );
  });

  it("rejects a duration changed after the issuer signed", () => {
    const fixture = createSignedTestFixture(12);
    const tampered = withCredential(fixture.privateState, {
      ...fixture.credential,
      durationMonths: 24n,
    });

    assert.throws(
      () => executeCredentialCheck(tampered, 6),
      /Invalid issuer signature/,
    );
  });

  it("rejects a holder commitment changed after signing", () => {
    const fixture = createSignedTestFixture(12);
    const tampered = withCredential(fixture.privateState, {
      ...fixture.credential,
      holderCommitment: fixedBytes(0x73),
    });

    assert.throws(
      () => executeCredentialCheck(tampered, 6),
      /Invalid issuer signature/,
    );
  });

  it("rejects a different holder secret", () => {
    const fixture = createSignedTestFixture(12);
    const wrongHolder = createCredentialPrivateState(
      fixture.privateState.credential,
      fixture.privateState.issuerSignature,
      fixedBytes(0x99),
    );

    assert.throws(
      () => executeCredentialCheck(wrongHolder, 6),
      /Holder secret does not match the signed credential/,
    );
  });

  it("rejects a credential signed by an unaccepted issuer", () => {
    const fixture = createSignedTestFixture(12, {
      signingKey: TEST_WRONG_ISSUER_SIGNING_KEY,
    });

    assert.throws(
      () => executeCredentialCheck(fixture.privateState, 6),
      /Invalid issuer signature/,
    );
  });

  it("rejects a credential identifier changed after signing", () => {
    const fixture = createSignedTestFixture(12);
    const tampered = withCredential(fixture.privateState, {
      ...fixture.credential,
      credentialId: fixedBytes(0xa4),
    });

    assert.throws(
      () => executeCredentialCheck(tampered, 6),
      /Invalid issuer signature/,
    );
  });

  it("matches the fixed TypeScript and generated Compact digest vector", () => {
    const holderSecret = fixedBytes(0x42);
    const credential = createDurationCredential({
      credentialId: fixedBytes(0x24),
      holderCommitment: deriveHolderCommitment(holderSecret),
      durationMonths: 12n,
    });
    const typescriptDigest = deriveCredentialDigest(credential);
    const compactDigest = pureCircuits.deriveCredentialDigest(credential);

    assert.deepEqual(typescriptDigest, compactDigest);
    assert.equal(
      Buffer.from(typescriptDigest).toString("hex"),
      "1374ba9720e64a91a12e46445ca2865ffcd571b9336707d2ea72d22a95556501",
    );
    assert.deepEqual(
      deriveHolderCommitment(holderSecret),
      pureCircuits.deriveHolderCommitment(holderSecret),
    );
  });

  it("signs and verifies the canonical credential off chain", () => {
    const fixture = createSignedTestFixture(12);
    assert.equal(
      verifyCredentialSignature(
        fixture.credential,
        fixture.privateState.issuerSignature,
        fixture.acceptedIssuerPublicKey,
      ),
      true,
    );
    assert.equal(
      verifyCredentialSignature(
        { ...fixture.credential, durationMonths: 24n },
        fixture.privateState.issuerSignature,
        fixture.acceptedIssuerPublicKey,
      ),
      false,
    );
  });

  it("rejects invalid credential bounds and widths", () => {
    const commitment = fixedBytes(0x11);
    assert.throws(
      () =>
        createDurationCredential({
          holderCommitment: commitment,
          durationMonths: 65_536n,
        }),
      /Uint<16>/,
    );
    assert.throws(
      () =>
        createDurationCredential({
          credentialId: new Uint8Array(31),
          holderCommitment: commitment,
          durationMonths: 12n,
        }),
      /credentialId must be exactly 32 bytes/,
    );
  });

  it("keeps the credential bundle out of the public circuit surface", () => {
    const fixture = createSignedTestFixture(12);
    const result = executeCredentialCheck(fixture.privateState, 6);
    const visible = serialized(publicSurface(result));

    assert.deepEqual(
      Object.keys(ledger(result.context.currentQueryContext.state.state)),
      ["acceptedIssuerPublicKey", "successfulCredentialProofs"],
    );
    assert.match(
      serialized(result.proofData.privateTranscriptOutputs),
      /"0":12/,
    );
    assert.doesNotMatch(visible, /12n/);
    assert.doesNotMatch(visible, /36,36,36,36,36/);
    assert.doesNotMatch(visible, /66,66,66,66,66/);
  });
});
