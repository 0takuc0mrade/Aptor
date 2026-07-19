import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { NodeZkConfigProvider } from "@midnight-ntwrk/midnight-js-node-zk-config-provider";
import type { ProvingProvider } from "@midnight-ntwrk/midnight-js-protocol/ledger";
import { DAppConnectorWalletAdapter } from "@midnight-ntwrk/testkit-js";
import {
  environmentConfiguration,
  localMidnightConfig,
  LocalWalletProvider,
} from "@aptor/midnight";

type BridgeRequest = Readonly<{
  method: string;
  tx?: string;
  preimage?: string;
  keyLocation?: string;
  overwriteBindingInput?: string;
  methodNames?: string[];
}>;

type Deployment = Readonly<{
  contractAddress: string;
  deploymentTransactionId: string;
  deploymentBlockHeight: number;
}>;

const directory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(directory, "../../..");
const config = localMidnightConfig();
const deployment = JSON.parse(
  await readFile(
    resolve(repositoryRoot, ".midnight/browser-e2e/deployment.json"),
    "utf8",
  ),
) as Deployment;
const vaultPassword = "Aptor professional vault 2026!";
const issuerVaultPassword = "Aptor issuer vault 2026!";
const transferPassphrase = "Separate transfer phrase 2026!";

let wallet: LocalWalletProvider;
let connector: DAppConnectorWalletAdapter;
let provingProvider: ProvingProvider;

async function installOfficialLocalConnector(page: Page): Promise<void> {
  await page.exposeFunction(
    "__aptorLocalWalletCall",
    async (value: unknown): Promise<unknown> => {
      const request = value as BridgeRequest;
      switch (request.method) {
        case "getConnectionStatus":
          return connector.getConnectionStatus();
        case "getConfiguration":
          return connector.getConfiguration();
        case "getShieldedAddresses":
          return connector.getShieldedAddresses();
        case "getUnshieldedAddress":
          return connector.getUnshieldedAddress();
        case "getDustBalance": {
          const dust = await connector.getDustBalance();
          return {
            balance: dust.balance.toString(10),
            cap: dust.cap.toString(10),
          };
        }
        case "hintUsage":
          await connector.hintUsage(
            (request.methodNames ?? []) as Parameters<
              DAppConnectorWalletAdapter["hintUsage"]
            >[0],
          );
          return null;
        case "balanceUnsealedTransaction":
          return connector.balanceUnsealedTransaction(request.tx ?? "");
        case "submitTransaction":
          await connector.submitTransaction(request.tx ?? "");
          return null;
        case "check": {
          const result = await provingProvider.check(
            Buffer.from(request.preimage ?? "", "base64"),
            request.keyLocation ?? "",
          );
          return result.map((entry) => entry?.toString(10) ?? null);
        }
        case "prove": {
          const proof = await provingProvider.prove(
            Buffer.from(request.preimage ?? "", "base64"),
            request.keyLocation ?? "",
            request.overwriteBindingInput === undefined
              ? undefined
              : BigInt(request.overwriteBindingInput),
          );
          return Buffer.from(proof).toString("base64");
        }
        default:
          throw new Error(
            `Unsupported browser test wallet call: ${request.method}`,
          );
      }
    },
  );

  await page.addInitScript(
    ({ expectedNetwork }) => {
      type WalletBridge = (request: BridgeRequest) => Promise<unknown>;
      const browserWindow = window as unknown as {
        __aptorLocalWalletCall: WalletBridge;
        midnight: unknown;
      };
      const call = browserWindow.__aptorLocalWalletCall;
      const asObject = (value: unknown): Record<string, unknown> =>
        value as Record<string, unknown>;
      const bytesToBase64 = (bytes: Uint8Array): string => {
        let binary = "";
        const chunkSize = 32_768;
        for (let offset = 0; offset < bytes.length; offset += chunkSize) {
          binary += String.fromCharCode(
            ...bytes.subarray(offset, offset + chunkSize),
          );
        }
        return btoa(binary);
      };
      const base64ToBytes = (value: string): Uint8Array => {
        const binary = atob(value);
        return Uint8Array.from(binary, (character) => character.charCodeAt(0));
      };
      const connected = {
        getConnectionStatus: () => call({ method: "getConnectionStatus" }),
        getConfiguration: () => call({ method: "getConfiguration" }),
        getShieldedAddresses: () => call({ method: "getShieldedAddresses" }),
        getUnshieldedAddress: () => call({ method: "getUnshieldedAddress" }),
        async getDustBalance() {
          const dust = asObject(await call({ method: "getDustBalance" }));
          return {
            balance: BigInt(String(dust.balance)),
            cap: BigInt(String(dust.cap)),
          };
        },
        async hintUsage(methodNames: string[]) {
          await call({ method: "hintUsage", methodNames });
        },
        balanceUnsealedTransaction: (tx: string) =>
          call({ method: "balanceUnsealedTransaction", tx }),
        async submitTransaction(tx: string) {
          await call({ method: "submitTransaction", tx });
        },
        async getProvingProvider() {
          return {
            async check(serializedPreimage: Uint8Array, keyLocation: string) {
              const output = (await call({
                method: "check",
                preimage: bytesToBase64(serializedPreimage),
                keyLocation,
              })) as Array<string | null>;
              return output.map((entry) =>
                entry === null ? undefined : BigInt(entry),
              );
            },
            async prove(
              serializedPreimage: Uint8Array,
              keyLocation: string,
              overwriteBindingInput?: bigint,
            ) {
              const proof = await call({
                method: "prove",
                preimage: bytesToBase64(serializedPreimage),
                keyLocation,
                ...(overwriteBindingInput === undefined
                  ? {}
                  : {
                      overwriteBindingInput: overwriteBindingInput.toString(10),
                    }),
              });
              return base64ToBytes(String(proof));
            },
          };
        },
      };
      browserWindow.midnight = {
        "9e94a59f-aptor-local-wallet": {
          apiVersion: "4.0.1",
          icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg'/>",
          name: "Official LocalNet test wallet",
          rdns: "network.midnight.aptor.local-test",
          async connect(networkId: string) {
            if (networkId !== expectedNetwork) {
              throw new Error(
                `Network ID mismatch: expected ${expectedNetwork}, got ${networkId}`,
              );
            }
            return connected;
          },
        },
      };
    },
    { expectedNetwork: config.networkId },
  );
}

