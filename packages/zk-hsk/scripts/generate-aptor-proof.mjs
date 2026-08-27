import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";
import * as snarkjs from "snarkjs";

const workspace = resolve(import.meta.dirname, "..");
const inputPath = resolve(
  process.argv[2] ?? resolve(workspace, "inputs/aptor-valid.json"),
);
const outputDir = resolve(
  process.argv[3] ?? resolve(workspace, "proofs/aptor/latest"),
);
const input = JSON.parse(await readFile(inputPath, "utf8"));
const wasm = resolve(
  workspace,
  "build/aptor/AptorCredential_js/AptorCredential.wasm",
);
const zkey = resolve(workspace, "build/aptor/aptor_final.zkey");

await mkdir(outputDir, { recursive: true });
const { proof, publicSignals } = await snarkjs.groth16.fullProve(
  input,
  wasm,
  zkey,
);
const calldata = await snarkjs.groth16.exportSolidityCallData(
  proof,
  publicSignals,
);
const solidityArgs = [
  `[${proof.pi_a[0]},${proof.pi_a[1]}]`,
  `[[${proof.pi_b[0][1]},${proof.pi_b[0][0]}],[${proof.pi_b[1][1]},${proof.pi_b[1][0]}]]`,
  `[${proof.pi_c[0]},${proof.pi_c[1]}]`,
  `[${publicSignals.join(",")}]`,
];

await Promise.all([
  writeFile(
    resolve(outputDir, "proof.json"),
    `${JSON.stringify(proof, null, 2)}\n`,
  ),
  writeFile(
    resolve(outputDir, "public.json"),
    `${JSON.stringify(publicSignals, null, 2)}\n`,
  ),
  writeFile(resolve(outputDir, "calldata.txt"), `${calldata}\n`),
  writeFile(
    resolve(outputDir, "solidity-args.txt"),
    `${solidityArgs.join("\n")}\n`,
  ),
  writeFile(
    resolve(outputDir, "public-signals.txt"),
    `${publicSignals.join("\n")}\n`,
  ),
]);
process.stdout.write(`${JSON.stringify({ outputDir, publicSignals })}\n`);
process.exit(0);
