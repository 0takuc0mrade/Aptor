import type {
  ContractAddress,
  SigningKey,
} from "@midnight-ntwrk/midnight-js-protocol/compact-runtime";
import type {
  ExportPrivateStatesOptions,
  ExportSigningKeysOptions,
  ImportPrivateStatesOptions,
  ImportPrivateStatesResult,
  ImportSigningKeysOptions,
  ImportSigningKeysResult,
  PrivateStateExport,
  PrivateStateId,
  PrivateStateProvider,
  SigningKeyExport,
} from "@midnight-ntwrk/midnight-js-types";

/**
 * Proof-scoped private state. The encrypted Aptor vault is the durable source;
 * this provider deliberately cannot export or persist witness material.
 */
export class EphemeralPrivateStateProvider<
  PSI extends PrivateStateId,
  PS,
> implements PrivateStateProvider<PSI, PS> {
  #contractAddress: ContractAddress | null = null;
  readonly #states = new Map<string, PS>();
  readonly #deploymentStates = new Map<PSI, PS>();
  readonly #signingKeys = new Map<ContractAddress, SigningKey>();

  setContractAddress(address: ContractAddress): void {
    this.#contractAddress = address;
    for (const [id, state] of this.#deploymentStates) {
      this.#states.set(this.#stateKey(id), state);
    }
    this.#deploymentStates.clear();
  }

  #stateKey(id: PSI): string {
    if (this.#contractAddress === null) {
      throw new Error("Set a contract address before using private state.");
    }
    return `${this.#contractAddress}:${id}`;
  }

  async set(id: PSI, state: PS): Promise<void> {
    if (this.#contractAddress === null) {
      this.#deploymentStates.set(id, state);
      return;
    }
    this.#states.set(this.#stateKey(id), state);
  }

  async get(id: PSI): Promise<PS | null> {
    if (this.#contractAddress === null) {
      return this.#deploymentStates.get(id) ?? null;
    }
    return this.#states.get(this.#stateKey(id)) ?? null;
  }

  async remove(id: PSI): Promise<void> {
    if (this.#contractAddress === null) {
      this.#deploymentStates.delete(id);
      return;
    }
    this.#states.delete(this.#stateKey(id));
  }

  async clear(): Promise<void> {
    this.#states.clear();
    this.#deploymentStates.clear();
  }

  async setSigningKey(
    address: ContractAddress,
    signingKey: SigningKey,
  ): Promise<void> {
    this.#signingKeys.set(address, signingKey);
  }

  async getSigningKey(address: ContractAddress): Promise<SigningKey | null> {
    return this.#signingKeys.get(address) ?? null;
  }

  async removeSigningKey(address: ContractAddress): Promise<void> {
    this.#signingKeys.delete(address);
  }

  async clearSigningKeys(): Promise<void> {
    this.#signingKeys.clear();
  }

  async exportPrivateStates(
    _options?: ExportPrivateStatesOptions,
  ): Promise<PrivateStateExport> {
    throw new Error(
      "Proof-scoped private state cannot be exported. Back up the encrypted Aptor vault instead.",
    );
  }

  async importPrivateStates(
    _exportData: PrivateStateExport,
    _options?: ImportPrivateStatesOptions,
  ): Promise<ImportPrivateStatesResult> {
    throw new Error(
      "Import private credentials into the encrypted Aptor vault, not the proof-scoped provider.",
    );
  }

  async exportSigningKeys(
    _options?: ExportSigningKeysOptions,
  ): Promise<SigningKeyExport> {
    throw new Error("Ephemeral maintenance keys cannot be exported.");
  }

  async importSigningKeys(
    _exportData: SigningKeyExport,
    _options?: ImportSigningKeysOptions,
  ): Promise<ImportSigningKeysResult> {
    throw new Error("Ephemeral maintenance keys cannot be imported.");
  }

  async dispose(): Promise<void> {
    await this.clear();
    await this.clearSigningKeys();
    this.#contractAddress = null;
  }
}