function fileInput(page: Page, label: string) {
  return page
    .locator("label.file-field")
    .filter({ hasText: label })
    .locator('input[type="file"]');
}

async function saveDownload(
  page: Page,
  buttonName: string,
  testInfo: TestInfo,
  filename: string,
): Promise<string> {
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: buttonName }).click();
  const download = await downloadPromise;
  const path = testInfo.outputPath(filename);
  await download.saveAs(path);
  return path;
}

async function createProfile(
  page: Page,
  handle: string,
  displayName: string,
  password: string,
): Promise<void> {
  await page.getByLabel("Aptor handle").fill(handle);
  await page.getByLabel("Display name").fill(displayName);
  await page
    .getByLabel("Profile vault password", { exact: true })
    .fill(password);
  await page.getByLabel("Confirm password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Create Aptor profile" }).click();
}

test.beforeAll(async () => {
  wallet = await LocalWalletProvider.build(environmentConfiguration(config));
  connector = new DAppConnectorWalletAdapter(
    wallet,
    environmentConfiguration(config),
  );
  const zkConfigProvider = new NodeZkConfigProvider<
    "createProofRequest" | "proveAgainstRequest"
  >(config.zkConfigPath);
  provingProvider = await connector.getProvingProvider(
    zkConfigProvider.asKeyMaterialProvider(),
  );
});

test.afterAll(async () => {
  await wallet.stop();
});

