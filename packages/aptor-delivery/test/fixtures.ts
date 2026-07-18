import type {
  AptorEncryptedEnvelopeInputV1,
  AptorProfileV1,
} from "@aptor/shared";

export function profile(index: number, handle: string): AptorProfileV1 {
  const hex = index.toString(16).padStart(2, "0").repeat(16);
  const digest = index.toString(16).padStart(2, "0").repeat(32);
  const createdAt = "2026-07-18T00:00:00.000Z";
  return {
    profileId: `apt_${hex}`,
    handle,
    displayName: handle.replaceAll("-", " "),
    publicEncryptionKey: {
      algorithm: "ECDH-P256",
      format: "spki",
      value: "A".repeat(88),
    },
    holderProfile: {
      format: "aptor-holder",
      version: 1,
      profileId: `apt_${hex}`,
      holderCommitment: digest,
      createdAt,
    },
    issuerProfile: {
      format: "aptor-issuer",
      version: 1,
      issuerPublicKey: `aptor-jubjub-v1:${digest}:${digest}`,
      displayName: handle,
      createdAt,
    },
    createdAt,
  };
}

export function envelope(
  senderProfileId: string,
  recipientProfileId: string,
  type: "proof_request" | "work_credential" = "proof_request",
): AptorEncryptedEnvelopeInputV1 {
  return {
    senderProfileId,
    recipientProfileId,
    envelopeType: type,
    ciphertext: "Q".repeat(64),
    nonce: "T".repeat(16),
    ephemeralPublicKey: {
      algorithm: "ECDH-P256",
      format: "spki",
      value: "E".repeat(88),
    },
    encryptionVersion: 1,
    contentDigest: "ab".repeat(32),
  };
}
