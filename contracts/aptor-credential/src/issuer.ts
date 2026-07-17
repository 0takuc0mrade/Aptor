import { randomBytes } from "node:crypto";

import {
  CompactTypeBoolean,
  CompactTypeBytes,
  CompactTypeMerkleTreeDigest,
  CompactTypeUnsignedInteger,
  ecAdd,
  ecMul,
  ecMulGenerator,
  persistentHash,
  transientHash,
  type CompactType,
  type JubjubPoint,
  type MerkleTreeDigest,
  type MerkleTreePath,
} from "@midnight-ntwrk/compact-runtime";

import {
  pureCircuits,
  type Schnorr_SchnorrSignature,
  type WorkCredentialV1,
} from "../generated/aptor/contract/index.js";
import {
  buildBytes32MerkleTree,
  buildJubjubPointMerkleTree,
  type FixedMerkleTree,
} from "./merkle.ts";

export type IssuerKeyPair = Readonly<{
  signingKey: bigint;
  publicKey: JubjubPoint;
}>;

export type WorkCredentialInput = Readonly<{
  credentialId?: Uint8Array;
  holderCommitment: Uint8Array;
  skillsRoot: MerkleTreeDigest;
  durationMonths: number | bigint;
  deliveredToProduction: boolean;
  clientRatingHundredths: number | bigint;
}>;

export type NormalizedSkill = Readonly<{
  display: string;
  normalized: string;
  paddedBytes: Uint8Array;
  byteLength: bigint;
  id: Uint8Array;
}>;

export type SkillTree = FixedMerkleTree<Uint8Array> &
  Readonly<{
    skills: readonly NormalizedSkill[];
  }>;

export type AcceptedIssuerTree = FixedMerkleTree<JubjubPoint>;

const JUBJUB_ORDER =
  6_554_484_396_890_773_809_930_967_563_523_245_729_705_921_265_872_317_281_365_359_162_392_183_254_199n;
const TWO_248 =
  452_312_848_583_266_388_373_324_160_190_187_140_051_835_877_600_158_453_279_131_187_530_910_662_656n;
const MAX_UINT16 = 65_535n;
const MAX_CLIENT_RATING = 500n;
const MAX_SKILL_BYTES = 64;
const bytes15 = new CompactTypeBytes(15);
const bytes17 = new CompactTypeBytes(17);
const bytes24 = new CompactTypeBytes(24);
const bytes32 = new CompactTypeBytes(32);
const bytes64 = new CompactTypeBytes(MAX_SKILL_BYTES);
const uint8 = new CompactTypeUnsignedInteger(255n, 1);
const uint16 = new CompactTypeUnsignedInteger(MAX_UINT16, 2);
const encoder = new TextEncoder();
const HOLDER_DOMAIN = encoder.encode("aptor:holder:v1");
const SKILL_DOMAIN = encoder.encode("aptor:skill:id:v1");
const CREDENTIAL_DOMAIN = encoder.encode("aptor:work-credential:v1");

type HolderCommitmentPreimage = [Uint8Array, Uint8Array];
type SkillIdentifierPreimage = [Uint8Array, Uint8Array, bigint];
type WorkCredentialDigestPreimage = [
  Uint8Array,
  Uint8Array,
  Uint8Array,
  MerkleTreeDigest,
  bigint,
  boolean,
  bigint,
];

const holderCommitmentType: CompactType<HolderCommitmentPreimage> = {
  alignment: () => bytes15.alignment().concat(bytes32.alignment()),
  fromValue: (value) => [bytes15.fromValue(value), bytes32.fromValue(value)],
  toValue: ([domain, holderSecret]) =>
    bytes15.toValue(domain).concat(bytes32.toValue(holderSecret)),
};

const skillIdentifierType: CompactType<SkillIdentifierPreimage> = {
  alignment: () =>
    bytes17.alignment().concat(bytes64.alignment(), uint8.alignment()),
  fromValue: (value) => [
    bytes17.fromValue(value),
    bytes64.fromValue(value),
    uint8.fromValue(value),
  ],
  toValue: ([domain, paddedBytes, byteLength]) =>
    bytes17
      .toValue(domain)
      .concat(bytes64.toValue(paddedBytes), uint8.toValue(byteLength)),
};