test("encrypted multi-role profile lifecycle keeps IndexedDB ciphertext-only", async ({
  browser,
}, testInfo) => {
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();
  await page.goto("/professional", { waitUntil: "networkidle" });

  await page.getByLabel("Aptor handle").fill("vault-lifecycle");
  await page.getByLabel("Display name").fill("Vault Lifecycle");
  await page
    .getByLabel("Profile vault password", { exact: true })
    .fill(vaultPassword);
  await page
    .getByLabel("Confirm password", { exact: true })
    .fill(vaultPassword);
  await page.getByRole("button", { name: "Create Aptor profile" }).click();
  await expect(
    page.getByRole("heading", { name: "Invite previous client" }),
  ).toBeVisible();

  const storedVault = await page.evaluate(async () => {
    const request = indexedDB.open("aptor-encrypted-vaults", 1);
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      const transaction = database.transaction("vaults", "readonly");
      const get = transaction.objectStore("vaults").get("account");
      return await new Promise<unknown>((resolve, reject) => {
        get.onsuccess = () => resolve(get.result);
        get.onerror = () => reject(get.error);
      });
    } finally {
      database.close();
    }
  });
  const storedJson = JSON.stringify(storedVault);
  expect(storedJson).toContain('"ciphertext"');
  expect(storedJson).not.toContain("holderSecret");
  expect(storedJson).not.toContain("accessToken");
  expect(storedJson).not.toContain("privateEncryptionKey");

  const backupPath = await saveDownload(
    page,
    "Export encrypted profile backup",
    testInfo,
    "profile-vault-backup.json",
  );
  await page.getByRole("button", { name: "Lock Aptor profile" }).click();
  await expect(
    page.getByRole("heading", { name: "Unlock Aptor profile" }),
  ).toBeVisible();
  await page
    .getByLabel("Profile vault password", { exact: true })
    .fill("Incorrect password 2026!");
  await page.getByRole("button", { name: "Unlock Aptor profile" }).click();
  await expect(page.locator(".form-message[role='alert']")).toContainText(
    "incorrect or the encrypted data was modified",
  );
  await page
    .getByLabel("Profile vault password", { exact: true })
    .fill(vaultPassword);
  await page.getByRole("button", { name: "Unlock Aptor profile" }).click();
  await expect(
    page.getByRole("heading", { name: "Invite previous client" }),
  ).toBeVisible();

  const restoreContext = await browser.newContext({ acceptDownloads: true });
  const restorePage = await restoreContext.newPage();
  await restorePage.goto("/professional", { waitUntil: "networkidle" });
  await expect(
    restorePage.getByRole("heading", { name: "Create Aptor profile" }),
  ).toBeVisible();
  await restorePage
    .getByText("Advanced · Restore encrypted profile backup")
    .click();
  await fileInput(restorePage, "Encrypted profile backup").setInputFiles(
    backupPath,
  );
  await restorePage
    .getByLabel("Backup password", { exact: true })
    .fill(vaultPassword);
  await restorePage
    .getByRole("button", { name: "Restore encrypted profile" })
    .click();
  await expect(
    restorePage.getByRole("heading", { name: "Invite previous client" }),
  ).toBeVisible();
  await restoreContext.close();
  await context.close();
});

