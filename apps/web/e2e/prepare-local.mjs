import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  createIssuerVault,
  createPrivateStateForRequest,
  createProfessionalVault,
  finalizeRequestPackage,
  issueCredential,
} from "@aptor/browser";
import {
  AptorCredentialApi,
  assertLocalNetworkHealthy,
  createAptorProviders,
  environmentConfiguration,
  localMidnightConfig,
  LocalWalletProvider,
} from "@aptor/midnight";

const outputDirectory = path.resolve(".midnight", "browser-e2e");
const outputPath = path.join(outputDirectory, "deployment.json");
const deliveryDatabasePath = path.join(outputDirectory, "delivery.sqlite");
const config = localMidnightConfig();
const runId = `browser-deploy-${Date.now().toString(36)}`;
const privateStateRoot = path.resolve(config.privateStateRoot, runId);

await assertLocalNetworkHealthy();
await rm(deliveryDatabasePath, { force: true });
await rm(`${deliveryDatabasePath}-shm`, { force: true });
await rm(`${deliveryDatabasePath}-wal`, { force: true });
const wallet = await LocalWalletProvider.build(
  environmentConfiguration(config),
);

try {
  const professional = createProfessionalVault();
  const issuer = createIssuerVault("Aptor browser deployment fixture");
  const credential = issueCredential(issuer, {
    holderProfile: professional.profile,
    skills: ["Deployment"],
    durationMonths: 1,
    deliveredToProduction: true,
    clientRatingHundredths: 500,
  });
  const request = finalizeRequestPackage(
    "undeployed",
    "browser-e2e-deployment-placeholder",
    {
      acceptedIssuerProfiles: [issuer.profile],
      requiredSkill: "Deployment",
      requireProductionDelivery: false,
    },
    "deployment-placeholder-transaction",
  );
  const privateState = createPrivateStateForRequest(
    professional,
    credential,
    request,
  );
  const providers = createAptorProviders(
    config,
    wallet,
    `${runId}/deployment`,
    { proveTxCalls: 0 },
  );
  const contract = await AptorCredentialApi.deploy(providers, privateState);

  await mkdir(outputDirectory, { recursive: true });
  await writeFile(
    outputPath,
    `${JSON.stringify(
      {
        network: config.networkId,
        contractAddress: contract.contractAddress,
        deploymentTransactionId: contract.deploymentTransaction.txId,
        deploymentBlockHeight: contract.deploymentTransaction.blockHeight,
        indexerUrl: config.indexer,
        indexerWsUrl: config.indexerWS,
        proofServerUrl: config.proofServer,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  console.info(
    JSON.stringify({
      event: "aptor_browser_contract_deployed",
      contractAddress: contract.contractAddress,
      deploymentTransactionId: contract.deploymentTransaction.txId,
      deploymentBlockHeight: contract.deploymentTransaction.blockHeight,
    }),
  );
} finally {
  await wallet.stop();
  await rm(privateStateRoot, { recursive: true, force: true });
}
