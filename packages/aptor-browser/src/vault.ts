import { decryptVault, encryptVault } from "./crypto.js";
import { AptorError } from "./errors.js";
import {
  encryptedVaultSchema,
  type AptorEncryptedVaultV1,
  type AptorVaultKind,
  type IssuerVaultV1,
  type ProfessionalVaultV1,
} from "./schemas.js";

const DATABASE_NAME = "aptor-encrypted-vaults";
const DATABASE_VERSION = 1;
const STORE_NAME = "vaults";

type VaultFor<K extends AptorVaultKind> = K extends "professional"
  ? ProfessionalVaultV1
  : IssuerVaultV1;

function openDatabase(): Promise<IDBDatabase> {
  if (globalThis.indexedDB === undefined) {
    throw new Error("IndexedDB is unavailable in this browser.");
  }
  return new Promise((resolve, reject) => {
    const request = globalThis.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("IndexedDB failed."));
    request.onblocked = () =>
      reject(new Error("Close other Aptor tabs before updating the vault."));
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const database = await openDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, mode);
      const request = operation(transaction.objectStore(STORE_NAME));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () =>
        reject(request.error ?? new Error("Vault storage failed."));
      transaction.onabort = () =>
        reject(transaction.error ?? new Error("Vault storage was aborted."));
    });
  } finally {
    database.close();
  }
}

export async function readEncryptedVault(
  kind: AptorVaultKind,
): Promise<AptorEncryptedVaultV1 | null> {
  const value = await withStore<unknown>("readonly", (store) =>
    store.get(kind),
  );
  return value === undefined ? null : encryptedVaultSchema.parse(value);
}

export async function writeEncryptedVault(
  container: AptorEncryptedVaultV1,
): Promise<void> {
  const parsed = encryptedVaultSchema.parse(container);
  await withStore<IDBValidKey>("readwrite", (store) =>
    store.put(parsed, parsed.kind),
  );
}

export async function deleteEncryptedVault(
  kind: AptorVaultKind,
): Promise<void> {
  await withStore<undefined>("readwrite", (store) => store.delete(kind));
}

export class VaultSession<K extends AptorVaultKind> {
  readonly kind: K;
  #state: VaultFor<K> | null = null;
  #password: string | null = null;
  #createdAt: string | null = null;

  constructor(kind: K) {
    this.kind = kind;
  }

  get isUnlocked(): boolean {
    return this.#state !== null;
  }

  get state(): VaultFor<K> {
    if (this.#state === null) {
      throw new AptorError(
        "VAULT_LOCKED",
        "Unlock your Aptor vault before continuing.",
      );
    }
    return structuredClone(this.#state);
  }

  async exists(): Promise<boolean> {
    return (await readEncryptedVault(this.kind)) !== null;
  }

  async create(password: string, initialState: VaultFor<K>): Promise<void> {
    if (initialState.kind !== this.kind) {
      throw new TypeError("Vault kind does not match this session.");
    }
    const container = await encryptVault(initialState, password);
    await writeEncryptedVault(container);
    this.#state = structuredClone(initialState);
    this.#password = password;
    this.#createdAt = container.createdAt;
  }

  async unlock(password: string): Promise<VaultFor<K>> {
    const container = await readEncryptedVault(this.kind);
    if (container === null) {
      throw new AptorError(
        "VAULT_NOT_FOUND",
        "No local Aptor vault exists for this role.",
      );
    }
    const state = await decryptVault(
      container as AptorEncryptedVaultV1 & { kind: K },
      password,
    );
    this.#state = structuredClone(state) as VaultFor<K>;
    this.#password = password;
    this.#createdAt = container.createdAt;
    return this.state;
  }

  async save(nextState: VaultFor<K>): Promise<void> {
    if (this.#password === null || this.#state === null) {
      throw new AptorError(
        "VAULT_LOCKED",
        "Unlock your Aptor vault before saving changes.",
      );
    }
    if (nextState.kind !== this.kind) {
      throw new TypeError("Vault kind does not match this session.");
    }
    const container = await encryptVault(
      nextState,
      this.#password,
      this.#createdAt ?? undefined,
    );
    await writeEncryptedVault(container);
    this.#state = structuredClone(nextState);
    this.#createdAt = container.createdAt;
  }

  lock(): void {
    this.#state = null;
    this.#password = null;
    this.#createdAt = null;
  }

  async exportBackup(): Promise<AptorEncryptedVaultV1> {
    const container = await readEncryptedVault(this.kind);
    if (container === null) {
      throw new AptorError(
        "VAULT_NOT_FOUND",
        "Create or restore a vault before exporting a backup.",
      );
    }
    return structuredClone(container);
  }

  async importBackup(value: unknown, password: string): Promise<VaultFor<K>> {
    const container = encryptedVaultSchema.parse(value);
    if (container.kind !== this.kind) {
      throw new TypeError(`This is an ${container.kind} vault backup.`);
    }
    const state = await decryptVault(
      container as AptorEncryptedVaultV1 & { kind: K },
      password,
    );
    await writeEncryptedVault(container);
    this.#state = structuredClone(state) as VaultFor<K>;
    this.#password = password;
    this.#createdAt = container.createdAt;
    return this.state;
  }

  async deleteLocal(): Promise<void> {
    await deleteEncryptedVault(this.kind);
    this.lock();
  }
}
