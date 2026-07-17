import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  createCredentialPrivateState,
  createDurationCredential,
  createHolderSecret,
  createIssuerKeyPair,
  deriveHolderCommitment,
  signCredential,
  type AptorCredentialPrivateState,
  type DurationCredential,
  type IssuerKeyPair,
} from "@aptor/credential-contract";

import {
  AptorCredentialApi,
  assertLocalNetworkHealthy,
  createAptorProviders,
  environmentConfiguration,
  localMidnightConfig,
  LocalWalletProvider,
  type ProofInvocationMetrics,
} from "../src/index.js";

type PublicInspectionFinding = Readonly<{
  path: string;
  reason: string;
}>;

type PrivateNeedles = Readonly<{
  bytes: readonly Uint8Array[];
  scalars: readonly bigint[];
}>;

function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
  return (
    left.length === right.length &&
    left.every((byte, index) => byte === right[index])
  );
}

function inspectForPrivateArtifacts(
  value: unknown,
  needles: PrivateNeedles,
  currentPath = "public",
  findings: PublicInspectionFinding[] = [],
  seen = new WeakSet<object>(),
): PublicInspectionFinding[] {
  if (typeof value === "bigint" && needles.scalars.includes(value)) {
    findings.push({ path: currentPath, reason: "private scalar matched" });
    return findings;
  }

  if (value instanceof Uint8Array) {
    if (needles.bytes.some((needle) => equalBytes(value, needle))) {
      findings.push({ path: currentPath, reason: "private bytes matched" });
    }
    return findings;
  }

  if (value === null || value === undefined || typeof value !== "object") {
    return findings;
  }
  if (seen.has(value)) {
    return findings;
  }
  seen.add(value);

  if (value instanceof Map) {
    for (const [key, child] of value.entries()) {
      inspectForPrivateArtifacts(
        child,
        needles,
        `${currentPath}.map[${String(key)}]`,
        findings,
        seen,
      );
    }
    return findings;
  }

  for (const [key, child] of Object.entries(value)) {
    if (
      /^(credentialId|holderSecret|holderCommitment|issuerSignature|durationMonths)$/i.test(
        key,
      )
    ) {
      findings.push({
        path: `${currentPath}.${key}`,
        reason: "private field name appeared",
      });
    }
    inspectForPrivateArtifacts(
      child,
      needles,
      `${currentPath}.${key}`,
      findings,
      seen,
    );
  }
  return findings;
}

function createMetrics(): ProofInvocationMetrics {
  return { proveTxCalls: 0 };
}

function createSignedBundle(
  durationMonths: number | bigint,
  issuer: IssuerKeyPair,
  holderSecret = createHolderSecret(),
): Readonly<{
  credential: DurationCredential;
  privateState: AptorCredentialPrivateState;
}> {
  const credential = createDurationCredential({
    holderCommitment: deriveHolderCommitment(holderSecret),
    durationMonths,
  });
  const signature = signCredential(credential, issuer.signingKey);
  return {
    credential,
    privateState: createCredentialPrivateState(
      credential,
      signature,
      holderSecret,
    ),
  };
}

async function assertLocalCredentialRejection(
  contract: AptorCredentialApi,
  metrics: ProofInvocationMetrics,
  wallet: LocalWalletProvider,
  expectedError: RegExp,
): Promise<void> {
  const counterBefore = (await contract.publicState())
    .successfulCredentialProofs;
  const proofCallsBefore = metrics.proveTxCalls;
  const submissionsBefore = wallet.submittedTransactions;

  await assert.rejects(
    contract.proveCredentialDuration(6n),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, expectedError);
      return true;
    },
  );
  assert.equal(
    metrics.proveTxCalls,
    proofCallsBefore,
    "local circuit rejection must happen before the proof provider",
  );
  assert.equal(
    wallet.submittedTransactions,
    submissionsBefore,
    "local circuit rejection must not submit a transaction",
  );
  assert.equal(
    (await contract.publicState()).successfulCredentialProofs,
    counterBefore,
    "rejected credential must not update public state",
  );
}