const workCredentialDigestType: CompactType<WorkCredentialDigestPreimage> = {
  alignment: () =>
    bytes24
      .alignment()
      .concat(
        bytes32.alignment(),
        bytes32.alignment(),
        CompactTypeMerkleTreeDigest.alignment(),
        uint16.alignment(),
        CompactTypeBoolean.alignment(),
        uint16.alignment(),
      ),
  fromValue: (value) => [
    bytes24.fromValue(value),
    bytes32.fromValue(value),
    bytes32.fromValue(value),
    CompactTypeMerkleTreeDigest.fromValue(value),
    uint16.fromValue(value),
    CompactTypeBoolean.fromValue(value),
    uint16.fromValue(value),
  ],
  toValue: ([
    domain,
    credentialId,
    holderCommitment,
    skillsRoot,
    durationMonths,
    deliveredToProduction,
    clientRatingHundredths,
  ]) =>
    bytes24
      .toValue(domain)
      .concat(
        bytes32.toValue(credentialId),
        bytes32.toValue(holderCommitment),
        CompactTypeMerkleTreeDigest.toValue(skillsRoot),
        uint16.toValue(durationMonths),
        CompactTypeBoolean.toValue(deliveredToProduction),
        uint16.toValue(clientRatingHundredths),
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

function normalizeRating(value: number | bigint): bigint {
  const normalized = normalizeUint16(value, "clientRatingHundredths");
  if (normalized > MAX_CLIENT_RATING) {
    throw new RangeError("clientRatingHundredths must be between 0 and 500");
  }
  return normalized;
}

function normalizeScalar(value: bigint, field: string): bigint {
  const normalized = ((value % JUBJUB_ORDER) + JUBJUB_ORDER) % JUBJUB_ORDER;
  if (normalized === 0n) {
    throw new RangeError(`${field} must be a non-zero Jubjub scalar`);
  }
  return normalized;
}

function randomScalar(): bigint {
  let scalar = 0n;
  while (scalar === 0n) {
    scalar = BigInt(`0x${randomBytes(32).toString("hex")}`) % JUBJUB_ORDER;
  }
  return scalar;
}

function signingMessage(digest: Uint8Array): bigint[] {
  assertBytes32(digest, "credential digest");
  return [transientHash(bytes32, digest), 0n, 0n, 0n];
}

function challenge(
  announcement: JubjubPoint,
  publicKey: JubjubPoint,
  message: bigint[],
): bigint {
  return (
    pureCircuits.schnorrChallenge(
      announcement.x,
      announcement.y,
      publicKey.x,
      publicKey.y,
      message,
    ) % TWO_248
  );
}

export function createIssuerKeyPair(): IssuerKeyPair {
  const signingKey = randomScalar();
  return { signingKey, publicKey: ecMulGenerator(signingKey) };
}

export function deriveIssuerPublicKey(signingKey: bigint): JubjubPoint {
  return ecMulGenerator(normalizeScalar(signingKey, "issuer signing key"));
}

export function createHolderSecret(): Uint8Array {
  return new Uint8Array(randomBytes(32));
}

export function deriveHolderCommitment(holderSecret: Uint8Array): Uint8Array {
  assertBytes32(holderSecret, "holderSecret");
  return persistentHash(holderCommitmentType, [HOLDER_DOMAIN, holderSecret]);
}

export function normalizeSkillDisplay(displaySkill: string): string {
  if (typeof displaySkill !== "string") {
    throw new TypeError("displaySkill must be a string");
  }
  const normalized = displaySkill
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/\s+/gu, " ");
  if (normalized.length === 0) {
    throw new RangeError("displaySkill must not be empty");
  }
  return normalized;
}

export function encodeNormalizedSkill(displaySkill: string): NormalizedSkill {
  const normalized = normalizeSkillDisplay(displaySkill);
  const encoded = encoder.encode(normalized);
  if (encoded.length > MAX_SKILL_BYTES) {
    throw new RangeError(
      `normalized skill must be at most ${MAX_SKILL_BYTES} UTF-8 bytes`,
    );
  }
  const paddedBytes = new Uint8Array(MAX_SKILL_BYTES);
  paddedBytes.set(encoded);
  const byteLength = BigInt(encoded.length);
  const id = persistentHash(skillIdentifierType, [
    SKILL_DOMAIN,
    paddedBytes,
    byteLength,
  ]);
  return { display: displaySkill, normalized, paddedBytes, byteLength, id };
}

export function canonicalSkillId(displaySkill: string): Uint8Array {
  return encodeNormalizedSkill(displaySkill).id;
}

export function buildSkillTree(displaySkills: readonly string[]): SkillTree {
  const byId = new Map<string, NormalizedSkill>();
  for (const displaySkill of displaySkills) {
    const skill = encodeNormalizedSkill(displaySkill);
    const key = Buffer.from(skill.id).toString("hex");
    if (!byId.has(key)) byId.set(key, skill);
  }
  const skills = [...byId.values()];
  const tree = buildBytes32MerkleTree(skills.map((skill) => skill.id));
  const byTreeOrder = tree.leaves.map((leaf) => {
    const skill = byId.get(Buffer.from(leaf).toString("hex"));
    if (skill === undefined) throw new Error("Skill tree ordering failed");
    return skill;
  });
  return { ...tree, skills: byTreeOrder };
}

export function deriveSkillMembershipPath(
  tree: SkillTree,
  displaySkill: string,
): MerkleTreePath<Uint8Array> {
  return tree.deriveMembershipPath(canonicalSkillId(displaySkill));
}

export function buildAcceptedIssuerTree(
  publicKeys: readonly JubjubPoint[],
): AcceptedIssuerTree {
  return buildJubjubPointMerkleTree(publicKeys);
}

export function deriveIssuerMembershipPath(
  tree: AcceptedIssuerTree,
  publicKey: JubjubPoint,
): MerkleTreePath<JubjubPoint> {
  return tree.deriveMembershipPath(publicKey);
}

export function createWorkCredential(
  input: WorkCredentialInput,
): WorkCredentialV1 {
  const credentialId = input.credentialId ?? new Uint8Array(randomBytes(32));
  assertBytes32(credentialId, "credentialId");
  assertBytes32(input.holderCommitment, "holderCommitment");

  return {
    credentialId: new Uint8Array(credentialId),
    holderCommitment: new Uint8Array(input.holderCommitment),
    skillsRoot: { field: input.skillsRoot.field },
    durationMonths: normalizeUint16(input.durationMonths, "durationMonths"),
    deliveredToProduction: input.deliveredToProduction,
    clientRatingHundredths: normalizeRating(input.clientRatingHundredths),
  };
}

export function deriveWorkCredentialDigest(
  credential: WorkCredentialV1,
): Uint8Array {
  assertBytes32(credential.credentialId, "credentialId");
  assertBytes32(credential.holderCommitment, "holderCommitment");
  const durationMonths = normalizeUint16(
    credential.durationMonths,
    "durationMonths",
  );
  const clientRatingHundredths = normalizeRating(
    credential.clientRatingHundredths,
  );

  return persistentHash(workCredentialDigestType, [
    CREDENTIAL_DOMAIN,
    credential.credentialId,
    credential.holderCommitment,
    credential.skillsRoot,
    durationMonths,
    credential.deliveredToProduction,
    clientRatingHundredths,
  ]);
}

export function signWorkCredential(
  credential: WorkCredentialV1,
  issuerSigningKey: bigint,
): Schnorr_SchnorrSignature {
  const signingKey = normalizeScalar(issuerSigningKey, "issuer signing key");
  const publicKey = ecMulGenerator(signingKey);
  const nonce = randomScalar();
  const announcement = ecMulGenerator(nonce);
  const message = signingMessage(deriveWorkCredentialDigest(credential));
  const signatureChallenge = challenge(announcement, publicKey, message);
  const response = (nonce + signatureChallenge * signingKey) % JUBJUB_ORDER;

  return { announcement, response };
}

export function verifyWorkCredentialSignature(
  credential: WorkCredentialV1,
  issuerSignature: Schnorr_SchnorrSignature,
  issuerPublicKey: JubjubPoint,
): boolean {
  try {
    const message = signingMessage(deriveWorkCredentialDigest(credential));
    const signatureChallenge = challenge(
      issuerSignature.announcement,
      issuerPublicKey,
      message,
    );
    const left = ecMulGenerator(issuerSignature.response);
    const right = ecAdd(
      issuerSignature.announcement,
      ecMul(issuerPublicKey, signatureChallenge),
    );
    return left.x === right.x && left.y === right.y;
  } catch {
    return false;
  }
}
