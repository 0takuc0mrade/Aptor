import type {
  JubjubPoint,
  MerkleTreePath,
  WitnessContext,
} from "@midnight-ntwrk/compact-runtime";

import type {
  Ledger,
  Schnorr_SchnorrSignature,
  Witnesses,
  WorkCredentialV1,
} from "../generated/aptor/contract/index.js";
import { MERKLE_TREE_DEPTH } from "./merkle.ts";

export type AptorCredentialPrivateState = Readonly<{
  credential: WorkCredentialV1;
  issuerPublicKey: JubjubPoint;
  issuerSignature: Schnorr_SchnorrSignature;
  issuerMembershipPath: MerkleTreePath<JubjubPoint>;
  holderSecret: Uint8Array;
  privateSkills: readonly Uint8Array[];
  requiredSkillMembershipPath: MerkleTreePath<Uint8Array>;
}>;

const TWO_248 =
  452_312_848_583_266_388_373_324_160_190_187_140_051_835_877_600_158_453_279_131_187_530_910_662_656n;

function assertBytes32(value: Uint8Array, field: string): void {
  if (!(value instanceof Uint8Array) || value.length !== 32) {
    throw new RangeError(`${field} must be exactly 32 bytes`);
  }
}

function cloneCredential(credential: WorkCredentialV1): WorkCredentialV1 {
  return {
    credentialId: new Uint8Array(credential.credentialId),
    holderCommitment: new Uint8Array(credential.holderCommitment),
    skillsRoot: { field: credential.skillsRoot.field },
    durationMonths: credential.durationMonths,
    deliveredToProduction: credential.deliveredToProduction,
    clientRatingHundredths: credential.clientRatingHundredths,
  };
}

function clonePoint(point: JubjubPoint): JubjubPoint {
  return { x: point.x, y: point.y };
}

function clonePointPath(
  path: MerkleTreePath<JubjubPoint>,
): MerkleTreePath<JubjubPoint> {
  if (path.path.length !== MERKLE_TREE_DEPTH) {
    throw new RangeError(
      `issuerMembershipPath must contain ${MERKLE_TREE_DEPTH} entries`,
    );
  }
  return {
    leaf: clonePoint(path.leaf),
    path: path.path.map((entry) => ({
      sibling: { field: entry.sibling.field },
      goes_left: entry.goes_left,
    })),
  };
}

function cloneBytesPath(
  path: MerkleTreePath<Uint8Array>,
): MerkleTreePath<Uint8Array> {
  assertBytes32(path.leaf, "requiredSkillMembershipPath.leaf");
  if (path.path.length !== MERKLE_TREE_DEPTH) {
    throw new RangeError(
      `requiredSkillMembershipPath must contain ${MERKLE_TREE_DEPTH} entries`,
    );
  }
  return {
    leaf: new Uint8Array(path.leaf),
    path: path.path.map((entry) => ({
      sibling: { field: entry.sibling.field },
      goes_left: entry.goes_left,
    })),
  };
}

export function createCredentialPrivateState(
  state: AptorCredentialPrivateState,
): AptorCredentialPrivateState {
  assertBytes32(state.credential.credentialId, "credentialId");
  assertBytes32(state.credential.holderCommitment, "holderCommitment");
  if (
    state.credential.durationMonths < 0n ||
    state.credential.durationMonths > 65_535n
  ) {
    throw new RangeError("durationMonths must fit within Compact Uint<16>");
  }
  if (
    state.credential.clientRatingHundredths < 0n ||
    state.credential.clientRatingHundredths > 500n
  ) {
    throw new RangeError("clientRatingHundredths must be between 0 and 500");
  }
  assertBytes32(state.holderSecret, "holderSecret");
  for (const skill of state.privateSkills) {
    assertBytes32(skill, "privateSkills entry");
  }

  return {
    credential: cloneCredential(state.credential),
    issuerPublicKey: clonePoint(state.issuerPublicKey),
    issuerSignature: {
      announcement: clonePoint(state.issuerSignature.announcement),
      response: state.issuerSignature.response,
    },
    issuerMembershipPath: clonePointPath(state.issuerMembershipPath),
    holderSecret: new Uint8Array(state.holderSecret),
    privateSkills: state.privateSkills.map((skill) => new Uint8Array(skill)),
    requiredSkillMembershipPath: cloneBytesPath(
      state.requiredSkillMembershipPath,
    ),
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
    [
      WorkCredentialV1,
      JubjubPoint,
      Schnorr_SchnorrSignature,
      MerkleTreePath<JubjubPoint>,
      Uint8Array,
      MerkleTreePath<Uint8Array>,
    ],
  ] => [
    privateState,
    [
      privateState.credential,
      privateState.issuerPublicKey,
      privateState.issuerSignature,
      privateState.issuerMembershipPath,
      privateState.holderSecret,
      privateState.requiredSkillMembershipPath,
    ],
  ],
};
