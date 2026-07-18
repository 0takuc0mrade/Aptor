import { aptorProfileSchema, type AptorProfileV1 } from "@aptor/shared";

import { encryptAccountVault, decryptAccountVault } from "./crypto.js";
import { createIssuerVault, createProfessionalVault } from "./domain.js";
import { fromBase64, toBase64 } from "./encoding.js";
import { generateEncryptionKeyPair } from "./envelope.js";
import { AptorError } from "./errors.js";
import {
  accountVaultSchema,
  encryptedAccountVaultSchema,
  type AptorAccountVaultV1,
  type AptorEncryptedAccountVaultV1,
} from "./schemas.js";

const DATABASE_NAME = "aptor-encrypted-vaults";
const DATABASE_VERSION = 1;
const STORE_NAME = "vaults";
const ACCOUNT_KEY = "account";

function openDatabase(): Promise<IDBDatabase> {
  if (globalThis.indexedDB === undefined) {
    throw new Error("IndexedDB is unavailable in this browser.");
  }
  return new Promise((resolve, reject) => {
    const request = globalThis.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("IndexedDB failed."));
    request.onblocked = () =>
      reject(new Error("Close other Aptor tabs before updating the account."));
  });
}

async function readStoredAccount(): Promise<AptorEncryptedAccountVaultV1 | null> {
  const database = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readonly");
      const request = transaction.objectStore(STORE_NAME).get(ACCOUNT_KEY);
      request.onsuccess = () =>
        resolve(
          request.result === undefined
            ? null
            : encryptedAccountVaultSchema.parse(request.result),
        );
      request.onerror = () =>
        reject(request.error ?? new Error("Account storage failed."));
    });
  } finally {
    database.close();
  }
}

async function writeStoredAccount(
  value: AptorEncryptedAccountVaultV1,
): Promise<void> {
  const parsed = encryptedAccountVaultSchema.parse(value);
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).put(parsed, ACCOUNT_KEY);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () =>
        reject(transaction.error ?? new Error("Account storage failed."));
      transaction.onabort = () =>
        reject(transaction.error ?? new Error("Account storage was aborted."));
    });
  } finally {
    database.close();
  }
}

export function normalizeHandle(value: string): string {
  return value
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replaceAll(/\s+/gu, "-")
    .replaceAll(/[^a-z0-9_-]/gu, "")
    .replaceAll(/[-_]{2,}/gu, "-")
    .replace(/^[-_]+|[-_]+$/gu, "");
}

export function createCapabilityToken(bytes = 32): string {
  const value = globalThis.crypto.getRandomValues(new Uint8Array(bytes));
  return toBase64(value)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

export async function hashCapability(value: string): Promise<string> {
  const digest = new Uint8Array(
    await globalThis.crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(value),
    ),
  );
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

export async function createAptorAccount(
  handleValue: string,
  displayNameValue: string,
): Promise<AptorAccountVaultV1> {
  const handle = normalizeHandle(handleValue);
  const displayName = displayNameValue.trim();
  const professional = createProfessionalVault();
  const issuer = createIssuerVault(displayName);
  const encryptionKeys = await generateEncryptionKeyPair();
  const createdAt = new Date().toISOString();
  const profile: AptorProfileV1 = aptorProfileSchema.parse({
    profileId: professional.profile.profileId,
    handle,
    displayName,
    publicEncryptionKey: encryptionKeys.publicKey,
    holderProfile: professional.profile,
    issuerProfile: issuer.profile,
    createdAt,
  });
  return accountVaultSchema.parse({
    kind: "account",
    profile,
    privateProfile: {
      profileId: profile.profileId,
      accessToken: createCapabilityToken(),
      privateEncryptionKey: encryptionKeys.privateKey,
    },
    professional,
    issuer,
    verifier: { trustedProfiles: [], activeRequests: [] },
  });
}

export class AptorAccountSession {
  #state: AptorAccountVaultV1 | null = null;
  #password: string | null = null;
  #createdAt: string | null = null;

  get isUnlocked(): boolean {
    return this.#state !== null;
  }

  get state(): AptorAccountVaultV1 {
    if (this.#state === null) {
      throw new AptorError(
        "VAULT_LOCKED",
        "Unlock your Aptor account before continuing.",
      );
    }
    return structuredClone(this.#state);
  }

  async exists(): Promise<boolean> {
    return (await readStoredAccount()) !== null;
  }

  async create(password: string, state: AptorAccountVaultV1): Promise<void> {
    const parsed = accountVaultSchema.parse(state);
    const encrypted = await encryptAccountVault(parsed, password);
    await writeStoredAccount(encrypted);
    this.#state = structuredClone(parsed);
    this.#password = password;
    this.#createdAt = encrypted.createdAt;
  }

  async unlock(password: string): Promise<AptorAccountVaultV1> {
    const encrypted = await readStoredAccount();
    if (encrypted === null) {
      throw new AptorError(
        "VAULT_NOT_FOUND",
        "No local Aptor account exists in this browser.",
      );
    }
    this.#state = await decryptAccountVault(encrypted, password);
    this.#password = password;
    this.#createdAt = encrypted.createdAt;
    return this.state;
  }

  async save(state: AptorAccountVaultV1): Promise<void> {
    if (this.#state === null || this.#password === null) {
      throw new AptorError(
        "VAULT_LOCKED",
        "Unlock your Aptor account before saving changes.",
      );
    }
    const parsed = accountVaultSchema.parse(state);
    const encrypted = await encryptAccountVault(
      parsed,
      this.#password,
      this.#createdAt ?? undefined,
    );
    await writeStoredAccount(encrypted);
    this.#state = structuredClone(parsed);
    this.#createdAt = encrypted.createdAt;
  }

  lock(): void {
    this.#state = null;
    this.#password = null;
    this.#createdAt = null;
  }

  async exportBackup(): Promise<AptorEncryptedAccountVaultV1> {
    const encrypted = await readStoredAccount();
    if (encrypted === null) {
      throw new AptorError(
        "VAULT_NOT_FOUND",
        "Create an Aptor account before exporting a backup.",
      );
    }
    return structuredClone(encrypted);
  }

  async importBackup(
    value: unknown,
    password: string,
  ): Promise<AptorAccountVaultV1> {
    const encrypted = encryptedAccountVaultSchema.parse(value);
    const state = await decryptAccountVault(encrypted, password);
    await writeStoredAccount(encrypted);
    this.#state = structuredClone(state);
    this.#password = password;
    this.#createdAt = encrypted.createdAt;
    return this.state;
  }
}