test("three browser profiles complete the real Aptor LocalNet flow", async ({
  browser,
}) => {
  const professionalContext = await browser.newContext({
    acceptDownloads: true,
  });
  const issuerContext = await browser.newContext({ acceptDownloads: true });
  const verifierContext = await browser.newContext({ acceptDownloads: true });
  const professional = await professionalContext.newPage();
  const issuer = await issuerContext.newPage();
  const verifier = await verifierContext.newPage();
  const networkBodies: string[] = [];
  for (const page of [professional, issuer, verifier]) {
    page.on("request", (request) => {
      const body = request.postData();
      if (body !== null) networkBodies.push(body);
    });
  }
  await installOfficialLocalConnector(professional);
  await installOfficialLocalConnector(verifier);

  console.info("[browser-flow] creating professional identity");
  await professional.goto("/professional", { waitUntil: "networkidle" });
  console.info("[browser-flow] professional page loaded");
  await createProfile(professional, "maya-chen", "Maya Chen", vaultPassword);
  console.info("[browser-flow] professional profile created");
  await expect(
    professional.getByRole("heading", { name: "Invite previous client" }),
  ).toBeVisible();
  await professional
    .getByRole("button", { name: "Create Issuer invite" })
    .click();
  const inviteLink = await professional
    .getByLabel("Shareable invite link")
    .inputValue();
  expect(inviteLink).toContain("/invite/");
  console.info("[browser-flow] one-time Issuer invitation created");

  console.info("[browser-flow] creating issuer identity and credential");
  await issuer.goto(inviteLink, { waitUntil: "networkidle" });
  await expect(
    issuer.getByRole("heading", { name: /invited you to issue/ }),
  ).toBeVisible();
  await createProfile(
    issuer,
    "northstar-studio",
    "Northstar Studio",
    issuerVaultPassword,
  );
  await issuer.getByRole("button", { name: "Accept invitation" }).click();
  await issuer.waitForURL("**/issuer");
  await expect(issuer.getByText(/Maya Chen/).first()).toBeVisible();
  console.info("[browser-flow] invitation redeemed once by Issuer");
  await issuer
    .locator('textarea[name="skills"]')
    .fill("React, Accessibility, TypeScript");
  console.info("[browser-flow] issuer skills entered");
  await issuer.getByLabel("Duration in months", { exact: true }).fill("18");
  console.info("[browser-flow] issuer duration entered");
  await issuer.locator('input[name="rating"]').fill("4.75");
  console.info("[browser-flow] issuer rating entered");
  await issuer.getByLabel("Delivered to production", { exact: true }).check();
  console.info("[browser-flow] issuer production status entered");
  await issuer.getByRole("button", { name: "Review credential" }).click();
  await expect(
    issuer.getByRole("heading", {
      name: "Confirm the complete private credential",
    }),
  ).toBeVisible();
  console.info("[browser-flow] credential reviewed");
  await issuer
    .getByRole("button", { name: "Sign and deliver credential" })
    .click();
  console.info("[browser-flow] credential encrypted and delivered in-app");
  await expect(issuer.locator(".form-message[role='status']")).toContainText(
    "Delivered to Professional inbox",
  );

  console.info("[browser-flow] accepting credential from Professional inbox");
  await expect(
    professional.getByRole("button", { name: "Verify and save" }),
  ).toBeVisible({ timeout: 30_000 });
  await professional.getByRole("button", { name: "Verify and save" }).click();
  await expect(
    professional.locator(".workspace-message[role='status']"),
  ).toContainText("Issuer signature, and holder binding verified");

  console.info("[browser-flow] composing verifier request");
  await verifier.goto("/verifier", { waitUntil: "networkidle" });
  await createProfile(verifier, "proof-lab", "Proof Lab", vaultPassword);
  await verifier.getByLabel("Issuer Aptor handle").fill("northstar-studio");
  await verifier.getByRole("button", { name: "Add trusted Issuer" }).click();
  await expect(verifier.getByText("Northstar Studio").first()).toBeVisible();
  await verifier.getByLabel("Professional Aptor handle").fill("maya-chen");
  await verifier.getByRole("button", { name: "Select Professional" }).click();
  await expect(verifier.getByText("@maya-chen").first()).toBeVisible();
  await verifier.getByLabel("Required skill", { exact: true }).fill("React");
  await verifier.getByLabel("Minimum duration", { exact: true }).check();
  await verifier.locator('input[name="minimumDurationMonths"]').fill("12");
  await verifier
    .getByLabel("Require production delivery", { exact: true })
    .check();
  await verifier.getByLabel("Minimum rating", { exact: true }).check();
  await verifier.locator('input[name="minimumRating"]').fill("4.50");
  await verifier.getByRole("button", { name: "Review public request" }).click();
  await expect(
    verifier.getByRole("heading", { name: "Register and send" }),
  ).toBeVisible();
  console.info("[browser-flow] connecting verifier wallet");
  await expect(
    verifier.getByText("Wallet detected", { exact: true }),
  ).toBeVisible();
  await verifier.getByRole("button", { name: "Connect wallet" }).click();
  await expect(verifier.getByText("Connected", { exact: true })).toBeVisible();
  console.info("[browser-flow] registering and delivering request on LocalNet");
  await verifier
    .getByRole("button", { name: "Register and send request" })
    .click();
  await expect(verifier.getByRole("status").last()).toContainText(
    "Request registered in block",
    { timeout: 900_000 },
  );

  console.info("[browser-flow] receiving registered request in-app");
  await expect(
    professional.getByRole("button", { name: "Review request" }),
  ).toBeVisible({ timeout: 30_000 });
  await professional.getByRole("button", { name: "Review request" }).click();
  await expect(
    professional.getByText("Compatible credentials: 1", { exact: true }),
  ).toBeVisible({ timeout: 60_000 });
  await professional.getByRole("radio", { name: /Private credential/ }).check();
  await expect(
    professional.getByText("Wallet detected", { exact: true }),
  ).toBeVisible();
  await professional.getByRole("button", { name: "Connect wallet" }).click();
  await expect(
    professional.getByText("Connected", { exact: true }),
  ).toBeVisible();
  console.info("[browser-flow] generating and submitting proof");
  const submitProof = professional.getByRole("button", {
    name: "Generate and submit proof",
  });
  const proofSuccess = professional.getByText(
    "Proof finalized. The Verifier will see the fulfilled receipt automatically.",
  );
  const proofFailure = professional.locator(
    ".form-message.form-message--error[role='alert']",
  );
  await submitProof.click();
  await expect(proofSuccess.or(proofFailure)).toBeVisible({ timeout: 900_000 });
  if (await proofFailure.isVisible()) {
    const message = (await proofFailure.textContent()) ?? "";
    if (
      !/getParams promise resolved to error: TypeError: terminated/iu.test(
        message,
      )
    ) {
      throw new Error(`LocalNet proof failed: ${message}`);
    }
    console.info(
      "[browser-flow] retrying once after the verified parameter host terminated its response",
    );
    await submitProof.click();
  }
  await expect(proofSuccess).toBeVisible({ timeout: 900_000 });
  const receipt = professional.locator(".receipt-card");
  const fulfillmentTransactionId = await receipt
    .locator("div")
    .filter({ hasText: "Transaction" })
    .locator("dd")
    .textContent();
  expect(fulfillmentTransactionId).toBeTruthy();

  console.info("[browser-flow] waiting for automatic Verifier receipt update");
  await expect(
    verifier.getByText("Request fulfilled", { exact: true }),
  ).toBeVisible({
    timeout: 60_000,
  });

  const localStorageKeys = await professional.evaluate(() =>
    Object.keys(localStorage),
  );
  expect(localStorageKeys).toEqual([]);
  expect(issuer.url()).not.toContain("/invite/");
  const networkText = networkBodies.join("\n");
  expect(networkText).not.toContain("Accessibility");
  expect(networkText).not.toContain("holderSecret");
  expect(networkText).not.toContain("issuerSigningKey");
  expect(networkText).not.toContain("privateEncryptionKey");

  const deliveryDatabase = new DatabaseSync(
    resolve(repositoryRoot, ".midnight/browser-e2e/delivery.sqlite"),
    { readOnly: true },
  );
  const storedEnvelopes = deliveryDatabase
    .prepare("SELECT * FROM encrypted_envelopes ORDER BY created_at")
    .all();
  const requestTracking = deliveryDatabase
    .prepare("SELECT * FROM request_tracking LIMIT 1")
    .get() as
    | {
        request_id: string;
        registration_transaction_id: string;
        fulfillment_transaction_id: string;
        public_status: string;
      }
    | undefined;
  deliveryDatabase.close();
  const databaseText = JSON.stringify(storedEnvelopes);
  expect(storedEnvelopes).toHaveLength(2);
  expect(databaseText).not.toContain("Accessibility");
  expect(databaseText).not.toContain("durationMonths");
  expect(databaseText).not.toContain("issuerSignature");
  expect(databaseText).not.toContain("holderSecret");
  expect(requestTracking?.public_status).toBe("fulfilled");

  console.info("[browser-flow] complete");
  console.info(
    JSON.stringify({
      event: "aptor_browser_localnet_result",
      contractAddress: deployment.contractAddress,
      deploymentTransactionId: deployment.deploymentTransactionId,
      deploymentBlockHeight: deployment.deploymentBlockHeight,
      requestId: requestTracking?.request_id,
      registrationTransactionId: requestTracking?.registration_transaction_id,
      fulfillmentTransactionId,
      requestFulfilled: true,
      deliveryEnvelopeCount: storedEnvelopes.length,
      localStorageSecretKeys: localStorageKeys.length,
    }),
  );

  await professionalContext.close();
  await issuerContext.close();
  await verifierContext.close();
});

