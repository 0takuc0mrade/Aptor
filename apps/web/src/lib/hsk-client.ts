import { buildPoseidon } from "circomlibjs";
import { groth16 } from "snarkjs";
import {
  type Address,
  type Hash,
  type PublicClient,
  type TransactionReceipt,
  type WalletClient,
} from "viem";
import type {
  AptorProofRequestPackageV1,
  AptorSignedCredentialV1,
} from "@aptor/browser";

import type { ConnectedHskWallet } from "@/hooks/use-hsk-wallet";
import { requireHskContracts } from "@/lib/hsk-config";

export const BN254_SCALAR_FIELD =
  21_888_242_871_839_275_222_246_405_745_257_275_088_548_364_400_416_034_343_698_204_186_575_808_495_617n;

export const HSK_CREDENTIAL_REGISTRY_ABI = [
  {
    type: "function",
    name: "registerCredential",
    stateMutability: "nonpayable",
    inputs: [{ name: "commitment", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "isCredentialValid",
    stateMutability: "view",
    inputs: [{ name: "commitment", type: "uint256" }],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

export const HSK_PROOF_REQUESTS_ABI = [
  {
    type: "function",
    name: "createRequest",
    stateMutability: "nonpayable",
    inputs: [
      { name: "requestId", type: "uint256" },
      { name: "requiredSkillHash", type: "uint256" },
      { name: "minimumMonths", type: "uint16" },
      { name: "requiresProduction", type: "bool" },
      { name: "minimumRatingHundredths", type: "uint16" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "fulfillRequest",
    stateMutability: "nonpayable",
    inputs: [
      { name: "requestId", type: "uint256" },
      { name: "credentialCommitment", type: "uint256" },
      { name: "requestNullifier", type: "uint256" },
      { name: "a", type: "uint256[2]" },
      { name: "b", type: "uint256[2][2]" },
      { name: "c", type: "uint256[2]" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "requests",
    stateMutability: "view",
    inputs: [{ name: "requestId", type: "uint256" }],
    outputs: [
      { name: "verifier", type: "address" },
      { name: "requiredSkillHash", type: "uint256" },
      { name: "minimumMonths", type: "uint16" },
      { name: "requiresProduction", type: "bool" },
      { name: "minimumRatingHundredths", type: "uint16" },
      { name: "exists", type: "bool" },
      { name: "fulfilled", type: "bool" },
    ],
  },
] as const;

type HskRequestState = Readonly<{
  verifier: Address;
  requiredSkillHash: bigint;
  minimumMonths: number;
  requiresProduction: boolean;
  minimumRatingHundredths: number;
  exists: boolean;
  fulfilled: boolean;
}>;

export type HskProofBundle = Readonly<{
  credentialCommitment: bigint;
  requestNullifier: bigint;
  a: readonly [bigint, bigint];
  b: readonly [readonly [bigint, bigint], readonly [bigint, bigint]];
  c: readonly [bigint, bigint];
  publicSignals: readonly bigint[];
}>;

let poseidonPromise: ReturnType<typeof buildPoseidon> | undefined;

function poseidon() {
  poseidonPromise ??= buildPoseidon();
  return poseidonPromise;
}

export function normalizeHskSkill(value: string): string {
  return value.normalize("NFKC").trim().toLowerCase().replace(/\s+/gu, " ");
}

export async function encodeHskSkill(value: string): Promise<bigint> {
  const input = new TextEncoder().encode(
    `aptor:skill:hsk:v1\0${normalizeHskSkill(value)}`,
  );
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", input));
  let encoded = 0n;
  for (const byte of digest) encoded = (encoded << 8n) | BigInt(byte);
  return encoded % BN254_SCALAR_FIELD;
}

export function randomHskScalar(): bigint {
  const bytes = crypto.getRandomValues(new Uint8Array(31));
  let scalar = 0n;
  for (const byte of bytes) scalar = (scalar << 8n) | BigInt(byte);
  return scalar || 1n;
}

export function hskRequestIdHex(requestId: bigint): string {
  return requestId.toString(16).padStart(64, "0");
}

export async function computeCredentialCommitment(
  input: Readonly<{
    skillHash: bigint;
    experienceMonths: number;
    productionExperience: boolean;
    ratingHundredths: number;
    credentialSecret: bigint;
  }>,
): Promise<bigint> {
  const hash = await poseidon();
  return hash.F.toObject(
    hash([
      input.skillHash,
      BigInt(input.experienceMonths),
      input.productionExperience ? 1n : 0n,
      BigInt(input.ratingHundredths),
      input.credentialSecret,
    ]),
  );
}

async function writeAndWait(
  wallet: ConnectedHskWallet,
  input: Parameters<WalletClient["writeContract"]>[0],
): Promise<{ hash: Hash; receipt: TransactionReceipt }> {
  const hash = await wallet.walletClient.writeContract(input);
  const receipt = await wallet.publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success")
    throw new Error("The HSK transaction reverted.");
  return { hash, receipt };
}

export async function registerHskCredential(
  wallet: ConnectedHskWallet,
  commitment: bigint,
) {
  const { credentialRegistry } = requireHskContracts();
  return writeAndWait(wallet, {
    account: wallet.address,
    chain: wallet.walletClient.chain,
    address: credentialRegistry,
    abi: HSK_CREDENTIAL_REGISTRY_ABI,
    functionName: "registerCredential",
    args: [commitment],
  });
}

export async function createHskProofRequest(
  wallet: ConnectedHskWallet,
  request: Readonly<{
    requestId: bigint;
    requiredSkillHash: bigint;
    minimumMonths: number;
    requiresProduction: boolean;
    minimumRatingHundredths: number;
  }>,
) {
  const { proofRequests } = requireHskContracts();
  return writeAndWait(wallet, {
    account: wallet.address,
    chain: wallet.walletClient.chain,
    address: proofRequests,
    abi: HSK_PROOF_REQUESTS_ABI,
    functionName: "createRequest",
    args: [
      request.requestId,
      request.requiredSkillHash,
      request.minimumMonths,
      request.requiresProduction,
      request.minimumRatingHundredths,
    ],
  });
}

export async function readHskRequest(
  publicClient: PublicClient,
  requestId: bigint,
): Promise<HskRequestState> {
  const { proofRequests } = requireHskContracts();
  const value = await publicClient.readContract({
    address: proofRequests,
    abi: HSK_PROOF_REQUESTS_ABI,
    functionName: "requests",
    args: [requestId],
  });
  return {
    verifier: value[0],
    requiredSkillHash: value[1],
    minimumMonths: value[2],
    requiresProduction: value[3],
    minimumRatingHundredths: value[4],
    exists: value[5],
    fulfilled: value[6],
  };
}

export async function assertHskRequestMatchesChain(
  publicClient: PublicClient,
  requestPackage: AptorProofRequestPackageV1,
): Promise<HskRequestState> {
  if (!requestPackage.hsk) throw new Error("This is not an HSK proof request.");
  if (
    (await encodeHskSkill(requestPackage.request.requiredSkill)) !==
    BigInt(requestPackage.hsk.requiredSkillHash)
  ) {
    throw new Error("The HSK skill label does not match its public field.");
  }
  const state = await readHskRequest(
    publicClient,
    BigInt(`0x${requestPackage.request.requestId}`),
  );
  const expectedVerifier = requestPackage.hsk.verifierAddress.toLowerCase();
  if (
    !state.exists ||
    state.verifier.toLowerCase() !== expectedVerifier ||
    state.requiredSkillHash !== BigInt(requestPackage.hsk.requiredSkillHash) ||
    state.minimumMonths !== requestPackage.request.minimumDurationMonths ||
    state.requiresProduction !==
      requestPackage.request.requireProductionDelivery ||
    state.minimumRatingHundredths !==
      requestPackage.request.minimumClientRatingHundredths
  ) {
    throw new Error("The encrypted request does not match HSK Chain state.");
  }
  return state;
}

export async function assertHskCredentialMatchesChain(
  publicClient: PublicClient,
  credential: AptorSignedCredentialV1,
): Promise<void> {
  if (!credential.hsk) throw new Error("This is not an HSK credential.");
  const contracts = requireHskContracts();
  if (
    credential.hsk.credentialRegistryAddress.toLowerCase() !==
    contracts.credentialRegistry.toLowerCase()
  ) {
    throw new Error("This credential targets a different HSK registry.");
  }
  const commitment = await computeCredentialCommitment({
    skillHash: await encodeHskSkill(credential.skills[0]!.display),
    experienceMonths: credential.credential.durationMonths,
    productionExperience: credential.credential.deliveredToProduction,
    ratingHundredths: credential.credential.clientRatingHundredths,
    credentialSecret: BigInt(credential.hsk.credentialSecret),
  });
  if (commitment !== BigInt(credential.hsk.credentialCommitment)) {
    throw new Error(
      "The private credential does not match its HSK commitment.",
    );
  }
  const valid = await publicClient.readContract({
    address: contracts.credentialRegistry,
    abi: HSK_CREDENTIAL_REGISTRY_ABI,
    functionName: "isCredentialValid",
    args: [commitment],
  });
  if (!valid) throw new Error("The HSK credential is unregistered or revoked.");
}

export async function generateHskProof(
  credential: AptorSignedCredentialV1,
  requestPackage: AptorProofRequestPackageV1,
): Promise<HskProofBundle> {
  if (!credential.hsk || !requestPackage.hsk) {
    throw new Error(
      "The selected credential and request must both target HSK Chain.",
    );
  }
  const skillHash = await encodeHskSkill(credential.skills[0]!.display);
  const requestId = BigInt(`0x${requestPackage.request.requestId}`);
  const requiredSkillHash = BigInt(requestPackage.hsk.requiredSkillHash);
  const input = {
    skillHash: skillHash.toString(),
    experienceMonths: credential.credential.durationMonths.toString(),
    productionExperience: credential.credential.deliveredToProduction
      ? "1"
      : "0",
    ratingHundredths: credential.credential.clientRatingHundredths.toString(),
    credentialSecret: credential.hsk.credentialSecret,
    requiredSkillHash: requiredSkillHash.toString(),
    minimumMonths: requestPackage.request.minimumDurationMonths.toString(),
    requiresProduction: requestPackage.request.requireProductionDelivery
      ? "1"
      : "0",
    minimumRatingHundredths:
      requestPackage.request.minimumClientRatingHundredths.toString(),
    requestId: requestId.toString(),
  };
  const { proof, publicSignals } = await groth16.fullProve(
    input,
    "/zk/hsk/AptorCredential.wasm",
    "/zk/hsk/aptor_final.zkey",
  );
  const signals = publicSignals.map(BigInt);
  const expected = [
    BigInt(credential.hsk.credentialCommitment),
    signals[1],
    requiredSkillHash,
    BigInt(requestPackage.request.minimumDurationMonths),
    requestPackage.request.requireProductionDelivery ? 1n : 0n,
    BigInt(requestPackage.request.minimumClientRatingHundredths),
    requestId,
  ];
  if (
    signals.length !== expected.length ||
    expected.some(
      (value, index) => value === undefined || signals[index] !== value,
    )
  ) {
    throw new Error(
      "The generated proof's public signals do not match the request.",
    );
  }
  return {
    credentialCommitment: signals[0]!,
    requestNullifier: signals[1]!,
    a: [BigInt(proof.pi_a[0]), BigInt(proof.pi_a[1])],
    b: [
      [BigInt(proof.pi_b[0][1]), BigInt(proof.pi_b[0][0])],
      [BigInt(proof.pi_b[1][1]), BigInt(proof.pi_b[1][0])],
    ],
    c: [BigInt(proof.pi_c[0]), BigInt(proof.pi_c[1])],
    publicSignals: signals,
  };
}

export async function fulfillHskRequest(
  wallet: ConnectedHskWallet,
  requestPackage: AptorProofRequestPackageV1,
  proof: HskProofBundle,
) {
  const { proofRequests } = requireHskContracts();
  return writeAndWait(wallet, {
    account: wallet.address,
    chain: wallet.walletClient.chain,
    address: proofRequests,
    abi: HSK_PROOF_REQUESTS_ABI,
    functionName: "fulfillRequest",
    args: [
      BigInt(`0x${requestPackage.request.requestId}`),
      proof.credentialCommitment,
      proof.requestNullifier,
      proof.a,
      proof.b,
      proof.c,
    ],
  });
}
