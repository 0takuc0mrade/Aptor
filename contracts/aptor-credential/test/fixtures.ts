import {
  createDurationCredential,
  deriveHolderCommitment,
  deriveIssuerPublicKey,
  signCredential,
} from "../src/issuer.ts";
import {
  createCredentialPrivateState,
  type AptorCredentialPrivateState,
} from "../src/witnesses.ts";
import type { DurationCredential } from "../generated/aptor/contract/index.js";

export const TEST_ACCEPTED_ISSUER_SIGNING_KEY = 1_337_031n;
export const TEST_WRONG_ISSUER_SIGNING_KEY = 9_991_337n;

export function fixedBytes(value: number): Uint8Array {
  return new Uint8Array(32).fill(value);
}

export function createSignedTestFixture(
  durationMonths: number | bigint,
  options: Readonly<{
    signingKey?: bigint;
    holderSecret?: Uint8Array;
    credentialId?: Uint8Array;
  }> = {},
): Readonly<{
  credential: DurationCredential;
  privateState: AptorCredentialPrivateState;
  acceptedIssuerPublicKey: ReturnType<typeof deriveIssuerPublicKey>;
}> {
  const holderSecret = options.holderSecret ?? fixedBytes(0x42);
  const credential = createDurationCredential({
    credentialId: options.credentialId ?? fixedBytes(0x24),
    holderCommitment: deriveHolderCommitment(holderSecret),
    durationMonths,
  });
  const signingKey = options.signingKey ?? TEST_ACCEPTED_ISSUER_SIGNING_KEY;
  const issuerSignature = signCredential(credential, signingKey);

  return {
    credential,
    privateState: createCredentialPrivateState(
      credential,
      issuerSignature,
      holderSecret,
    ),
    acceptedIssuerPublicKey: deriveIssuerPublicKey(
      TEST_ACCEPTED_ISSUER_SIGNING_KEY,
    ),
  };
}
