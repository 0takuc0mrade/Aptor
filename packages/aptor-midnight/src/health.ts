import { connect } from "node:net";
import { localMidnightConfig } from "./config.js";

function waitForTcp(url: URL, timeoutMs = 5_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = connect(
      {
        host: url.hostname,
        port: Number(url.port),
      },
      () => {
        socket.end();
        resolve();
      },
    );

    socket.setTimeout(timeoutMs);
    socket.once("timeout", () => {
      socket.destroy();
      reject(new Error(`Timed out connecting to ${url.origin}`));
    });
    socket.once("error", reject);
  });
}

export async function assertLocalNetworkHealthy(): Promise<void> {
  const config = localMidnightConfig();
  const nodeResponse = await fetch(`${config.node}/health`);
  if (!nodeResponse.ok) {
    throw new Error(`Midnight node health returned ${nodeResponse.status}`);
  }

  const indexerResponse = await fetch(config.indexer, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query: "{ __typename }" }),
  });
  if (!indexerResponse.ok) {
    throw new Error(
      `Midnight indexer health returned ${indexerResponse.status}`,
    );
  }

  await waitForTcp(new URL(config.proofServer));
  console.info("Midnight node healthy");
  console.info("Midnight indexer healthy");
  console.info("Proof server healthy");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  assertLocalNetworkHealthy().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
