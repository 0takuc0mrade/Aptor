import { once } from "node:events";
import { rm } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";

const repositoryRoot = process.cwd();
const port = 3101;
const baseUrl = `http://127.0.0.1:${port}`;
const databasePath = path.join(
  "/tmp",
  `aptor-production-smoke-${process.pid}.sqlite`,
);
const configuredContractAddress =
  process.env.NEXT_PUBLIC_APTOR_CONTRACT_ADDRESS?.trim() ?? "";
let output = "";

function appendOutput(chunk) {
  output = `${output}${chunk.toString()}`.slice(-12_000);
}

const server = spawn("npm", ["run", "start:production"], {
  cwd: repositoryRoot,
  detached: process.platform !== "win32",
  env: {
    ...process.env,
    PORT: String(port),
    APTOR_DELIVERY_DB_PATH: databasePath,
    APTOR_PUBLIC_URL: "https://aptor.example",
  },
  stdio: ["ignore", "pipe", "pipe"],
});
server.stdout.on("data", appendOutput);
server.stderr.on("data", appendOutput);

async function request(pathname, init = {}) {
  return fetch(`${baseUrl}${pathname}`, {
    ...init,
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });
}

async function waitForServer() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (server.exitCode !== null) {
      throw new Error(`Aptor exited before becoming ready.\n${output}`);
    }
    try {
      const response = await request("/api/health");
      if (response.ok) return;
    } catch {
      // The process may still be migrating or binding its listener.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Aptor did not become ready.\n${output}`);
}

async function expectStatus(pathname, expected) {
  const response = await request(pathname);
  if (response.status !== expected) {
    throw new Error(
      `${pathname} returned ${response.status}; expected ${expected}.`,
    );
  }
  console.info(`${pathname} ${response.status}`);
  return response;
}

async function stopServer() {
  const stopped = () => server.exitCode !== null || server.signalCode !== null;
  if (stopped()) return;
  if (process.platform === "win32") {
    server.kill("SIGTERM");
  } else {
    process.kill(-server.pid, "SIGTERM");
  }
  await Promise.race([
    once(server, "exit"),
    new Promise((resolve) => setTimeout(resolve, 5_000)),
  ]);
  if (!stopped()) {
    if (process.platform === "win32") {
      server.kill("SIGKILL");
    } else {
      process.kill(-server.pid, "SIGKILL");
    }
    await once(server, "exit");
  }
}

try {
  await waitForServer();
  for (const pathname of ["/", "/issuer", "/professional", "/verifier"]) {
    await expectStatus(pathname, 200);
  }
  await expectStatus("/release/preprod", 404);

  const health = await (await expectStatus("/api/health", 200)).json();
  if (
    health.status !== "ok" ||
    health.delivery?.writable !== true ||
    health.delivery?.schemaVersion !== 1
  ) {
    throw new Error("The production health payload is not writable schema v1.");
  }
  await expectStatus("/api/delivery/health", 200);
  await expectStatus("/api/release/preflight?mode=deployment", 404);

  const preflight = await expectStatus(
    "/api/release/preflight",
    configuredContractAddress.length > 0 ? 200 : 503,
  );
  const preflightBody = await preflight.json();
  const failedChecks = preflightBody.checks?.filter(
    (check) => check.status === "fail",
  );
  if (configuredContractAddress.length > 0) {
    if (preflightBody.ready !== true || failedChecks?.length !== 0) {
      throw new Error(
        "The configured Preprod contract did not pass production preflight.",
      );
    }
  } else if (
    preflightBody.ready !== false ||
    failedChecks?.length !== 1 ||
    failedChecks[0]?.id !== "contract"
  ) {
    throw new Error(
      "The placeholder-address preflight did not fail only the contract query.",
    );
  }

  const manifest = await expectStatus("/zk/aptor/manifest.json", 200);
  if (!manifest.headers.get("content-type")?.startsWith("application/json")) {
    throw new Error("The Aptor artifact manifest has the wrong content type.");
  }

  const prover = await expectStatus(
    "/zk/aptor/keys/createProofRequest.prover",
    200,
  );
  if (prover.headers.get("content-type") !== "application/octet-stream") {
    throw new Error("The Aptor prover artifact has the wrong content type.");
  }
  if (!prover.headers.get("cache-control")?.includes("immutable")) {
    throw new Error(
      "The fingerprinted Aptor prover artifact is not immutable.",
    );
  }

  console.info(
    configuredContractAddress.length > 0
      ? "Aptor production smoke passed with the deployment gate disabled and the deployed Preprod contract queryable."
      : "Aptor production smoke passed with the deployment gate disabled and only the placeholder contract check failing.",
  );
} finally {
  await stopServer();
  await Promise.all(
    [databasePath, `${databasePath}-shm`, `${databasePath}-wal`].map((file) =>
      rm(file, { force: true }),
    ),
  );
}
