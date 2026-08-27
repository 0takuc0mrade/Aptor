import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { createExecutionPlan, detectPackageManager, inspectExecutionOptions, publicExecutionPlan } from "./planner";
import { dockerPolicyArguments, validateExecutionPlan, validateScriptName } from "./policy";

async function repository(manifest: object, files: Record<string, string> = {}) {
  const root = await mkdtemp(path.join(tmpdir(), "cordon-planner-test-"));
  await writeFile(path.join(root, "package.json"), JSON.stringify(manifest));
  for (const [name, content] of Object.entries(files)) await writeFile(path.join(root, name), content);
  return root;
}

test("planner detects manager, lifecycle hooks, and allowlisted scripts", async () => {
  const root = await repository({ scripts: { postinstall: "node setup.js", inspect: "node inspect.js" } }, { "package-lock.json": "{}" });
  try {
    const options = await inspectExecutionOptions(root);
    assert.equal(options.packageManager, "npm");
    assert.deepEqual(options.lifecycleScripts, [{ name: "postinstall", command: "node setup.js" }]);
    const plan = await createExecutionPlan({ scanId: crypto.randomUUID(), repositoryRoot: root, repositoryLocator: `managed://scan/${crypto.randomUUID()}/commit`, mode: "script", scriptName: "inspect" });
    assert.deepEqual(plan.command, ["npm", "run", "inspect", "--"]);
    assert.equal(publicExecutionPlan(plan).canaries.some((canary) => "marker" in canary), false);
    assert.equal("repositoryPath" in publicExecutionPlan(plan), false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("planner rejects command injection, unknown scripts, and ambiguous managers", async () => {
  assert.throws(() => validateScriptName("build; curl example.invalid"), /unsupported shell/i);
  const root = await repository({ scripts: { build: "node build.js" } }, { "package-lock.json": "{}", "yarn.lock": "" });
  try {
    await assert.rejects(() => detectPackageManager(root), /multiple package-manager/i);
    await assert.rejects(() => createExecutionPlan({ scanId: crypto.randomUUID(), repositoryRoot: root, repositoryLocator: `managed://scan/${crypto.randomUUID()}/commit`, mode: "script", scriptName: "missing" }), /multiple package-manager|not present/i);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("execution-plan validation and Docker policy enforce fixed resource controls", async () => {
  const root = await repository({ scripts: {} });
  try {
    const plan = await createExecutionPlan({ scanId: crypto.randomUUID(), repositoryRoot: root, repositoryLocator: `managed://scan/${crypto.randomUUID()}/commit`, mode: "probe" });
    validateExecutionPlan(plan);
    const args = dockerPolicyArguments(plan, "cordon-test");
    assert.deepEqual(args.slice(0, 3), ["create", "--name", "cordon-test"]);
    assert.ok(args.includes("--read-only"));
    assert.ok(args.includes("--cap-drop"));
    assert.ok(args.includes("no-new-privileges:true"));
    assert.ok(args.includes("--pids-limit"));
    assert.ok(args.includes("none"));
    assert.equal(args.includes("--privileged"), false);
    assert.equal(args.includes("--network=host"), false);
    assert.equal(args.includes("--volume"), false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("allowlist mode is install-only and requires operator enforcement", async () => {
  const root = await repository({ scripts: {} });
  const previous = {
    network: process.env.CORDON_QUARANTINE_NETWORK,
    proxy: process.env.CORDON_REGISTRY_PROXY_URL,
    enforced: process.env.CORDON_QUARANTINE_ALLOWLIST_ENFORCED,
  };
  try {
    const plan = await createExecutionPlan({ scanId: crypto.randomUUID(), repositoryRoot: root, repositoryLocator: `managed://scan/${crypto.randomUUID()}/commit`, mode: "install", networkPolicy: "allowlist" });
    assert.throws(() => dockerPolicyArguments(plan, "cordon-test"), /operator-enforced/i);
    process.env.CORDON_QUARANTINE_NETWORK = "cordon-registry";
    process.env.CORDON_REGISTRY_PROXY_URL = "http://registry-proxy:8080";
    process.env.CORDON_QUARANTINE_ALLOWLIST_ENFORCED = "1";
    const args = dockerPolicyArguments(plan, "cordon-test");
    assert.equal(args[args.indexOf("--network") + 1], "cordon-registry");
    assert.ok(args.includes("HTTPS_PROXY=http://registry-proxy:8080"));
  } finally {
    if (previous.network === undefined) delete process.env.CORDON_QUARANTINE_NETWORK; else process.env.CORDON_QUARANTINE_NETWORK = previous.network;
    if (previous.proxy === undefined) delete process.env.CORDON_REGISTRY_PROXY_URL; else process.env.CORDON_REGISTRY_PROXY_URL = previous.proxy;
    if (previous.enforced === undefined) delete process.env.CORDON_QUARANTINE_ALLOWLIST_ENFORCED; else process.env.CORDON_QUARANTINE_ALLOWLIST_ENFORCED = previous.enforced;
    await rm(root, { recursive: true, force: true });
  }
});
