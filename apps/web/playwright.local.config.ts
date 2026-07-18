import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig, devices } from "@playwright/test";

type LocalDeployment = Readonly<{
  network: "undeployed";
  contractAddress: string;
  indexerUrl: string;
  indexerWsUrl: string;
}>;

const webDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(webDirectory, "../..");
const deployment = JSON.parse(
  readFileSync(
    resolve(repositoryRoot, ".midnight/browser-e2e/deployment.json"),
    "utf8",
  ),
) as LocalDeployment;

export default defineConfig({
  testDir: "./e2e",
  testMatch: "browser-flow.spec.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 1_800_000,
  expect: { timeout: 20_000 },
  outputDir: resolve(repositoryRoot, ".midnight/browser-e2e/results"),
  reporter: [["line"]],
  use: {
    ...devices["Desktop Chrome"],
    actionTimeout: 30_000,
    baseURL: "http://127.0.0.1:3100",
    channel: "chrome",
    headless: true,
    navigationTimeout: 60_000,
    acceptDownloads: true,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run start:e2e --workspace @aptor/web",
    cwd: repositoryRoot,
    env: {
      ...process.env,
      APTOR_NEXT_DIST_DIR: ".next-playwright",
      APTOR_DELIVERY_DB_PATH: resolve(
        repositoryRoot,
        ".midnight/browser-e2e/delivery.sqlite",
      ),
      NEXT_PUBLIC_APTOR_NETWORK: deployment.network,
      NEXT_PUBLIC_APTOR_CONTRACT_ADDRESS: deployment.contractAddress,
      NEXT_PUBLIC_APTOR_INDEXER_URL: deployment.indexerUrl,
      NEXT_PUBLIC_APTOR_INDEXER_WS_URL: deployment.indexerWsUrl,
      NEXT_PUBLIC_APTOR_ZK_ARTIFACTS_URL: "/zk/aptor",
    },
    reuseExistingServer: false,
    timeout: 180_000,
    url: "http://127.0.0.1:3100",
  },
});
