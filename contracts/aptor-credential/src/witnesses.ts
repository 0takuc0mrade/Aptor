import type { WitnessContext } from "@midnight-ntwrk/compact-runtime";

import type {
  DurationCredential,
  Ledger,
  Schnorr_SchnorrSignature,
  Witnesses,
} from "../generated/aptor/contract/index.js";

export type AptorCredentialPrivateState = Readonly<{
  credential: DurationCredential;
  issuerSignature: Schnorr_SchnorrSignature;
  holderSecret: Uint8Array;
}>;

const TWO_248 =
  452_312_848_583_266_388_373_324_160_190_187_140_051_835_877_600_158_453_279_131_187_530_910_662_656n;

function cloneCredential(credential: DurationCredential): DurationCredential {
  return {
    credentialId: new Uint8Array(credential.credentialId),
    holderCommitment: new Uint8Array(credential.holderCommitment),
    durationMonths: credential.durationMonths,
  };
}

export function createCredentialPrivateState(
  credential: DurationCredential,
  issuerSignature: Schnorr_SchnorrSignature,
  holderSecret: Uint8Array,
): AptorCredentialPrivateState {
  if (credential.credentialId.length !== 32) {
    throw new RangeError("credentialId must be exactly 32 bytes");
  }
  if (credential.holderCommitment.length !== 32) {
    throw new RangeError("holderCommitment must be exactly 32 bytes");
  }
  if (credential.durationMonths < 0n || credential.durationMonths > 65_535n) {
    throw new RangeError("durationMonths must fit within Compact Uint<16>");
  }
  if (holderSecret.length !== 32) {
    throw new RangeError("holderSecret must be exactly 32 bytes");
  }

  return {
    credential: cloneCredential(credential),
    issuerSignature: {
      announcement: {
        x: issuerSignature.announcement.x,
        y: issuerSignature.announcement.y,
      },
      response: issuerSignature.response,
    },
    holderSecret: new Uint8Array(holderSecret),
  };
}

export const witnesses: Witnesses<AptorCredentialPrivateState> = {
  getSchnorrReduction: (
    { privateState }: WitnessContext<Ledger, AptorCredentialPrivateState>,
    challengeHash: bigint,
  ): [AptorCredentialPrivateState, [bigint, bigint]] => [
    privateState,
    [challengeHash / TWO_248, challengeHash % TWO_248],
  ],
  getCredentialBundle: ({
    privateState,
  }: WitnessContext<Ledger, AptorCredentialPrivateState>): [
    AptorCredentialPrivateState,
    [DurationCredential, Schnorr_SchnorrSignature, Uint8Array],
  ] => [
    privateState,
    [
      privateState.credential,
      privateState.issuerSignature,
      privateState.holderSecret,
    ],
  ],
};
