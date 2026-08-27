import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { expect, test, type Page } from "@playwright/test";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const repositoryRoot = resolve(import.meta.dirname, "../../..");
const rpcUrl = "http://127.0.0.1:8545";
const registry = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
const issuerAddress = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
const verifierAddress = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC";
const professionalAddress = "0x90F79bf6EB2c4f870365E785982E1f101E93b906";
const vaultPassword = "Aptor HSK browser vault 2026!";

async function installAnvilWallet(page: Page, address: string): Promise<void> {
  await page.exposeFunction(
    "__aptorAnvilRpc",
    async (input: { method: string; params?: unknown[] }) => {
      if (
        input.method === "eth_accounts" ||
        input.method === "eth_requestAccounts"
      ) {
        return [address];
      }
      if (input.method === "eth_chainId") return "0x7a69";
      if (
        input.method === "wallet_switchEthereumChain" ||
        input.method === "wallet_addEthereumChain"
      ) {
        return null;
      }
      const response = await fetch(rpcUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: Date.now(),
          method: input.method,
          params: input.params ?? [],
        }),
      });
      const payload = (await response.json()) as {
        result?: unknown;
        error?: { code: number; message: string };
      };
      if (payload.error) {
        const error = new Error(payload.error.message) as Error & {
          code: number;
        };
        error.code = payload.error.code;
        throw error;
      }
      return payload.result;
    },
  );
  await page.addInitScript(() => {
    const browserWindow = window as unknown as {
      __aptorAnvilRpc: (input: {
        method: string;
        params?: unknown[];
      }) => Promise<unknown>;
      ethereum: { request: (input: unknown) => Promise<unknown> };
    };
    browserWindow.ethereum = {
      request: (input) =>
        browserWindow.__aptorAnvilRpc(
          input as { method: string; params?: unknown[] },
        ),
    };
  });
}

async function createProfile(
  page: Page,
  handle: string,
  displayName: string,
): Promise<void> {
  await page.getByLabel("Aptor handle").fill(handle);
  await page.getByLabel("Display name").fill(displayName);
  await page
    .getByLabel("Profile vault password", { exact: true })
    .fill(vaultPassword);
  await page
    .getByLabel("Confirm password", { exact: true })
    .fill(vaultPassword);
  await page.getByRole("button", { name: "Create Aptor profile" }).click();
}

test.beforeAll(async () => {
  const admin = privateKeyToAccount(
    "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
  );
  const publicClient = createPublicClient({ transport: http(rpcUrl) });
  const wallet = createWalletClient({
    account: admin,
    transport: http(rpcUrl),
  });
  const hash = await wallet.writeContract({
    chain: null,
    address: registry,
    abi: [
      {
        type: "function",
        name: "setIssuerApproval",
        stateMutability: "nonpayable",
        inputs: [
          { name: "issuer", type: "address" },
          { name: "approved", type: "bool" },
        ],
        outputs: [],
      },
    ],
    functionName: "setIssuerApproval",
    args: [issuerAddress, true],
  });
  await publicClient.waitForTransactionReceipt({ hash });
});

