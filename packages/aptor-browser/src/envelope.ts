import {
  encryptedEnvelopeInputSchema,
  encryptedEnvelopeSchema,
  privateEncryptionKeySchema,
  publicEncryptionKeySchema,
  type AptorEncryptedEnvelopeInputV1,
  type AptorEncryptedEnvelopeV1,
  type AptorEnvelopeType,
  type AptorPrivateEncryptionKeyV1,
  type AptorPublicEncryptionKeyV1,
} from "@aptor/shared";

import { fromBase64, toBase64 } from "./encoding.js";
import { AptorError } from "./errors.js";

const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });
const ENVELOPE_BYTES_MAX = 256 * 1024;
const NONCE_BYTES = 12;

function asArrayBuffer(value: Uint8Array): ArrayBuffer {
  return Uint8Array.from(value).buffer;
}

function context(
  senderProfileId: string,
  recipientProfileId: string,
  envelopeType: AptorEnvelopeType,
  contentDigest: string,
): string {
  return [
    "aptor-envelope",
    "1",
    senderProfileId,
    recipientProfileId,
    envelopeType,
    contentDigest,
  ].join(":");
}

async function sha256(value: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(
    await globalThis.crypto.subtle.digest("SHA-256", asArrayBuffer(value)),
  );
}

async function deriveEnvelopeKey(
  privateKey: CryptoKey,
  publicKey: CryptoKey,
  domain: string,
): Promise<CryptoKey> {
  const sharedBits = await globalThis.crypto.subtle.deriveBits(
    { name: "ECDH", public: publicKey },
    privateKey,
    256,
  );
  const material = await globalThis.crypto.subtle.importKey(
    "raw",
    sharedBits,
    "HKDF",
    false,
    ["deriveKey"],
  );
  const salt = await sha256(encoder.encode(`aptor-envelope-salt:1:${domain}`));
  return globalThis.crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: asArrayBuffer(salt),
      info: asArrayBuffer(encoder.encode(`aptor-envelope-key:1:${domain}`)),
    },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

async function importPublicKey(
  value: AptorPublicEncryptionKeyV1,
): Promise<CryptoKey> {
  const parsed = publicEncryptionKeySchema.parse(value);
  return globalThis.crypto.subtle.importKey(
    "spki",
    asArrayBuffer(fromBase64(parsed.value)),
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );
}

async function importPrivateKey(
  value: AptorPrivateEncryptionKeyV1,
): Promise<CryptoKey> {
  const parsed = privateEncryptionKeySchema.parse(value);
  return globalThis.crypto.subtle.importKey(
    "pkcs8",
    asArrayBuffer(fromBase64(parsed.value)),
    { name: "ECDH", namedCurve: "P-256" },
    false,
    ["deriveBits"],
  );
}

export async function generateEncryptionKeyPair(): Promise<{
  publicKey: AptorPublicEncryptionKeyV1;
  privateKey: AptorPrivateEncryptionKeyV1;
}> {
  const keys = (await globalThis.crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"],
  )) as CryptoKeyPair;
  const [publicBytes, privateBytes] = await Promise.all([
    globalThis.crypto.subtle.exportKey("spki", keys.publicKey),
    globalThis.crypto.subtle.exportKey("pkcs8", keys.privateKey),
  ]);
  return {
    publicKey: publicEncryptionKeySchema.parse({
      algorithm: "ECDH-P256",
      format: "spki",
      value: toBase64(new Uint8Array(publicBytes)),
    }),
    privateKey: privateEncryptionKeySchema.parse({
      algorithm: "ECDH-P256",
      format: "pkcs8",
      value: toBase64(new Uint8Array(privateBytes)),
    }),
  };
}

