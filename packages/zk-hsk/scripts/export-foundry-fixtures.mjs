import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const repo = resolve(import.meta.dirname, "../../..");
const proofRoot = resolve(repo, "packages/zk-hsk/proofs/aptor");

async function loadProof(name) {
  const args = (
    await readFile(resolve(proofRoot, name, "solidity-args.txt"), "utf8")
  )
    .trim()
    .split("\n");
  const publicSignals = JSON.parse(
    await readFile(resolve(proofRoot, name, "public.json"), "utf8"),
  );
  if (args.length !== 4 || publicSignals.length !== 7)
    throw new Error(`Malformed proof fixture: ${name}`);
  return { a: args[0], b: args[1], c: args[2], publicSignals };
}

const first = await loadProof("latest");
const second = await loadProof("request-1002");
if (first.publicSignals[0] !== second.publicSignals[0])
  throw new Error("Credential commitments differ");

const source = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// Generated from real snarkjs proofs by export-foundry-fixtures.mjs.
library AptorProofFixtures {
    uint256 internal constant COMMITMENT = ${first.publicSignals[0]};
    uint256 internal constant SKILL = ${first.publicSignals[2]};
    uint256 internal constant NULLIFIER_1001 = ${first.publicSignals[1]};
    uint256 internal constant NULLIFIER_1002 = ${second.publicSignals[1]};

    function proof1001() internal pure returns (uint256[2] memory a, uint256[2][2] memory b, uint256[2] memory c) {
        a = ${first.a};
        b = ${first.b};
        c = ${first.c};
    }

    function proof1002() internal pure returns (uint256[2] memory a, uint256[2][2] memory b, uint256[2] memory c) {
        a = ${second.a};
        b = ${second.b};
        c = ${second.c};
    }
}
`;

await writeFile(
  resolve(repo, "contracts/hsk/test/AptorProofFixtures.sol"),
  source,
);