test("three browser profiles complete the real Aptor HSK flow on Anvil", async ({
  browser,
}) => {
  const professionalContext = await browser.newContext();
  const issuerContext = await browser.newContext();
  const verifierContext = await browser.newContext();
  const professional = await professionalContext.newPage();
  const issuer = await issuerContext.newPage();
  const verifier = await verifierContext.newPage();

  const healthResponse = await professional.request.get("/api/health");
  expect(healthResponse.status()).toBe(200);
  const health = (await healthResponse.json()) as {
    status: string;
    configurationIssues: unknown[];
  };
  expect(health.status).toBe("ok");
  expect(health.configurationIssues).toEqual([]);

  await installAnvilWallet(professional, professionalAddress);
  await installAnvilWallet(issuer, issuerAddress);
  await installAnvilWallet(verifier, verifierAddress);

  const networkBodies: string[] = [];
  for (const page of [professional, issuer, verifier]) {
    page.on("request", (request) => {
      const body = request.postData();
      if (body) networkBodies.push(body);
    });
  }

  await professional.goto("/professional", { waitUntil: "networkidle" });
  await createProfile(professional, "hsk-professional", "HSK Professional");
  await professional
    .getByRole("button", { name: "Create Issuer invite" })
    .click();
  const inviteLink = await professional
    .getByLabel("Shareable invite link")
    .inputValue();

  await issuer.goto(inviteLink, { waitUntil: "networkidle" });
  await createProfile(issuer, "hsk-issuer", "HSK Issuer");
  await issuer.getByRole("button", { name: "Accept invitation" }).click();
  await issuer.waitForURL("**/issuer");
  await issuer.locator('textarea[name="skills"]').fill("TypeScript");
  await issuer.getByLabel("Duration in months", { exact: true }).fill("36");
  await issuer.locator('input[name="rating"]').fill("4.70");
  await issuer.getByLabel("Delivered to production", { exact: true }).check();
  await issuer.getByRole("button", { name: "Review credential" }).click();
  await issuer
    .getByRole("button", { name: "Register and deliver credential" })
    .click();
  await expect(
    issuer.locator(".workspace-message[role='status']"),
  ).toContainText("registered on HSK", { timeout: 60_000 });

  await expect(
    professional.getByRole("button", { name: "Verify and save" }),
  ).toBeVisible({
    timeout: 30_000,
  });
  await professional.getByRole("button", { name: "Verify and save" }).click();
  await expect(
    professional.locator(".workspace-message[role='status']"),
  ).toContainText("Credential saved");

  await verifier.goto("/verifier", { waitUntil: "networkidle" });
  await createProfile(verifier, "hsk-verifier", "HSK Verifier");
  await verifier.getByLabel("Issuer Aptor handle").fill("hsk-issuer");
  await verifier.getByRole("button", { name: "Add trusted Issuer" }).click();
  await verifier
    .getByLabel("Professional Aptor handle")
    .fill("hsk-professional");
  await verifier.getByRole("button", { name: "Select Professional" }).click();
  await verifier
    .getByLabel("Required skill", { exact: true })
    .fill("TypeScript");
  await verifier.locator('input[name="minimumDurationMonths"]').fill("24");
  await verifier
    .getByLabel("Require production delivery", { exact: true })
    .check();
  await verifier.locator('input[name="minimumRating"]').fill("4.00");
  await verifier.getByRole("button", { name: "Review public request" }).click();
  await verifier.getByRole("button", { name: "Connect wallet" }).click();
  await expect(verifier.getByText("Connected", { exact: true })).toBeVisible();
  await verifier
    .getByRole("button", { name: "Register and send request" })
    .click();
  await expect(
    verifier.locator(".workspace-message[role='status']"),
  ).toContainText("registered in HSK block", { timeout: 60_000 });

  await expect(
    professional.getByRole("button", { name: "Review request" }),
  ).toBeVisible({
    timeout: 30_000,
  });
  await professional.getByRole("button", { name: "Review request" }).click();
  await expect(
    professional.getByText("Compatible credentials: 1", { exact: true }),
  ).toBeVisible();
  await professional.getByRole("radio", { name: /Private credential/ }).check();
  await professional.getByRole("button", { name: "Connect wallet" }).click();
  await professional
    .getByRole("button", { name: "Generate and submit proof" })
    .click();
  await expect(
    professional.locator(".workspace-message[role='status']"),
  ).toContainText("Groth16 proof finalized on HSK", { timeout: 180_000 });
  await expect(professional.locator(".receipt-card")).toContainText(
    "hsk-local",
  );
  await expect(
    verifier.getByText("Request fulfilled", { exact: true }),
  ).toBeVisible({
    timeout: 60_000,
  });

  const networkText = networkBodies.join("\n");
  expect(networkText).not.toContain("credentialSecret");
  expect(networkText).not.toContain("durationMonths");
  expect(networkText).not.toContain("TypeScript");
  const database = new DatabaseSync(
    resolve(repositoryRoot, ".midnight/browser-e2e/hsk-delivery.sqlite"),
    { readOnly: true },
  );
  const envelopes = database
    .prepare("SELECT * FROM encrypted_envelopes ORDER BY created_at")
    .all();
  const tracking = database
    .prepare("SELECT public_status FROM request_tracking LIMIT 1")
    .get() as { public_status: string } | undefined;
  database.close();
  expect(envelopes).toHaveLength(2);
  expect(JSON.stringify(envelopes)).not.toContain("credentialSecret");
  expect(tracking?.public_status).toBe("fulfilled");

  await professionalContext.close();
  await issuerContext.close();
  await verifierContext.close();
});
