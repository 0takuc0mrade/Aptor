import { resolve } from "node:path";

import { defineConfig, devices } from "@playwright/test";

const repositoryRoot = resolve(import.meta.dirname, "../..");

export default defineConfig({
  testDir: "./e2e",
  testMatch: "hsk-anvil-flow.spec.ts",
  workers: 1,
  timeout: 300_000,
  expect: { timeout: 20_000 },
  outputDir: resolve(repositoryRoot, ".midnight/browser-e2e/hsk-results"),
  reporter: [["line"]],
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://127.0.0.1:3200",
    channel: "chrome",
    headless: true,
    actionTimeout: 30_000,
    navigationTimeout: 60_000,
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run start:e2e:hsk --workspace @aptor/web",
    cwd: repositoryRoot,
    env: {
      ...process.env,
      APTOR_NEXT_DIST_DIR: ".next-hsk-playwright",
      APTOR_DELIVERY_DB_PATH: resolve(
        repositoryRoot,
        ".midnight/browser-e2e/hsk-delivery.sqlite",
      ),
    },
    reuseExistingServer: false,
    timeout: 180_000,
    url: "http://127.0.0.1:3200",
  },
});
