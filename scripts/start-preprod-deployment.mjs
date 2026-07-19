import { spawn } from "node:child_process";
import { once } from "node:events";
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const repositoryRoot = process.cwd();
const manifestPath = path.join(
  repositoryRoot,
  "apps/web/public/zk/aptor/manifest.json",
);
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

if (!/^[a-f0-9]{64}$/u.test(manifest.fingerprint ?? "")) {
  throw new Error(
    "The staged Aptor ZK manifest does not contain a valid SHA-256 fingerprint.",
  );
}

const environment = {
  ...process.env,
  NEXT_PUBLIC_APTOR_NETWORK: "preprod",
  NEXT_PUBLIC_APTOR_CONTRACT_ADDRESS: "",
  NEXT_PUBLIC_APTOR_RPC_URL: "https://rpc.preprod.midnight.network",
  NEXT_PUBLIC_APTOR_INDEXER_URL:
    "https://indexer.preprod.midnight.network/api/v4/graphql",
  NEXT_PUBLIC_APTOR_INDEXER_WS_URL:
    "wss://indexer.preprod.midnight.network/api/v4/graphql/ws",
  NEXT_PUBLIC_APTOR_EXPLORER_URL: "https://preprod.midnightexplorer.com",
  NEXT_PUBLIC_APTOR_1AM_EXPLORER_URL:
    "https://explorer.1am.xyz/?network=preprod",
  NEXT_PUBLIC_APTOR_ZK_ARTIFACTS_URL: "/zk/aptor",
  NEXT_PUBLIC_APTOR_ARTIFACT_FINGERPRINT: manifest.fingerprint,
  NEXT_PUBLIC_APTOR_ENABLE_PREPROD_DEPLOYMENT: "true",
  APTOR_DELIVERY_DB_PATH: path.join(
    repositoryRoot,
    ".aptor-delivery/aptor-preprod.sqlite",
  ),
};

const nextBin = path.join(repositoryRoot, "node_modules/next/dist/bin/next");
const webDirectory = path.join(repositoryRoot, "apps/web");
let child = spawn(process.execPath, [nextBin, "build"], {
  cwd: webDirectory,
  env: environment,
  stdio: "inherit",
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}

const [buildCode, buildSignal] = await once(child, "exit");
if (buildCode !== 0) {
  throw new Error(
    buildSignal
      ? `Aptor's local Preprod build stopped by ${buildSignal}.`
      : `Aptor's local Preprod build exited with code ${buildCode}.`,
  );
}

child = spawn(
  process.execPath,
  [nextBin, "start", "--hostname", "127.0.0.1", "--port", "3000"],
  {
    cwd: webDirectory,
    env: environment,
    stdio: "inherit",
  },
);

const [serverCode, serverSignal] = await once(child, "exit");
if (serverSignal) {
  console.error(`Aptor Preprod server stopped by ${serverSignal}.`);
}
process.exitCode = serverCode ?? (serverSignal === "SIGINT" ? 130 : 1);
