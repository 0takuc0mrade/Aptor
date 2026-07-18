import { AptorError } from "./errors.js";
import { fromBase64, toBase64 } from "./encoding.js";
import {
  encryptedCredentialPackageSchema,
  encryptedAccountVaultSchema,
  accountVaultSchema,
  encryptedVaultSchema,
  issuerVaultSchema,
  professionalVaultSchema,
  signedCredentialSchema,
  type AptorEncryptedCredentialPackageV1,
  type AptorEncryptedAccountVaultV1,
  type AptorAccountVaultV1,
  type AptorEncryptedVaultV1,
  type AptorSignedCredentialV1,
  type AptorVaultKind,
  type IssuerVaultV1,
  type ProfessionalVaultV1,
} from "./schemas.js";

const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });
export const PBKDF2_ITERATIONS = 310_000;
const SALT_BYTES = 32;
const IV_BYTES = 12;

type VaultValue = ProfessionalVaultV1 | IssuerVaultV1;

function randomBytes(length: number): Uint8Array {
  return globalThis.crypto.getRandomValues(new Uint8Array(length));
}

function asArrayBuffer(value: Uint8Array): ArrayBuffer {
  return Uint8Array.from(value).buffer;
}

async function deriveAesKey(
  passphrase: string,
  salt: Uint8Array,
  iterations: number,
): Promise<CryptoKey> {
  if (passphrase.length < 12) {
    throw new RangeError("Passphrases must contain at least 12 characters.");
  }
  const material = await globalThis.crypto.subtle.importKey(
    "raw",
    encoder.encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return globalThis.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: asArrayBuffer(salt),
      iterations,
    },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

async function encryptJson(
  value: unknown,
  passphrase: string,
  additionalData: string,
): Promise<{
  encryption: AptorEncryptedVaultV1["encryption"];
  ciphertext: string;
}> {
  const salt = randomBytes(SALT_BYTES);
  const iv = randomBytes(IV_BYTES);
  const key = await deriveAesKey(passphrase, salt, PBKDF2_ITERATIONS);
  const ciphertext = await globalThis.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: asArrayBuffer(iv),
      additionalData: asArrayBuffer(encoder.encode(additionalData)),
      tagLength: 128,
    },
    key,
    asArrayBuffer(encoder.encode(JSON.stringify(value))),
  );
  return {
    encryption: {
      algorithm: "AES-GCM",
      keyDerivation: "PBKDF2-SHA-256",
      salt: toBase64(salt),
      iterations: PBKDF2_ITERATIONS,
      iv: toBase64(iv),
    },
    ciphertext: toBase64(new Uint8Array(ciphertext)),
  };
}

async function decryptJson(
  encryption: AptorEncryptedVaultV1["encryption"],
  ciphertext: string,
  passphrase: string,
  additionalData: string,
): Promise<unknown> {
  try {
    const salt = fromBase64(encryption.salt);
    const iv = fromBase64(encryption.iv);
    if (salt.length !== SALT_BYTES || iv.length !== IV_BYTES) {
      throw new TypeError("Encrypted data uses invalid salt or IV lengths.");
    }
    const key = await deriveAesKey(passphrase, salt, encryption.iterations);
    const plaintext = await globalThis.crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: asArrayBuffer(iv),
        additionalData: asArrayBuffer(encoder.encode(additionalData)),
        tagLength: 128,
      },
      key,
      asArrayBuffer(fromBase64(ciphertext)),
    );
    return JSON.parse(decoder.decode(plaintext)) as unknown;
  } catch (error) {
    if (error instanceof RangeError) throw error;
    throw new AptorError(
      "INVALID_VAULT_PASSWORD",
      "The password is incorrect or the encrypted data was modified.",
      { cause: error },
    );
  }
}

export async function encryptCredentialPackage(
  credential: AptorSignedCredentialV1,
  transferPassphrase: string,
): Promise<AptorEncryptedCredentialPackageV1> {
  const parsedCredential = signedCredentialSchema.parse(credential);
  const createdAt = new Date().toISOString();
  const encrypted = await encryptJson(
    parsedCredential,
    transferPassphrase,
    "aptor-credential:1",
  );
  return encryptedCredentialPackageSchema.parse({
    format: "aptor-credential",
    version: 1,
    ...encrypted,
    createdAt,
  });
}

export async function decryptCredentialPackage(
  container: AptorEncryptedCredentialPackageV1,
  transferPassphrase: string,
): Promise<AptorSignedCredentialV1> {
  const parsedContainer = encryptedCredentialPackageSchema.parse(container);
  try {
    const value = await decryptJson(
      parsedContainer.encryption,
      parsedContainer.ciphertext,
      transferPassphrase,
      "aptor-credential:1",
    );
    return signedCredentialSchema.parse(value);
  } catch (error) {
    throw new AptorError(
      "CREDENTIAL_PACKAGE_ALTERED",
      "The transfer passphrase is incorrect or this credential package was modified.",
      { cause: error },
    );
  }
}

export async function encryptVault(
  value: VaultValue,
  password: string,
  previousCreatedAt?: string,
): Promise<AptorEncryptedVaultV1> {
  const parsedValue =
    value.kind === "professional"
      ? professionalVaultSchema.parse(value)
      : issuerVaultSchema.parse(value);
  const now = new Date().toISOString();
  const encrypted = await encryptJson(
    parsedValue,
    password,
    `aptor-vault-backup:1:${value.kind}`,
  );
  return encryptedVaultSchema.parse({
    format: "aptor-vault-backup",
    version: 1,
    kind: value.kind,
    ...(value.kind === "professional"
      ? { profileId: value.profile.profileId }
      : {}),
    ...encrypted,
    createdAt: previousCreatedAt ?? now,
    updatedAt: now,
  });
}

export async function decryptVault<K extends AptorVaultKind>(
  container: AptorEncryptedVaultV1 & { kind: K },
  password: string,
): Promise<K extends "professional" ? ProfessionalVaultV1 : IssuerVaultV1> {
  const parsedContainer = encryptedVaultSchema.parse(container);
  const value = await decryptJson(
    parsedContainer.encryption,
    parsedContainer.ciphertext,
    password,
    `aptor-vault-backup:1:${parsedContainer.kind}`,
  );
  const parsed =
    parsedContainer.kind === "professional"
      ? professionalVaultSchema.parse(value)
      : issuerVaultSchema.parse(value);
  return parsed as K extends "professional"
    ? ProfessionalVaultV1
    : IssuerVaultV1;
}

export async function encryptAccountVault(
  value: AptorAccountVaultV1,
  password: string,
  previousCreatedAt?: string,
): Promise<AptorEncryptedAccountVaultV1> {
  const parsed = accountVaultSchema.parse(value);
  const now = new Date().toISOString();
  const encrypted = await encryptJson(
    parsed,
    password,
    `aptor-account-vault:1:${parsed.profile.profileId}`,
  );
  return encryptedAccountVaultSchema.parse({
    format: "aptor-account-vault-backup",
    version: 1,
    profileId: parsed.profile.profileId,
    ...encrypted,
    createdAt: previousCreatedAt ?? now,
    updatedAt: now,
  });
}

export async function decryptAccountVault(
  container: AptorEncryptedAccountVaultV1,
  password: string,
): Promise<AptorAccountVaultV1> {
  const parsed = encryptedAccountVaultSchema.parse(container);
  const value = await decryptJson(
    parsed.encryption,
    parsed.ciphertext,
    password,
    `aptor-account-vault:1:${parsed.profileId}`,
  );
  return accountVaultSchema.parse(value);
}
