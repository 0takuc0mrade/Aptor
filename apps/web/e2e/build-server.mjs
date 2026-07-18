import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const webDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = resolve(webDirectory, "../..");
const deployment = JSON.parse(
  readFileSync(
    resolve(repositoryRoot, ".midnight/browser-e2e/deployment.json"),
    "utf8",
  ),
);

const result = spawnSync("npm", ["run", "build", "--workspace", "@aptor/web"], {
  cwd: repositoryRoot,
  env: {
    ...process.env,
    APTOR_NEXT_DIST_DIR: ".next-playwright",
    NEXT_PUBLIC_APTOR_NETWORK: deployment.network,
    NEXT_PUBLIC_APTOR_CONTRACT_ADDRESS: deployment.contractAddress,
    NEXT_PUBLIC_APTOR_INDEXER_URL: deployment.indexerUrl,
    NEXT_PUBLIC_APTOR_INDEXER_WS_URL: deployment.indexerWsUrl,
    NEXT_PUBLIC_APTOR_ZK_ARTIFACTS_URL: "/zk/aptor",
  },
  stdio: "inherit",
});

if (result.error) {
  throw result.error;
}
if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
