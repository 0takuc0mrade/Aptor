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

export type AptorZkArtifactManifest = Readonly<{
  schemaVersion: 1;
  contractName: "AptorCredential";
  compilerVersion: string;
  languageVersion: string;
  runtimeVersion: string;
  sources: Readonly<Record<string, string>>;
  artifacts: Readonly<Record<string, string>>;
  fingerprint: string;
}>;

const SHA_256_PATTERN = /^[0-9a-f]{64}$/u;

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/u, "");
}

export class AptorFetchZkConfigProvider extends ZKConfigProvider<AptorCircuit> {
  readonly #baseUrl: string;
  readonly #fetch: typeof fetch;
  readonly #manifest: Promise<AptorZkArtifactManifest>;

  constructor(
    baseUrl: string,
    expectedFingerprint = "",
    fetchFunction: typeof fetch = globalThis.fetch,
  ) {
    super();
    this.#baseUrl = stripTrailingSlash(baseUrl);
    this.#fetch = fetchFunction.bind(globalThis);
    this.#manifest = fetchZkArtifactManifest(
      this.#baseUrl,
      expectedFingerprint,
      this.#fetch,
    );
  }

  async #get(path: string): Promise<Uint8Array> {
    const manifest = await this.#manifest;
    const response = await this.#fetch(`${this.#baseUrl}/${path}`, {
      cache: "force-cache",
    });
    if (!response.ok) {
      throw new AptorError(
        "MISSING_ZK_ARTIFACTS",
        `A required Aptor proof artifact is unavailable (${path}).`,
      );
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    const expectedHash = manifest.artifacts[path];
    if (
      expectedHash === undefined ||
      (await sha256Hex(bytes)) !== expectedHash
    ) {
      throw new AptorError(
        "ARTIFACT_MISMATCH",
        `Aptor refused ${path} because it does not match the deployed contract fingerprint.`,
      );
    }
    return bytes;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hashRecord(value: unknown): value is Record<string, string> {
  return (
    isRecord(value) &&
    Object.values(value).every(
      (entry) => typeof entry === "string" && SHA_256_PATTERN.test(entry),
    )
  );
}

function parseManifest(value: unknown): AptorZkArtifactManifest {
  if (
    !isRecord(value) ||
    value.schemaVersion !== 1 ||
    value.contractName !== "AptorCredential" ||
    typeof value.compilerVersion !== "string" ||
    typeof value.languageVersion !== "string" ||
    typeof value.runtimeVersion !== "string" ||
    !hashRecord(value.sources) ||
    !hashRecord(value.artifacts) ||
    typeof value.fingerprint !== "string" ||
    !SHA_256_PATTERN.test(value.fingerprint)
  ) {
    throw new AptorError(
      "ARTIFACT_MISMATCH",
      "Aptor's proof artifact manifest is invalid or incomplete.",
    );
  }
  return value as AptorZkArtifactManifest;
}

async function sha256Hex(value: Uint8Array): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    Uint8Array.from(value).buffer,
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export async function fetchZkArtifactManifest(
  baseUrl: string,
  expectedFingerprint = "",
  fetchFunction: typeof fetch = globalThis.fetch,
): Promise<AptorZkArtifactManifest> {
  const root = stripTrailingSlash(baseUrl);
  const response = await fetchFunction(`${root}/manifest.json`, {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new AptorError(
      "MISSING_ZK_ARTIFACTS",
      "Aptor's proof artifact manifest is unavailable.",
    );
  }
  const manifest = parseManifest(await response.json());
  if (
    expectedFingerprint.length > 0 &&
    manifest.fingerprint !== expectedFingerprint.toLowerCase()
  ) {
    throw new AptorError(
      "ARTIFACT_MISMATCH",
      "The hosted proof artifacts do not match the configured contract release fingerprint.",
    );
  }
  return manifest;
}

export async function validateZkArtifactManifest(
  baseUrl: string,
  expectedFingerprint = "",
  fetchFunction: typeof fetch = globalThis.fetch,
): Promise<AptorZkArtifactManifest> {
  const root = stripTrailingSlash(baseUrl);
  const manifest = await fetchZkArtifactManifest(
    root,
    expectedFingerprint,
    fetchFunction,
  );
  const files = APTOR_CIRCUITS.flatMap((circuit) => [
    `keys/${circuit}.prover`,
    `keys/${circuit}.verifier`,
    `zkir/${circuit}.bzkir`,
  ]);
  for (const file of files) {
    if (manifest.artifacts[file] === undefined) {
      throw new AptorError(
        "ARTIFACT_MISMATCH",
        `The release manifest does not include ${file}.`,
      );
    }
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
  return manifest;
}