export async function encryptEnvelopePayload(
  payload: unknown,
  senderProfileId: string,
  recipientProfileId: string,
  envelopeType: AptorEnvelopeType,
  recipientPublicKey: AptorPublicEncryptionKeyV1,
): Promise<AptorEncryptedEnvelopeInputV1> {
  const plaintext = encoder.encode(JSON.stringify(payload));
  if (plaintext.byteLength > ENVELOPE_BYTES_MAX) {
    throw new AptorError(
      "ENVELOPE_TOO_LARGE",
      "This encrypted Aptor delivery exceeds the 256 KiB limit.",
    );
  }
  const contentDigest = Array.from(await sha256(plaintext), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  const domain = context(
    senderProfileId,
    recipientProfileId,
    envelopeType,
    contentDigest,
  );
  const ephemeral = (await globalThis.crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"],
  )) as CryptoKeyPair;
  const envelopeKey = await deriveEnvelopeKey(
    ephemeral.privateKey,
    await importPublicKey(recipientPublicKey),
    domain,
  );
  const nonce = globalThis.crypto.getRandomValues(new Uint8Array(NONCE_BYTES));
  const ciphertext = await globalThis.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: asArrayBuffer(nonce),
      additionalData: asArrayBuffer(encoder.encode(domain)),
      tagLength: 128,
    },
    envelopeKey,
    asArrayBuffer(plaintext),
  );
  const ephemeralPublicKey = await globalThis.crypto.subtle.exportKey(
    "spki",
    ephemeral.publicKey,
  );
  return encryptedEnvelopeInputSchema.parse({
    senderProfileId,
    recipientProfileId,
    envelopeType,
    ciphertext: toBase64(new Uint8Array(ciphertext)),
    nonce: toBase64(nonce),
    ephemeralPublicKey: {
      algorithm: "ECDH-P256",
      format: "spki",
      value: toBase64(new Uint8Array(ephemeralPublicKey)),
    },
    encryptionVersion: 1,
    contentDigest,
  });
}

export async function decryptEnvelopePayload(
  value: AptorEncryptedEnvelopeV1 | AptorEncryptedEnvelopeInputV1 | unknown,
  recipientProfileId: string,
  recipientPrivateKey: AptorPrivateEncryptionKeyV1,
): Promise<unknown> {
  if (
    typeof value === "object" &&
    value !== null &&
    "encryptionVersion" in value &&
    (value as { encryptionVersion?: unknown }).encryptionVersion !== 1
  ) {
    throw new AptorError(
      "UNSUPPORTED_VERSION",
      "This Aptor delivery uses an unsupported encryption version.",
    );
  }
  const deliveredEnvelope = encryptedEnvelopeSchema.safeParse(value);
  const parsed = deliveredEnvelope.success
    ? deliveredEnvelope.data
    : encryptedEnvelopeInputSchema.parse(value);
  if (parsed.recipientProfileId !== recipientProfileId) {
    throw new AptorError(
      "WRONG_ENVELOPE_RECIPIENT",
      "This encrypted delivery belongs to a different Aptor profile.",
    );
  }
  const domain = context(
    parsed.senderProfileId,
    parsed.recipientProfileId,
    parsed.envelopeType,
    parsed.contentDigest,
  );
  try {
    const nonce = fromBase64(parsed.nonce);
    if (nonce.length !== NONCE_BYTES) throw new TypeError("Invalid nonce.");
    const envelopeKey = await deriveEnvelopeKey(
      await importPrivateKey(recipientPrivateKey),
      await importPublicKey(parsed.ephemeralPublicKey),
      domain,
    );
    const plaintext = new Uint8Array(
      await globalThis.crypto.subtle.decrypt(
        {
          name: "AES-GCM",
          iv: asArrayBuffer(nonce),
          additionalData: asArrayBuffer(encoder.encode(domain)),
          tagLength: 128,
        },
        envelopeKey,
        asArrayBuffer(fromBase64(parsed.ciphertext)),
      ),
    );
    const digest = Array.from(await sha256(plaintext), (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("");
    if (digest !== parsed.contentDigest)
      throw new TypeError("Digest mismatch.");
    return JSON.parse(decoder.decode(plaintext)) as unknown;
  } catch (error) {
    if (error instanceof AptorError) throw error;
    throw new AptorError(
      "ENVELOPE_INTEGRITY_FAILED",
      "This encrypted delivery is damaged or failed its integrity check.",
      { cause: error },
    );
  }
}
