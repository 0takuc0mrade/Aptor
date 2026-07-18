import {
  ZKConfigProvider,
  createProverKey,
  createVerifierKey,
  createZKIR,
  type ProverKey,
  type VerifierKey,
  type ZKIR,
} from "@midnight-ntwrk/midnight-js-types";

import { AptorError } from "./errors.js";

export const APTOR_CIRCUITS = [
  "createProofRequest",
  "proveAgainstRequest",
] as const;
export type AptorCircuit = (typeof APTOR_CIRCUITS)[number];

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/u, "");
}

export class AptorFetchZkConfigProvider extends ZKConfigProvider<AptorCircuit> {
  readonly #baseUrl: string;
  readonly #fetch: typeof fetch;

  constructor(baseUrl: string, fetchFunction: typeof fetch = globalThis.fetch) {
    super();
    this.#baseUrl = stripTrailingSlash(baseUrl);
    this.#fetch = fetchFunction.bind(globalThis);
  }

  async #get(path: string): Promise<Uint8Array> {
    const response = await this.#fetch(`${this.#baseUrl}/${path}`, {
      cache: "force-cache",
    });
    if (!response.ok) {
      throw new AptorError(
        "MISSING_ZK_ARTIFACTS",
        `A required Aptor proof artifact is unavailable (${path}).`,
      );
    }
    return new Uint8Array(await response.arrayBuffer());
  }

  async getZKIR(circuitId: AptorCircuit): Promise<ZKIR> {
    return createZKIR(await this.#get(`zkir/${circuitId}.bzkir`));
  }

  async getProverKey(circuitId: AptorCircuit): Promise<ProverKey> {
    return createProverKey(await this.#get(`keys/${circuitId}.prover`));
  }

  async getVerifierKey(circuitId: AptorCircuit): Promise<VerifierKey> {
    return createVerifierKey(await this.#get(`keys/${circuitId}.verifier`));
  }
}

export async function validateZkArtifactManifest(
  baseUrl: string,
  fetchFunction: typeof fetch = globalThis.fetch,
): Promise<void> {
  const root = stripTrailingSlash(baseUrl);
  const files = APTOR_CIRCUITS.flatMap((circuit) => [
    `keys/${circuit}.prover`,
    `keys/${circuit}.verifier`,
    `zkir/${circuit}.bzkir`,
  ]);
  for (const file of files) {
    const response = await fetchFunction(`${root}/${file}`, {
      method: "HEAD",
      cache: "no-store",
    });
    if (!response.ok) {
      throw new AptorError(
        "MISSING_ZK_ARTIFACTS",
        `Aptor cannot start proof generation because ${file} is missing.`,
      );
    }
  }
}
