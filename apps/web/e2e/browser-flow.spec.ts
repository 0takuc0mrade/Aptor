import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
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

test("encrypted browser vault lifecycle keeps IndexedDB ciphertext-only", async ({
  browser,
}, testInfo) => {
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();
  await page.goto("/professional", { waitUntil: "networkidle" });

  await page.getByLabel("Vault password", { exact: true }).fill(vaultPassword);
  await page
    .getByLabel("Confirm password", { exact: true })
    .fill(vaultPassword);
  await page.getByRole("button", { name: "Create professional vault" }).click();
  await expect(
    page.getByRole("heading", { name: "Credential vault" }),
  ).toBeVisible();

  const storedVault = await page.evaluate(async () => {
    const request = indexedDB.open("aptor-encrypted-vaults", 1);
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      const transaction = database.transaction("vaults", "readonly");
      const get = transaction.objectStore("vaults").get("professional");
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
  expect(storedJson).not.toContain("credentials");

  const backupPath = await saveDownload(
    page,
    "Export encrypted backup",
    testInfo,
    "professional-vault-backup.json",
  );
  await page.getByRole("button", { name: "Lock vault" }).click();
  await expect(
    page.getByRole("heading", { name: "Unlock encrypted vault" }),
  ).toBeVisible();
  await page
    .getByLabel("Vault password", { exact: true })
    .fill("Incorrect password 2026!");
  await page.getByRole("button", { name: "Unlock vault" }).click();
  await expect(page.locator(".form-message[role='alert']")).toContainText(
    "incorrect or the encrypted data was modified",
  );
  await page.getByLabel("Vault password", { exact: true }).fill(vaultPassword);
  await page.getByRole("button", { name: "Unlock vault" }).click();
  await expect(
    page.getByRole("heading", { name: "Credential vault" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Delete local vault" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete local vault" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Create encrypted vault" }),
  ).toBeVisible();
  await page.getByText("Restore an encrypted backup").click();
  await fileInput(page, "Encrypted vault backup").setInputFiles(backupPath);
  await page.getByLabel("Backup password", { exact: true }).fill(vaultPassword);
  await page.getByRole("button", { name: "Restore encrypted backup" }).click();
  await expect(
    page.getByRole("heading", { name: "Credential vault" }),
  ).toBeVisible();
  await context.close();
});

test("three browser profiles complete the real Aptor LocalNet flow", async ({
  browser,
}, testInfo) => {
  const professionalContext = await browser.newContext({
    acceptDownloads: true,
  });
  const issuerContext = await browser.newContext({ acceptDownloads: true });
  const verifierContext = await browser.newContext({ acceptDownloads: true });
  const professional = await professionalContext.newPage();
  const issuer = await issuerContext.newPage();
  const verifier = await verifierContext.newPage();
  await installOfficialLocalConnector(professional);
  await installOfficialLocalConnector(verifier);

  console.info("[browser-flow] creating professional identity");
  await professional.goto("/professional", { waitUntil: "networkidle" });
  console.info("[browser-flow] professional page loaded");
  await professional
    .getByLabel("Vault password", { exact: true })
    .fill(vaultPassword);
  await professional
    .getByLabel("Confirm password", { exact: true })
    .fill(vaultPassword);
  await professional
    .getByRole("button", { name: "Create professional vault" })
    .click();
  console.info("[browser-flow] professional vault created");
  await expect(
    professional.getByRole("heading", { name: "Credential vault" }),
  ).toBeVisible();
  console.info("[browser-flow] exporting holder profile");
  const holderPath = await saveDownload(
    professional,
    "Export holder profile",
    testInfo,
    "holder.aptor-holder.json",
  );
  console.info("[browser-flow] holder profile exported");

  console.info("[browser-flow] creating issuer identity and credential");
  await issuer.goto("/issuer", { waitUntil: "networkidle" });
  console.info("[browser-flow] issuer page loaded");
  await issuer.getByLabel(/Display name/).fill("Northstar Studio");
  await issuer
    .getByLabel("Vault password", { exact: true })
    .fill(issuerVaultPassword);
  await issuer
    .getByLabel("Confirm password", { exact: true })
    .fill(issuerVaultPassword);
  await issuer.getByRole("button", { name: "Create issuer vault" }).click();
  console.info("[browser-flow] issuer vault created");
  const issuerProfilePath = await saveDownload(
    issuer,
    "Export issuer profile",
    testInfo,
    "issuer.aptor-issuer.json",
  );
  console.info("[browser-flow] issuer profile exported");
  await fileInput(issuer, "Professional holder profile").setInputFiles(
    holderPath,
  );
  await expect(issuer.getByText(/Holder: apt_/)).toBeVisible();
  console.info("[browser-flow] holder profile imported by issuer");
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
    .locator('input[name="transferPassphrase"]')
    .fill(transferPassphrase);
  const credentialPath = await saveDownload(
    issuer,
    "Sign and download credential",
    testInfo,
    "work.aptor-credential",
  );
  console.info("[browser-flow] credential encrypted and exported");
  await expect(issuer.locator(".form-message[role='status']")).toContainText(
    "Credential signed and encrypted",
  );

  console.info("[browser-flow] importing credential into professional vault");
  await fileInput(professional, "Aptor credential package").setInputFiles(
    credentialPath,
  );
  await professional
    .locator('input[name="transferPassphrase"]')
    .fill(transferPassphrase);
  await professional
    .getByRole("button", { name: "Verify and save credential" })
    .click();
  await expect(professional.getByRole("status").last()).toContainText(
    "Credential signature and holder binding verified",
  );

  console.info("[browser-flow] composing verifier request");
  await verifier.goto("/verifier", { waitUntil: "networkidle" });
  await fileInput(verifier, "Accepted issuer profile").setInputFiles(
    issuerProfilePath,
  );
  await expect(
    verifier.getByText("Northstar Studio", { exact: true }),
  ).toBeVisible();
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
    verifier.getByRole("heading", { name: "Complete public request" }),
  ).toBeVisible();
  console.info("[browser-flow] connecting verifier wallet");
  await expect(
    verifier.getByText("Wallet detected", { exact: true }),
  ).toBeVisible();
  await verifier.getByRole("button", { name: "Connect wallet" }).click();
  await expect(verifier.getByText("Connected", { exact: true })).toBeVisible();
  console.info("[browser-flow] registering request on LocalNet");
  await verifier
    .getByRole("button", { name: "Register request on Midnight" })
    .click();
  await expect(verifier.getByRole("status").last()).toContainText(
    "Request registered in block",
    {
      timeout: 900_000,
    },
  );
  const requestPath = await saveDownload(
    verifier,
    "Download request package",
    testInfo,
    "request.aptor-request.json",
  );
  const requestPackage = JSON.parse(await readFile(requestPath, "utf8")) as {
    request: { requestId: string };
    registrationTransactionId: string;
  };

  console.info("[browser-flow] importing registered request");
  await fileInput(professional, "Aptor request package").setInputFiles(
    requestPath,
  );
  await expect(professional.getByRole("status").last()).toContainText(
    "Registered request verified and saved",
    {
      timeout: 60_000,
    },
  );
  await professional.getByRole("radio", { name: /Private credential/ }).check();
  await expect(
    professional.getByText("Wallet detected", { exact: true }),
  ).toBeVisible();
  await professional.getByRole("button", { name: "Connect wallet" }).click();
  await expect(
    professional.getByText("Connected", { exact: true }),
  ).toBeVisible();
  console.info("[browser-flow] generating and submitting proof");
  await professional
    .getByRole("button", { name: "Generate and submit proof" })
    .click();
  await expect(
    professional.getByText(
      "Proof finalized. Only the registered request receipt is public.",
    ),
  ).toBeVisible({
    timeout: 900_000,
  });
  const receipt = professional.locator(".receipt-card");
  const fulfillmentTransactionId = await receipt
    .locator("div")
    .filter({ hasText: "Transaction" })
    .locator("dd")
    .textContent();
  expect(fulfillmentTransactionId).toBeTruthy();

  console.info("[browser-flow] confirming replay rejection");
  await professional.getByRole("button", { name: "Lock vault" }).click();
  await professional
    .getByLabel("Vault password", { exact: true })
    .fill(vaultPassword);
  await professional.getByRole("button", { name: "Unlock vault" }).click();
  await professional.getByRole("radio", { name: /React/ }).first().check();
  await professional.getByRole("radio", { name: /Private credential/ }).check();
  await professional
    .getByRole("button", { name: "Generate and submit proof" })
    .click();
  await expect(
    professional.locator(".form-message[role='alert']"),
  ).toContainText("already fulfilled", {
    timeout: 60_000,
  });

  console.info("[browser-flow] querying public receipt");
  await fileInput(verifier, "Aptor request package")
    .last()
    .setInputFiles(requestPath);
  await verifier.getByRole("button", { name: "Query public state" }).click();
  await expect(
    verifier.getByText("Request fulfilled", { exact: true }),
  ).toBeVisible({
    timeout: 60_000,
  });
  await expect(
    verifier.getByRole("heading", {
      name: "This registered request was satisfied by a valid Aptor credential from an issuer in the accepted issuer set.",
    }),
  ).toBeVisible();

  const localStorageKeys = await professional.evaluate(() =>
    Object.keys(localStorage),
  );
  expect(localStorageKeys).toEqual([]);
  const publicRequestText = await readFile(requestPath, "utf8");
  expect(publicRequestText).not.toContain("holderSecret");
  expect(publicRequestText).not.toContain("issuerSigningKey");
  expect(publicRequestText).not.toContain("issuerSignature");
  expect(publicRequestText).not.toContain("credentialId");

  console.info("[browser-flow] complete");
  console.info(
    JSON.stringify({
      event: "aptor_browser_localnet_result",
      contractAddress: deployment.contractAddress,
      deploymentTransactionId: deployment.deploymentTransactionId,
      deploymentBlockHeight: deployment.deploymentBlockHeight,
      requestId: requestPackage.request.requestId,
      registrationTransactionId: requestPackage.registrationTransactionId,
      fulfillmentTransactionId,
      requestFulfilled: true,
      replayRejectedBeforeProof: true,
      localStorageSecretKeys: localStorageKeys.length,
    }),
  );

  await professionalContext.close();
  await issuerContext.close();
  await verifierContext.close();
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
