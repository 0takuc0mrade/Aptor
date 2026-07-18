import assert from "node:assert/strict";
import test from "node:test";

import { AptorFetchZkConfigProvider } from "../src/index.js";

test("browser ZK fetches retain the global fetch receiver", async () => {
  let receiver: unknown;
  const fetchStub = function (this: unknown): Promise<Response> {
    receiver = this;
    return Promise.resolve(
      new Response(new Uint8Array([1, 2, 3]), { status: 200 }),
    );
  } as typeof fetch;
  const provider = new AptorFetchZkConfigProvider("/zk/aptor", fetchStub);

  await provider.getVerifierKey("createProofRequest");

  assert.equal(receiver, globalThis);
});
