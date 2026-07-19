import assert from "node:assert/strict";
import test from "node:test";

import { EphemeralPrivateStateProvider } from "../src/index.js";

test("proof-scoped private state is contract-scoped and clears completely", async () => {
  const provider = new EphemeralPrivateStateProvider<
    "state",
    { secret: string }
  >();
  provider.setContractAddress("contract-a");
  await provider.set("state", { secret: "first" });
  assert.deepEqual(await provider.get("state"), { secret: "first" });

  provider.setContractAddress("contract-b");
  assert.equal(await provider.get("state"), null);
  await provider.set("state", { secret: "second" });
  await provider.clear();
  assert.equal(await provider.get("state"), null);

  await assert.rejects(provider.exportPrivateStates());
  await provider.dispose();
});

test("deployment private state is scoped once the contract address exists", async () => {
  const provider = new EphemeralPrivateStateProvider<
    "state",
    { secret: string }
  >();
  await provider.set("state", { secret: "deployment-only" });
  assert.deepEqual(await provider.get("state"), {
    secret: "deployment-only",
  });
  provider.setContractAddress("deployed-contract");
  assert.deepEqual(await provider.get("state"), {
    secret: "deployment-only",
  });
  await provider.dispose();
});
