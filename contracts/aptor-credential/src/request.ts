import {
  CompactTypeBoolean,
  CompactTypeBytes,
  CompactTypeMerkleTreeDigest,
  CompactTypeUnsignedInteger,
  persistentHash,
  type CompactType,
  type MerkleTreeDigest,
} from "@midnight-ntwrk/compact-runtime";

import type { ProofRequestV1 } from "../generated/aptor/contract/index.js";

export type ProofRequestInput = Readonly<{
  requestId?: Uint8Array;
  acceptedIssuerRoot: MerkleTreeDigest;
  checkSkill: boolean;
  requiredSkillId?: Uint8Array;
  checkDuration: boolean;
  minimumDurationMonths: number | bigint;
  requireProductionDelivery: boolean;
  checkClientRating: boolean;
  minimumClientRatingHundredths: number | bigint;
}>;

const MAX_UINT16 = 65_535n;
const MAX_CLIENT_RATING = 500n;
const bytes22 = new CompactTypeBytes(22);
const bytes32 = new CompactTypeBytes(32);
const uint16 = new CompactTypeUnsignedInteger(MAX_UINT16, 2);
const encoder = new TextEncoder();
const REQUEST_DOMAIN = encoder.encode("aptor:proof-request:v1");
const EMPTY_SKILL_ID = new Uint8Array(32);

function randomBytes32(): Uint8Array {
  return globalThis.crypto.getRandomValues(new Uint8Array(32));
}

type ProofRequestCommitmentPreimage = [
  Uint8Array,
  Uint8Array,
  MerkleTreeDigest,
  boolean,
  Uint8Array,
  boolean,
  bigint,
  boolean,
  boolean,
  bigint,
];

const proofRequestCommitmentType: CompactType<ProofRequestCommitmentPreimage> =
  {
    alignment: () =>
      bytes22
        .alignment()
        .concat(
          bytes32.alignment(),
          CompactTypeMerkleTreeDigest.alignment(),
          CompactTypeBoolean.alignment(),
          bytes32.alignment(),
          CompactTypeBoolean.alignment(),
          uint16.alignment(),
          CompactTypeBoolean.alignment(),
          CompactTypeBoolean.alignment(),
          uint16.alignment(),
        ),
    fromValue: (value) => [
      bytes22.fromValue(value),
      bytes32.fromValue(value),
      CompactTypeMerkleTreeDigest.fromValue(value),
      CompactTypeBoolean.fromValue(value),
      bytes32.fromValue(value),
      CompactTypeBoolean.fromValue(value),
      uint16.fromValue(value),
      CompactTypeBoolean.fromValue(value),
      CompactTypeBoolean.fromValue(value),
      uint16.fromValue(value),
    ],
    toValue: ([
      domain,
      requestId,
      acceptedIssuerRoot,
      checkSkill,
      requiredSkillId,
      checkDuration,
      minimumDurationMonths,
      requireProductionDelivery,
      checkClientRating,
      minimumClientRatingHundredths,
    ]) =>
      bytes22
        .toValue(domain)
        .concat(
          bytes32.toValue(requestId),
          CompactTypeMerkleTreeDigest.toValue(acceptedIssuerRoot),
          CompactTypeBoolean.toValue(checkSkill),
          bytes32.toValue(requiredSkillId),
          CompactTypeBoolean.toValue(checkDuration),
          uint16.toValue(minimumDurationMonths),
          CompactTypeBoolean.toValue(requireProductionDelivery),
          CompactTypeBoolean.toValue(checkClientRating),
          uint16.toValue(minimumClientRatingHundredths),
        ),
  };

function assertBytes32(value: Uint8Array, field: string): void {
  if (!(value instanceof Uint8Array) || value.length !== 32) {
    throw new RangeError(`${field} must be exactly 32 bytes`);
  }
}

function normalizeUint16(value: number | bigint, field: string): bigint {
  const normalized = BigInt(value);
  if (normalized < 0n || normalized > MAX_UINT16) {
    throw new RangeError(`${field} must fit within Compact Uint<16>`);
  }
  return normalized;
}

function validateActiveRequirements(request: ProofRequestV1): void {
  if (
    !request.checkSkill &&
    !request.checkDuration &&
    !request.requireProductionDelivery &&
    !request.checkClientRating
  ) {
    throw new RangeError("proof request must enable at least one requirement");
  }
  if (
    request.checkClientRating &&
    request.minimumClientRatingHundredths > MAX_CLIENT_RATING
  ) {
    throw new RangeError(
      "minimumClientRatingHundredths must be between 0 and 500 when enabled",
    );
  }
}

export function createProofRequest(input: ProofRequestInput): ProofRequestV1 {
  const requestId = input.requestId ?? randomBytes32();
  const requiredSkillId = input.requiredSkillId ?? EMPTY_SKILL_ID;
  assertBytes32(requestId, "requestId");
  assertBytes32(requiredSkillId, "requiredSkillId");
  if (input.checkSkill && input.requiredSkillId === undefined) {
    throw new RangeError("requiredSkillId is required when checkSkill is true");
  }

  const request: ProofRequestV1 = {
    requestId: new Uint8Array(requestId),
    acceptedIssuerRoot: { field: input.acceptedIssuerRoot.field },
    checkSkill: input.checkSkill,
    requiredSkillId: new Uint8Array(requiredSkillId),
    checkDuration: input.checkDuration,
    minimumDurationMonths: normalizeUint16(
      input.minimumDurationMonths,
      "minimumDurationMonths",
    ),
    requireProductionDelivery: input.requireProductionDelivery,
    checkClientRating: input.checkClientRating,
    minimumClientRatingHundredths: normalizeUint16(
      input.minimumClientRatingHundredths,
      "minimumClientRatingHundredths",
    ),
  };
  validateActiveRequirements(request);
  return request;
}

export function deriveProofRequestCommitment(
  request: ProofRequestV1,
): Uint8Array {
  assertBytes32(request.requestId, "requestId");
  assertBytes32(request.requiredSkillId, "requiredSkillId");
  const minimumDurationMonths = normalizeUint16(
    request.minimumDurationMonths,
    "minimumDurationMonths",
  );
  const minimumClientRatingHundredths = normalizeUint16(
    request.minimumClientRatingHundredths,
    "minimumClientRatingHundredths",
  );
  validateActiveRequirements(request);

  return persistentHash(proofRequestCommitmentType, [
    REQUEST_DOMAIN,
    request.requestId,
    request.acceptedIssuerRoot,
    request.checkSkill,
    request.requiredSkillId,
    request.checkDuration,
    minimumDurationMonths,
    request.requireProductionDelivery,
    request.checkClientRating,
    minimumClientRatingHundredths,
  ]);
}
