import { access, copyFile, mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(scriptDirectory, "..");
const sourceRoot = path.resolve(
  appRoot,
  "../../contracts/aptor-credential/generated/aptor",
);
const destinationRoot = path.resolve(appRoot, "public/zk/aptor");
const files = [
  "keys/createProofRequest.prover",
  "keys/createProofRequest.verifier",
  "keys/proveAgainstRequest.prover",
  "keys/proveAgainstRequest.verifier",
  "zkir/createProofRequest.bzkir",
  "zkir/proveAgainstRequest.bzkir",
];

for (const file of files) {
  const source = path.join(sourceRoot, file);
  await access(source);
  const fileStat = await stat(source);
  if (!fileStat.isFile() || fileStat.size === 0) {
    throw new Error(`Invalid Aptor ZK artifact: ${source}`);
  }
  const destination = path.join(destinationRoot, file);
  await mkdir(path.dirname(destination), { recursive: true });
  await copyFile(source, destination);
}

console.log(`Validated and staged ${files.length} Aptor ZK artifacts.`);
