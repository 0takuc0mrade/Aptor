import { createHash } from "node:crypto";
import {
  access,
  copyFile,
  mkdir,
  readFile,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(scriptDirectory, "..");
const sourceRoot = path.resolve(
  appRoot,
  "../../contracts/aptor-credential/generated/aptor",
);
const destinationRoot = path.resolve(appRoot, "public/zk/aptor");
const artifactFiles = [
  "keys/createProofRequest.prover",
  "keys/createProofRequest.verifier",
  "keys/proveAgainstRequest.prover",
  "keys/proveAgainstRequest.verifier",
  "zkir/createProofRequest.bzkir",
  "zkir/proveAgainstRequest.bzkir",
];
const sourceFiles = [
  "src/aptor.compact",
  "src/schnorr.compact",
  "generated/aptor/compiler/contract-info.json",
  "generated/aptor/contract/index.js",
];

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

const artifactHashes = {};
for (const file of artifactFiles) {
  const source = path.join(sourceRoot, file);
  await access(source);
  const fileStat = await stat(source);
  if (!fileStat.isFile() || fileStat.size === 0) {
    throw new Error(`Invalid Aptor ZK artifact: ${source}`);
  }
  const destination = path.join(destinationRoot, file);
  await mkdir(path.dirname(destination), { recursive: true });
  await copyFile(source, destination);
  artifactHashes[file] = sha256(await readFile(source));
}

const contractRoot = path.resolve(appRoot, "../../contracts/aptor-credential");
const sourceHashes = {};
for (const file of sourceFiles) {
  sourceHashes[file] = sha256(await readFile(path.join(contractRoot, file)));
}
const contractInfo = JSON.parse(
  await readFile(
    path.join(contractRoot, "generated/aptor/compiler/contract-info.json"),
    "utf8",
  ),
);
const fingerprintInput = {
  contractName: "AptorCredential",
  compilerVersion: contractInfo["compiler-version"],
  languageVersion: contractInfo["language-version"],
  runtimeVersion: contractInfo["runtime-version"],
  sources: sourceHashes,
  artifacts: artifactHashes,
};
const manifest = {
  schemaVersion: 1,
  ...fingerprintInput,
  fingerprint: sha256(JSON.stringify(fingerprintInput)),
};
await writeFile(
  path.join(destinationRoot, "manifest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
  "utf8",
);

console.log(
  `Validated and staged ${artifactFiles.length} Aptor ZK artifacts (${manifest.fingerprint}).`,
);
