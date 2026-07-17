import { randomBytes } from "node:crypto";

import {
  CompactTypeBytes,
  CompactTypeUnsignedInteger,
  ecAdd,
  ecMul,
  ecMulGenerator,
  persistentHash,
  transientHash,
  type CompactType,
  type JubjubPoint,
} from "@midnight-ntwrk/compact-runtime";

import {
  pureCircuits,
  type DurationCredential,
  type Schnorr_SchnorrSignature,
} from "../generated/aptor/contract/index.js";

export type IssuerKeyPair = Readonly<{
  signingKey: bigint;
  publicKey: JubjubPoint;
}>;

export type DurationCredentialInput = Readonly<{
  credentialId?: Uint8Array;
  holderCommitment: Uint8Array;
  durationMonths: number | bigint;
}>;

const JUBJUB_ORDER =
  6_554_484_396_890_773_809_930_967_563_523_245_729_705_921_265_872_317_281_365_359_162_392_183_254_199n;
const TWO_248 =
  452_312_848_583_266_388_373_324_160_190_187_140_051_835_877_600_158_453_279_131_187_530_910_662_656n;
const MAX_UINT16 = 65_535n;
const bytes15 = new CompactTypeBytes(15);
const bytes28 = new CompactTypeBytes(28);
const bytes32 = new CompactTypeBytes(32);
const uint16 = new CompactTypeUnsignedInteger(MAX_UINT16, 2);
const encoder = new TextEncoder();
const HOLDER_DOMAIN = encoder.encode("aptor:holder:v1");
const CREDENTIAL_DOMAIN = encoder.encode("aptor:duration-credential:v1");

type HolderCommitmentPreimage = [Uint8Array, Uint8Array];
type CredentialDigestPreimage = [Uint8Array, Uint8Array, Uint8Array, bigint];

const holderCommitmentType: CompactType<HolderCommitmentPreimage> = {
  alignment: () => bytes15.alignment().concat(bytes32.alignment()),
  fromValue: (value) => [bytes15.fromValue(value), bytes32.fromValue(value)],
  toValue: ([domain, holderSecret]) =>
    bytes15.toValue(domain).concat(bytes32.toValue(holderSecret)),
};

const credentialDigestType: CompactType<CredentialDigestPreimage> = {
  alignment: () =>
    bytes28
      .alignment()
      .concat(bytes32.alignment(), bytes32.alignment(), uint16.alignment()),
  fromValue: (value) => [
    bytes28.fromValue(value),
    bytes32.fromValue(value),
    bytes32.fromValue(value),
    uint16.fromValue(value),
  ],
  toValue: ([domain, credentialId, holderCommitment, durationMonths]) =>
    bytes28
      .toValue(domain)
      .concat(
        bytes32.toValue(credentialId),
        bytes32.toValue(holderCommitment),
        uint16.toValue(durationMonths),
      ),
};

function assertBytes32(value: Uint8Array, field: string): void {
  if (!(value instanceof Uint8Array) || value.length !== 32) {
    throw new RangeError(`${field} must be exactly 32 bytes`);
  }
}

function normalizeDuration(durationMonths: number | bigint): bigint {
  const normalized = BigInt(durationMonths);
  if (normalized < 0n || normalized > MAX_UINT16) {
    throw new RangeError("durationMonths must fit within Compact Uint<16>");
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

export function createDurationCredential(
  input: DurationCredentialInput,
): DurationCredential {
  const credentialId = input.credentialId ?? new Uint8Array(randomBytes(32));
  assertBytes32(credentialId, "credentialId");
  assertBytes32(input.holderCommitment, "holderCommitment");

  return {
    credentialId: new Uint8Array(credentialId),
    holderCommitment: new Uint8Array(input.holderCommitment),
    durationMonths: normalizeDuration(input.durationMonths),
  };
}

export function deriveCredentialDigest(
  credential: DurationCredential,
): Uint8Array {
  assertBytes32(credential.credentialId, "credentialId");
  assertBytes32(credential.holderCommitment, "holderCommitment");
  const durationMonths = normalizeDuration(credential.durationMonths);

  return persistentHash(credentialDigestType, [
    CREDENTIAL_DOMAIN,
    credential.credentialId,
    credential.holderCommitment,
    durationMonths,
  ]);
}

export function signCredential(
  credential: DurationCredential,
  issuerSigningKey: bigint,
): Schnorr_SchnorrSignature {
  const signingKey = normalizeScalar(issuerSigningKey, "issuer signing key");
  const publicKey = ecMulGenerator(signingKey);
  const nonce = randomScalar();
  const announcement = ecMulGenerator(nonce);
  const message = signingMessage(deriveCredentialDigest(credential));
  const signatureChallenge = challenge(announcement, publicKey, message);
  const response = (nonce + signatureChallenge * signingKey) % JUBJUB_ORDER;

  return { announcement, response };
}

export function verifyCredentialSignature(
  credential: DurationCredential,
  issuerSignature: Schnorr_SchnorrSignature,
  issuerPublicKey: JubjubPoint,
): boolean {
  try {
    const message = signingMessage(deriveCredentialDigest(credential));
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
