import { localMidnightConfig } from "./config.js";

async function assertHttpServiceReachable(
  url: URL,
  timeoutMs = 5_000,
): Promise<void> {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(timeoutMs),
  });
  await response.body?.cancel();
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

  await assertHttpServiceReachable(new URL(config.proofServer));
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
