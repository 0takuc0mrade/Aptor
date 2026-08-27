#!/usr/bin/env node

import { randomBytes } from "node:crypto";
import { resolve } from "node:path";
import process from "node:process";
import { buildPoseidon } from "circomlibjs";
import { groth16 } from "snarkjs";
import { createPublicClient, createWalletClient, getAddress, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { encodeSkill } from "../../../packages/zk-hsk/scripts/encode-skill.mjs";

const rpcUrl = process.env.HSK_RPC_URL ?? "http://127.0.0.1:8545";
const registryAddress = getAddress(
  process.env.HSK_CREDENTIAL_REGISTRY_ADDRESS ??
    "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
);
const requestsAddress = getAddress(
  process.env.HSK_PROOF_REQUESTS_ADDRESS ??
    "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0",
);
const admin = privateKeyToAccount(
  process.env.HSK_ADMIN_PRIVATE_KEY ??
    "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
);
const issuer = privateKeyToAccount(
  process.env.HSK_ISSUER_PRIVATE_KEY ??
    "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
);
const verifier = privateKeyToAccount(
  process.env.HSK_VERIFIER_PRIVATE_KEY ??
    "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
);
const professional = privateKeyToAccount(
  process.env.HSK_PROFESSIONAL_PRIVATE_KEY ??
    "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6",
);

const registryAbi = [
  {
    type: "function",
    name: "setIssuerApproval",
    stateMutability: "nonpayable",
    inputs: [
      { name: "issuer", type: "address" },
      { name: "approved", type: "bool" },
    ],
    outputs: [],
  },
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
];
const requestsAbi = [
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
];

const transport = http(rpcUrl);
const publicClient = createPublicClient({ transport });
const wallet = (account) => createWalletClient({ account, transport });
const wait = async (hash) => {
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success")
    throw new Error(`Transaction reverted: ${hash}`);
  return receipt;
};

const skill = encodeSkill("TypeScript").field;
const experienceMonths = 36n;
const productionExperience = 1n;
const ratingHundredths = 470n;
const credentialSecret = BigInt(`0x${randomBytes(31).toString("hex")}`) || 1n;
const requestId = BigInt(Date.now());
const minimumMonths = 24n;
const requiresProduction = 1n;
const minimumRatingHundredths = 400n;

const poseidon = await buildPoseidon();
const credentialCommitment = poseidon.F.toObject(
  poseidon([
    skill,
    experienceMonths,
    productionExperience,
    ratingHundredths,
    credentialSecret,
  ]),
);

await wait(
  await wallet(admin).writeContract({
    address: registryAddress,
    abi: registryAbi,
    functionName: "setIssuerApproval",
    args: [issuer.address, true],
  }),
);
const credentialTx = await wallet(issuer).writeContract({
  address: registryAddress,
  abi: registryAbi,
  functionName: "registerCredential",
  args: [credentialCommitment],
});
await wait(credentialTx);

const requestTx = await wallet(verifier).writeContract({
  address: requestsAddress,
  abi: requestsAbi,
  functionName: "createRequest",
  args: [requestId, skill, minimumMonths, true, minimumRatingHundredths],
});
await wait(requestTx);

const witness = {
  skillHash: skill.toString(),
  experienceMonths: experienceMonths.toString(),
  productionExperience: productionExperience.toString(),
  ratingHundredths: ratingHundredths.toString(),
  credentialSecret: credentialSecret.toString(),
  requiredSkillHash: skill.toString(),
  minimumMonths: minimumMonths.toString(),
  requiresProduction: requiresProduction.toString(),
  minimumRatingHundredths: minimumRatingHundredths.toString(),
  requestId: requestId.toString(),
};
const workspace = resolve(import.meta.dirname, "../../..");
const { proof, publicSignals } = await groth16.fullProve(
  witness,
  resolve(
    workspace,
    "packages/zk-hsk/build/aptor/AptorCredential_js/AptorCredential.wasm",
  ),
  resolve(workspace, "packages/zk-hsk/build/aptor/aptor_final.zkey"),
);
const signals = publicSignals.map(BigInt);
const expected = [
  credentialCommitment,
  signals[1],
  skill,
  minimumMonths,
  requiresProduction,
  minimumRatingHundredths,
  requestId,
];
if (
  signals.length !== 7 ||
  expected.some((value, index) => signals[index] !== value)
) {
  throw new Error(
    "Groth16 public signals do not match the registered request.",
  );
}

const fulfillmentTx = await wallet(professional).writeContract({
  address: requestsAddress,
  abi: requestsAbi,
  functionName: "fulfillRequest",
  args: [
    requestId,
    signals[0],
    signals[1],
    [BigInt(proof.pi_a[0]), BigInt(proof.pi_a[1])],
    [
      [BigInt(proof.pi_b[0][1]), BigInt(proof.pi_b[0][0])],
      [BigInt(proof.pi_b[1][1]), BigInt(proof.pi_b[1][0])],
    ],
    [BigInt(proof.pi_c[0]), BigInt(proof.pi_c[1])],
  ],
});
const fulfillmentReceipt = await wait(fulfillmentTx);
const [requestState, credentialValid] = await Promise.all([
  publicClient.readContract({
    address: requestsAddress,
    abi: requestsAbi,
    functionName: "requests",
    args: [requestId],
  }),
  publicClient.readContract({
    address: registryAddress,
    abi: registryAbi,
    functionName: "isCredentialValid",
    args: [credentialCommitment],
  }),
]);
if (!requestState[5] || !requestState[6] || !credentialValid) {
  throw new Error(
    "Anvil state did not finalize the credential and request flow.",
  );
}

process.stdout.write(
  `${JSON.stringify(
    {
      chainId: await publicClient.getChainId(),
      registryAddress,
      requestsAddress,
      issuer: issuer.address,
      verifier: verifier.address,
      professional: professional.address,
      credentialTransaction: credentialTx,
      requestTransaction: requestTx,
      fulfillmentTransaction: fulfillmentTx,
      fulfillmentBlock: fulfillmentReceipt.blockNumber.toString(),
      publicSignalCount: signals.length,
      credentialValid,
      requestFulfilled: requestState[6],
    },
    null,
    2,
  )}\n`,
);
