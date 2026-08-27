import { rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const repositoryRoot = resolve(import.meta.dirname, "../../..");
const database = resolve(
  repositoryRoot,
  ".midnight/browser-e2e/hsk-delivery.sqlite",
);
await Promise.all([
  rm(database, { force: true }),
  rm(`${database}-shm`, { force: true }),
  rm(`${database}-wal`, { force: true }),
]);
const result = spawnSync("npm", ["run", "build", "--workspace", "@aptor/web"], {
  cwd: repositoryRoot,
  env: {
    ...process.env,
    APTOR_NEXT_DIST_DIR: ".next-hsk-playwright",
    NEXT_PUBLIC_APTOR_CHAIN_MODE: "hsk",
    NEXT_PUBLIC_HSK_CHAIN_ID: "31337",
    NEXT_PUBLIC_HSK_RPC_URL: "http://127.0.0.1:8545",
    NEXT_PUBLIC_HSK_CREDENTIAL_REGISTRY_ADDRESS:
      "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
    NEXT_PUBLIC_HSK_PROOF_REQUESTS_ADDRESS:
      "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0",
  },
  stdio: "inherit",
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