test("portable credential files remain an advanced browser fallback", async ({
  browser,
}, testInfo) => {
  const professionalContext = await browser.newContext({
    acceptDownloads: true,
  });
  const issuerContext = await browser.newContext({ acceptDownloads: true });
  const professional = await professionalContext.newPage();
  const issuer = await issuerContext.newPage();

  await professional.goto("/professional", { waitUntil: "networkidle" });
  await createProfile(
    professional,
    "portable-professional",
    "Portable Professional",
    vaultPassword,
  );
  await professional
    .getByText("Advanced · Portable backup, import, or export")
    .click();
  const holderPath = await saveDownload(
    professional,
    "Export holder profile",
    testInfo,
    "portable-holder.json",
  );

  await issuer.goto("/issuer", { waitUntil: "networkidle" });
  await createProfile(
    issuer,
    "portable-issuer",
    "Portable Issuer",
    issuerVaultPassword,
  );
  await issuer.getByText("Advanced · Portable backup and export").click();
  await fileInput(issuer, "Professional holder profile").setInputFiles(
    holderPath,
  );
  await issuer.locator('textarea[name="skills"]').fill("Documentation");
  await issuer.getByLabel("Duration in months").fill("6");
  await issuer.getByLabel("Client rating").fill("4.25");
  await issuer.getByRole("button", { name: "Review credential" }).click();
  await issuer.getByLabel("Transfer passphrase").fill(transferPassphrase);
  const credentialPath = await saveDownload(
    issuer,
    "Export portable credential",
    testInfo,
    "portable-credential.json",
  );

  await fileInput(professional, "Aptor credential package").setInputFiles(
    credentialPath,
  );
  await professional.getByLabel("Transfer passphrase").fill(transferPassphrase);
  await professional
    .getByRole("button", { name: "Verify portable credential" })
    .click();
  await expect(professional.getByRole("status").last()).toContainText(
    "Portable credential verified and saved",
  );

  await professionalContext.close();
  await issuerContext.close();
});

