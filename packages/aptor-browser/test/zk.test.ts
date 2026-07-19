import assert from "node:assert/strict";
import test from "node:test";

import { AptorFetchZkConfigProvider } from "../src/index.js";

const bytes = new Uint8Array([1, 2, 3]);
const bytesHash =
  "039058c6f2c0cb492c533b0a4d14ef77cc0f78abccced5287d84a1a2011cfb81";

test("browser ZK fetches retain the global fetch receiver", async () => {
  let receiver: unknown;
  const fetchStub = function (
    this: unknown,
    input: URL | RequestInfo,
  ): Promise<Response> {
    receiver = this;
    if (String(input).endsWith("/manifest.json")) {
      return Promise.resolve(
        Response.json({
          schemaVersion: 1,
          contractName: "AptorCredential",
          compilerVersion: "0.31.1",
          languageVersion: "0.23.0",
          runtimeVersion: "0.16.0",
          sources: { "src/aptor.compact": "0".repeat(64) },
          artifacts: {
            "keys/createProofRequest.verifier": bytesHash,
          },
          fingerprint: "1".repeat(64),
        }),
      );
    }
    return Promise.resolve(new Response(bytes, { status: 200 }));
  } as typeof fetch;
  const provider = new AptorFetchZkConfigProvider("/zk/aptor", "", fetchStub);

  await provider.getVerifierKey("createProofRequest");

  assert.equal(receiver, globalThis);
});
