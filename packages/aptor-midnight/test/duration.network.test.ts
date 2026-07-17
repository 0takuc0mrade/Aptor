import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  AptorDurationApi,
  assertLocalNetworkHealthy,
  createAptorProviders,
  environmentConfiguration,
  localMidnightConfig,
  LocalWalletProvider,
  type ProofInvocationMetrics,
} from "../src/index.js";

type PublicInspectionFinding = Readonly<{
  path: string;
  value: unknown;
}>;

function findSemanticPrivateValue(
  value: unknown,
  privateValue: bigint,
  currentPath = "public",
  findings: PublicInspectionFinding[] = [],
): PublicInspectionFinding[] {
  if (
    value === privateValue ||
    value === Number(privateValue) ||
    value === privateValue.toString()
  ) {
    findings.push({ path: currentPath, value });
    return findings;
  }

  if (
    value === null ||
    value === undefined ||
    typeof value !== "object" ||
    value instanceof Uint8Array
  ) {
    return findings;
  }

  if (value instanceof Map) {
    for (const [key, child] of value.entries()) {
      findSemanticPrivateValue(
        child,
        privateValue,
        `${currentPath}.map[${String(key)}]`,
        findings,
      );
    }
    return findings;
  }

  for (const [key, child] of Object.entries(value)) {
    if (key.toLowerCase().includes("durationmonths")) {
      findings.push({ path: `${currentPath}.${key}`, value: child });
      continue;
    }
    findSemanticPrivateValue(
      child,
      privateValue,
      `${currentPath}.${key}`,
      findings,
    );
  }
  return findings;
}

function createMetrics(): ProofInvocationMetrics {
  return { proveTxCalls: 0 };
}

test(
  "deploys Aptor, proves duration, finalizes transactions, and preserves privacy",
  { timeout: 1_800_000 },
  async () => {
    await assertLocalNetworkHealthy();
    const config = localMidnightConfig();
    const runId = `network-${Date.now().toString(36)}`;
    const privateStateRunRoot = path.resolve(config.privateStateRoot, runId);
    const wallet = await LocalWalletProvider.build(
      environmentConfiguration(config),
    );

    try {
      const passingMetrics = createMetrics();
      const passingProviders = createAptorProviders(
        config,
        wallet,
        `${runId}/passing`,
        passingMetrics,
      );
      const passingContract = await AptorDurationApi.deployWithDuration(
        passingProviders,
        12n,
      );
      assert.ok(passingContract.contractAddress);
      assert.equal((await passingContract.publicState()).successfulProofs, 0n);

      const proofCallsBeforePassing = passingMetrics.proveTxCalls;
      const submissionsBeforePassing = wallet.submittedTransactions;
      const passingTransaction = await passingContract.proveDuration(6n);
      assert.equal(
        passingMetrics.proveTxCalls,
        proofCallsBeforePassing + 1,
        "the HTTP proof provider must be invoked",
      );
      assert.equal(
        wallet.submittedTransactions,
        submissionsBeforePassing + 1,
        "the proven transaction must be submitted",
      );
      assert.ok(passingTransaction.txId);
      assert.equal(passingTransaction.returnValue.length, 0);
      const passingState = await passingContract.publicState();
      assert.equal(passingState.successfulProofs, 1n);

      const passingFinalizedData =
        await passingProviders.publicDataProvider.watchForTxData(
          passingTransaction.txId,
        );
      const passingDeployData =
        await passingProviders.publicDataProvider.watchForTxData(
          passingContract.deploymentTransaction.txId,
        );
      const passingPrivacyFindings = findSemanticPrivateValue(
        {
          deployment: passingDeployData,
          call: passingFinalizedData,
          ledger: passingState,
          returnValue: passingTransaction.returnValue,
        },
        12n,
      );
      assert.deepEqual(
        passingPrivacyFindings,
        [],
        "the exact private duration must not appear as a decoded public value",
      );

      const boundaryMetrics = createMetrics();
      const boundaryProviders = createAptorProviders(
        config,
        wallet,
        `${runId}/boundary`,
        boundaryMetrics,
      );
      const boundaryContract = await AptorDurationApi.deployWithDuration(
        boundaryProviders,
        6n,
      );
      assert.equal((await boundaryContract.publicState()).successfulProofs, 0n);
      const boundaryProofCallsBefore = boundaryMetrics.proveTxCalls;
      const boundarySubmissionsBefore = wallet.submittedTransactions;
      const boundaryTransaction = await boundaryContract.proveDuration(6n);
      assert.equal(boundaryMetrics.proveTxCalls, boundaryProofCallsBefore + 1);
      assert.equal(wallet.submittedTransactions, boundarySubmissionsBefore + 1);
      assert.ok(boundaryTransaction.txId);
      assert.equal((await boundaryContract.publicState()).successfulProofs, 1n);

      const failingMetrics = createMetrics();
      const failingProviders = createAptorProviders(
        config,
        wallet,
        `${runId}/failing`,
        failingMetrics,
      );
      const failingContract = await AptorDurationApi.deployWithDuration(
        failingProviders,
        3n,
      );
      assert.equal((await failingContract.publicState()).successfulProofs, 0n);
      const failingProofCallsBefore = failingMetrics.proveTxCalls;
      const failingSubmissionsBefore = wallet.submittedTransactions;

      await assert.rejects(
        failingContract.proveDuration(6n),
        (error: unknown) => {
          assert.ok(error instanceof Error);
          assert.match(error.message, /private duration|assert/i);
          return true;
        },
      );
      assert.equal(
        failingMetrics.proveTxCalls,
        failingProofCallsBefore,
        "a locally rejected assertion must not invoke the proof server",
      );
      assert.equal(
        wallet.submittedTransactions,
        failingSubmissionsBefore,
        "a locally rejected assertion must not submit a transaction",
      );
      assert.equal((await failingContract.publicState()).successfulProofs, 0n);

      console.info(
        JSON.stringify({
          event: "aptor_midnight_local_result",
          passing: {
            contractAddress: passingContract.contractAddress,
            deploymentTxId: passingContract.deploymentTransaction.txId,
            callTxId: passingTransaction.txId,
            successfulProofs: passingState.successfulProofs.toString(),
          },
          boundary: {
            contractAddress: boundaryContract.contractAddress,
            callTxId: boundaryTransaction.txId,
            successfulProofs: "1",
          },
          failing: {
            contractAddress: failingContract.contractAddress,
            proofRequested: false,
            transactionSubmitted: false,
            successfulProofs: "0",
          },
          privacy: {
            decodedPublicPrivateValueFindings: passingPrivacyFindings.length,
          },
        }),
      );
    } finally {
      await wallet.stop();
      await rm(privateStateRunRoot, { recursive: true, force: true });
    }
  },
);