test("landing hero fits the standard laptop fold", async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();
  await page.goto("/", { waitUntil: "networkidle" });

  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open my vault" })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Verify a proof" }),
  ).toBeVisible();
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
  await context.close();
});

for (const viewport of [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "tablet-768", width: 768, height: 1024 },
  { name: "mobile-414", width: 414, height: 896 },
  { name: "mobile-375", width: 375, height: 812 },
  { name: "mobile-320", width: 320, height: 720 },
]) {
  test(`all role entry pages fit the ${viewport.name} viewport`, async ({
    browser,
  }) => {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    for (const role of ["issuer", "professional", "verifier"]) {
      await page.goto(`/${role}`, { waitUntil: "networkidle" });
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(1);

      const clippedControls = await page
        .locator("button, a.role-link")
        .evaluateAll((controls) =>
          controls
            .filter((control) => {
              const element = control as HTMLElement;
              const style = getComputedStyle(element);
              return (
                style.display !== "none" &&
                style.visibility !== "hidden" &&
                (element.scrollWidth > element.clientWidth + 1 ||
                  element.scrollHeight > element.clientHeight + 1)
              );
            })
            .map((control) => control.textContent?.trim() ?? control.tagName),
        );
      expect(clippedControls).toEqual([]);
    }
    await context.close();
  });
}
