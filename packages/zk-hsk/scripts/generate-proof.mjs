import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";
import * as snarkjs from "snarkjs";

const workspace = resolve(import.meta.dirname, "..");
const inputPath = resolve(
  process.argv[2] ?? resolve(workspace, "inputs/valid.json"),
);
const outputDir = resolve(
  process.argv[3] ?? resolve(workspace, "proofs/latest"),
);
const input = JSON.parse(await readFile(inputPath, "utf8"));
const wasm = resolve(
  workspace,
  "build/ExperienceThreshold_js/ExperienceThreshold.wasm",
);
const zkey = resolve(workspace, "build/canary_final.zkey");

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
await writeFile(
  resolve(outputDir, "proof.json"),
  `${JSON.stringify(proof, null, 2)}\n`,
);
await writeFile(
  resolve(outputDir, "public.json"),
  `${JSON.stringify(publicSignals, null, 2)}\n`,
);
await writeFile(resolve(outputDir, "calldata.txt"), `${calldata}\n`);
const solidityArgs = [
  `[${proof.pi_a[0]},${proof.pi_a[1]}]`,
  `[[${proof.pi_b[0][1]},${proof.pi_b[0][0]}],[${proof.pi_b[1][1]},${proof.pi_b[1][0]}]]`,
  `[${proof.pi_c[0]},${proof.pi_c[1]}]`,
  `[${publicSignals.join(",")}]`,
];
await writeFile(
  resolve(outputDir, "solidity-args.txt"),
  `${solidityArgs.join("\n")}\n`,
);
process.stdout.write(`${JSON.stringify({ outputDir, publicSignals })}\n`);
process.exit(0);