test(
  "deploys Aptor, proves issuer-authenticated credentials, rejects tampering, and preserves privacy",
  { timeout: 1_800_000 },
  async () => {
    await assertLocalNetworkHealthy();
    const config = localMidnightConfig();
    const runId = `credential-network-${Date.now().toString(36)}`;
    const privateStateRunRoot = path.resolve(config.privateStateRoot, runId);
    const wallet = await LocalWalletProvider.build(
      environmentConfiguration(config),
    );
    const acceptedIssuer = createIssuerKeyPair();

    try {
      const passingBundle = createSignedBundle(12n, acceptedIssuer);
      const passingMetrics = createMetrics();
      const passingProviders = createAptorProviders(
        config,
        wallet,
        `${runId}/passing`,
        passingMetrics,
      );
      const passingContract = await AptorCredentialApi.deploy(
        passingProviders,
        passingBundle.privateState,
        acceptedIssuer.publicKey,
      );
      const passingStateBefore = await passingContract.publicState();
      assert.equal(passingStateBefore.successfulCredentialProofs, 0n);
      assert.deepEqual(
        passingStateBefore.acceptedIssuerPublicKey,
        acceptedIssuer.publicKey,
      );

      const proofCallsBeforePassing = passingMetrics.proveTxCalls;
      const submissionsBeforePassing = wallet.submittedTransactions;
      const passingTransaction =
        await passingContract.proveCredentialDuration(6n);
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
      const passingStateAfter = await passingContract.publicState();
      assert.equal(passingStateAfter.successfulCredentialProofs, 1n);

      const passingFinalizedData =
        await passingProviders.publicDataProvider.watchForTxData(
          passingTransaction.txId,
        );
      const passingDeployData =
        await passingProviders.publicDataProvider.watchForTxData(
          passingContract.deploymentTransaction.txId,
        );
      const passingPublicDataResponse =
        await passingProviders.publicDataProvider.queryContractState(
          passingContract.contractAddress,
        );
      const publicLogRecord = {
        event: "authenticated_credential_proof_finalized",
        contractAddress: passingContract.contractAddress,
        txId: passingTransaction.txId,
        minimumDurationMonths: "6",
        successfulCredentialProofs: "1",
      };
      const passingPrivacyFindings = inspectForPrivateArtifacts(
        {
          deploymentTransaction: passingDeployData,
          callTransaction: passingFinalizedData,
          contractLedger: passingStateAfter,
          publicDataProviderResponse: passingPublicDataResponse,
          contractApiReturnValue: passingTransaction.returnValue,
          applicationLog: publicLogRecord,
        },
        {
          bytes: [
            passingBundle.credential.credentialId,
            passingBundle.credential.holderCommitment,
            passingBundle.privateState.holderSecret,
          ],
          scalars: [
            passingBundle.credential.durationMonths,
            passingBundle.privateState.issuerSignature.response,
            passingBundle.privateState.issuerSignature.announcement.x,
            passingBundle.privateState.issuerSignature.announcement.y,
          ],
        },
      );
      assert.deepEqual(
        passingPrivacyFindings,
        [],
        "inspected public artifacts must not expose private credential data",
      );

      const boundaryBundle = createSignedBundle(6n, acceptedIssuer);
      const boundaryMetrics = createMetrics();
      const boundaryProviders = createAptorProviders(
        config,
        wallet,
        `${runId}/boundary`,
        boundaryMetrics,
      );
      const boundaryContract = await AptorCredentialApi.deploy(
        boundaryProviders,
        boundaryBundle.privateState,
        acceptedIssuer.publicKey,
      );
      const boundaryProofCallsBefore = boundaryMetrics.proveTxCalls;
      const boundarySubmissionsBefore = wallet.submittedTransactions;
      const boundaryTransaction =
        await boundaryContract.proveCredentialDuration(6n);
      assert.equal(boundaryMetrics.proveTxCalls, boundaryProofCallsBefore + 1);
      assert.equal(wallet.submittedTransactions, boundarySubmissionsBefore + 1);
      assert.ok(boundaryTransaction.txId);
      assert.equal(
        (await boundaryContract.publicState()).successfulCredentialProofs,
        1n,
      );

      const tamperedOriginal = createSignedBundle(12n, acceptedIssuer);
      const tamperedState = createCredentialPrivateState(
        { ...tamperedOriginal.credential, durationMonths: 24n },
        tamperedOriginal.privateState.issuerSignature,
        tamperedOriginal.privateState.holderSecret,
      );
      const tamperedMetrics = createMetrics();
      const tamperedProviders = createAptorProviders(
        config,
        wallet,
        `${runId}/tampered`,
        tamperedMetrics,
      );
      const tamperedContract = await AptorCredentialApi.deploy(
        tamperedProviders,
        tamperedState,
        acceptedIssuer.publicKey,
      );
      await assertLocalCredentialRejection(
        tamperedContract,
        tamperedMetrics,
        wallet,
        /Invalid issuer signature/,
      );

      const correctHolderBundle = createSignedBundle(12n, acceptedIssuer);
      const wrongHolderState = createCredentialPrivateState(
        correctHolderBundle.credential,
        correctHolderBundle.privateState.issuerSignature,
        createHolderSecret(),
      );
      const wrongHolderMetrics = createMetrics();
      const wrongHolderProviders = createAptorProviders(
        config,
        wallet,
        `${runId}/wrong-holder`,
        wrongHolderMetrics,
      );
      const wrongHolderContract = await AptorCredentialApi.deploy(
        wrongHolderProviders,
        wrongHolderState,
        acceptedIssuer.publicKey,
      );
      await assertLocalCredentialRejection(
        wrongHolderContract,
        wrongHolderMetrics,
        wallet,
        /Holder secret does not match the signed credential/,
      );

      const unacceptedIssuer = createIssuerKeyPair();
      const wrongIssuerBundle = createSignedBundle(12n, unacceptedIssuer);
      const wrongIssuerMetrics = createMetrics();
      const wrongIssuerProviders = createAptorProviders(
        config,
        wallet,
        `${runId}/wrong-issuer`,
        wrongIssuerMetrics,
      );
      const wrongIssuerContract = await AptorCredentialApi.deploy(
        wrongIssuerProviders,
        wrongIssuerBundle.privateState,
        acceptedIssuer.publicKey,
      );
      await assertLocalCredentialRejection(
        wrongIssuerContract,
        wrongIssuerMetrics,
        wallet,
        /Invalid issuer signature/,
      );

      const belowThresholdBundle = createSignedBundle(3n, acceptedIssuer);
      const belowThresholdMetrics = createMetrics();
      const belowThresholdProviders = createAptorProviders(
        config,
        wallet,
        `${runId}/below-threshold`,
        belowThresholdMetrics,
      );
      const belowThresholdContract = await AptorCredentialApi.deploy(
        belowThresholdProviders,
        belowThresholdBundle.privateState,
        acceptedIssuer.publicKey,
      );
      await assertLocalCredentialRejection(
        belowThresholdContract,
        belowThresholdMetrics,
        wallet,
        /Signed private duration does not satisfy the public minimum/,
      );

      console.info(
        JSON.stringify({
          event: "aptor_midnight_authenticated_credential_result",
          passing: {
            contractAddress: passingContract.contractAddress,
            deploymentTxId: passingContract.deploymentTransaction.txId,
            callTxId: passingTransaction.txId,
            counterBefore: "0",
            counterAfter: "1",
            proofProviderCalls: passingMetrics.proveTxCalls,
          },
          boundary: {
            contractAddress: boundaryContract.contractAddress,
            callTxId: boundaryTransaction.txId,
            counterBefore: "0",
            counterAfter: "1",
          },
          rejected: {
            tamperedCredential: "local-circuit-before-proof",
            wrongHolder: "local-circuit-before-proof",
            wrongIssuer: "local-circuit-before-proof",
            belowThreshold: "local-circuit-before-proof",
            countersChanged: false,
          },
          privacy: {
            inspectedPublicArtifactFindings: passingPrivacyFindings.length,
          },
        }),
      );
    } finally {
      await wallet.stop();
      await rm(privateStateRunRoot, { recursive: true, force: true });
    }
  },
);
