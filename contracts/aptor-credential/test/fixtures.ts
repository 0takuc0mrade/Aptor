import type { JubjubPoint } from "@midnight-ntwrk/compact-runtime";

import type {
  ProofRequestV1,
  WorkCredentialV1,
} from "../generated/aptor/contract/index.js";
import {
  buildAcceptedIssuerTree,
  buildSkillTree,
  canonicalSkillId,
  createWorkCredential,
  deriveHolderCommitment,
  deriveIssuerMembershipPath,
  deriveIssuerPublicKey,
  deriveSkillMembershipPath,
  signWorkCredential,
  type AcceptedIssuerTree,
  type SkillTree,
} from "../src/issuer.ts";
import {
  createProofRequest,
  deriveProofRequestCommitment,
} from "../src/request.ts";
import {
  createCredentialPrivateState,
  type AptorCredentialPrivateState,
} from "../src/witnesses.ts";

export const TEST_ISSUER_SIGNING_KEYS = [1_337_031n, 2_441_903n, 8_822_113n];
export const TEST_SIGNING_KEY = TEST_ISSUER_SIGNING_KEYS[1];
export const TEST_UNTRUSTED_SIGNING_KEY = 9_991_337n;

export function fixedBytes(value: number): Uint8Array {
  return new Uint8Array(32).fill(value);
}

export type CompleteFixture = Readonly<{
  credential: WorkCredentialV1;
  request: ProofRequestV1;
  requestCommitment: Uint8Array;
  privateState: AptorCredentialPrivateState;
  skillTree: SkillTree;
  acceptedIssuerTree: AcceptedIssuerTree;
  issuerPublicKey: JubjubPoint;
}>;

export function createCompleteFixture(
  options: Readonly<{
    skills?: readonly string[];
    requiredSkill?: string;
    durationMonths?: number | bigint;
    deliveredToProduction?: boolean;
    clientRatingHundredths?: number | bigint;
    signingKey?: bigint;
    acceptedSigningKeys?: readonly bigint[];
    holderSecret?: Uint8Array;
    requestOverrides?: Partial<ProofRequestV1>;
  }> = {},
): CompleteFixture {
  const skills = options.skills ?? [
    "Rust",
    "Cryptography",
    "Distributed Systems",
  ];
  const requiredSkill = options.requiredSkill ?? "Rust";
  const signingKey = options.signingKey ?? TEST_SIGNING_KEY;
  const acceptedSigningKeys =
    options.acceptedSigningKeys ?? TEST_ISSUER_SIGNING_KEYS;
  const holderSecret = options.holderSecret ?? fixedBytes(0x42);
  const issuerPublicKey = deriveIssuerPublicKey(signingKey);
  const acceptedIssuerTree = buildAcceptedIssuerTree(
    acceptedSigningKeys.map(deriveIssuerPublicKey),
  );
  const skillTree = buildSkillTree(skills);
  const credential = createWorkCredential({
    credentialId: fixedBytes(0x24),
    holderCommitment: deriveHolderCommitment(holderSecret),
    skillsRoot: skillTree.root,
    durationMonths: options.durationMonths ?? 12n,
    deliveredToProduction: options.deliveredToProduction ?? true,
    clientRatingHundredths: options.clientRatingHundredths ?? 475n,
  });
  const issuerSignature = signWorkCredential(credential, signingKey);
  const request = {
    ...createProofRequest({
      requestId: fixedBytes(0x61),
      acceptedIssuerRoot: acceptedIssuerTree.root,
      checkSkill: true,
      requiredSkillId: canonicalSkillId(requiredSkill),
      checkDuration: true,
      minimumDurationMonths: 6n,
      requireProductionDelivery: true,
      checkClientRating: true,
      minimumClientRatingHundredths: 450n,
    }),
    ...options.requestOverrides,
  };
  const privateState = createCredentialPrivateState({
    credential,
    issuerPublicKey,
    issuerSignature,
    issuerMembershipPath: deriveIssuerMembershipPath(
      acceptedIssuerTree,
      issuerPublicKey,
    ),
    holderSecret,
    privateSkills: skillTree.leaves,
    requiredSkillMembershipPath: deriveSkillMembershipPath(
      skillTree,
      requiredSkill,
    ),
  });

  return {
    credential,
    request,
    requestCommitment: deriveProofRequestCommitment(request),
    privateState,
    skillTree,
    acceptedIssuerTree,
    issuerPublicKey,
  };
}
