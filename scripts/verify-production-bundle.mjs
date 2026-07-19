import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";

const appRoot = path.resolve("apps/web");
const outputRoot = path.join(appRoot, ".next");
const browserOutputRoot = path.join(outputRoot, "static");
const forbiddenEndpoints = [
  "127.0.0.1:9944",
  "127.0.0.1:8088",
  "127.0.0.1:6300",
];
const findings = [];

async function filesBelow(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await filesBelow(target)));
    else files.push(target);
  }
  return files;
}

for (const file of await filesBelow(browserOutputRoot)) {
  if (file.endsWith(".map")) {
    findings.push(
      `${path.relative(appRoot, file)}: browser source map emitted`,
    );
    continue;
  }
  if (!/\.(?:html|js|json|txt)$/u.test(file)) continue;
  const value = await readFile(file, "utf8");
  for (const endpoint of forbiddenEndpoints) {
    if (value.includes(endpoint)) {
      findings.push(
        `${path.relative(appRoot, file)}: contains LocalNet endpoint ${endpoint}`,
      );
    }
  }
}

for (const artifact of [
  "public/zk/aptor/manifest.json",
  "public/zk/aptor/keys/createProofRequest.prover",
  "public/zk/aptor/keys/createProofRequest.verifier",
  "public/zk/aptor/keys/proveAgainstRequest.prover",
  "public/zk/aptor/keys/proveAgainstRequest.verifier",
  "public/zk/aptor/zkir/createProofRequest.bzkir",
  "public/zk/aptor/zkir/proveAgainstRequest.bzkir",
]) {
  const file = path.join(appRoot, artifact);
  if ((await stat(file)).size === 0) findings.push(`${artifact}: empty`);
}

if (findings.length > 0) {
  console.error("Aptor production bundle verification failed:");
  for (const finding of findings) console.error(`- ${finding}`);
  process.exitCode = 1;
} else {
  console.info(
    "Aptor production bundle contains no LocalNet URLs or browser source maps, and all release artifacts are present.",
  );
}
