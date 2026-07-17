import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  buildAcceptedIssuerTree,
  buildSkillTree,
  canonicalSkillId,
  createCredentialPrivateState,
  createHolderSecret,
  createIssuerKeyPair,
  createProofRequest,
  createWorkCredential,
  deriveHolderCommitment,
  deriveIssuerMembershipPath,
  deriveSkillMembershipPath,
  signWorkCredential,
  type AptorCredentialPrivateState,
  type IssuerKeyPair,
  type ProofRequestV1,
  type SkillTree,
  type WorkCredentialV1,
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
  encodedScalars?: readonly bigint[];
}>;

type SignedNetworkBundle = Readonly<{
  credential: WorkCredentialV1;
  privateState: AptorCredentialPrivateState;
  skillTree: SkillTree;
}>;

function containsBytes(haystack: Uint8Array, needle: Uint8Array): boolean {
  if (needle.length === 0 || needle.length > haystack.length) return false;
  for (let start = 0; start <= haystack.length - needle.length; start += 1) {
    if (needle.every((byte, index) => haystack[start + index] === byte)) {
      return true;
    }
  }
  return false;
}

function scalarEncodings(value: bigint): readonly Uint8Array[] {
  const bigEndian = new Uint8Array(32);
  let remaining = value;
  for (let index = bigEndian.length - 1; index >= 0; index -= 1) {
    bigEndian[index] = Number(remaining & 0xffn);
    remaining >>= 8n;
  }
  if (remaining !== 0n) throw new RangeError("private scalar exceeds 32 bytes");
  return [bigEndian, new Uint8Array(bigEndian).reverse()];
}

function inspectForPrivateArtifacts(
  value: unknown,
  needles: PrivateNeedles,
  currentPath = "public",
  findings: PublicInspectionFinding[] = [],
  seen = new WeakSet<object>(),
  byteNeedles: readonly Uint8Array[] = [
    ...needles.bytes,
    ...(needles.encodedScalars ?? []).flatMap(scalarEncodings),
  ],
): PublicInspectionFinding[] {
  if (typeof value === "bigint" && needles.scalars.includes(value)) {
    findings.push({ path: currentPath, reason: "private scalar matched" });
    return findings;
  }
  if (typeof value === "string") {
    const normalized = value.toLowerCase();
    if (
      byteNeedles.some((needle) =>
        normalized.includes(Buffer.from(needle).toString("hex")),
      )
    ) {
      findings.push({
        path: currentPath,
        reason: "hex-encoded private bytes matched",
      });
    }
    return findings;
  }
  if (value instanceof Uint8Array) {
    if (byteNeedles.some((needle) => containsBytes(value, needle))) {
      findings.push({ path: currentPath, reason: "private bytes matched" });
    }
    return findings;
  }
  if (value === null || value === undefined || typeof value !== "object") {
    return findings;
  }
  if (seen.has(value)) return findings;
  seen.add(value);

  if (value instanceof Map) {
    for (const [key, child] of value.entries()) {
      inspectForPrivateArtifacts(
        child,
        needles,
        `${currentPath}.map[${String(key)}]`,
        findings,
        seen,
        byteNeedles,
      );
    }
    return findings;
  }

  for (const [key, child] of Object.entries(value)) {
    if (
      /^(credentialId|holderSecret|holderCommitment|issuerPublicKey|issuerSignature|issuerMembershipPath|skillsRoot|privateSkills|requiredSkillMembershipPath|durationMonths|deliveredToProduction|clientRatingHundredths)$/i.test(
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
      byteNeedles,
    );
  }
  return findings;
}

function createMetrics(): ProofInvocationMetrics {
  return { proveTxCalls: 0 };
}

function createSignedBundle(
  issuer: IssuerKeyPair,
  acceptedIssuerTree: ReturnType<typeof buildAcceptedIssuerTree>,
  issuerPathTree = acceptedIssuerTree,
): SignedNetworkBundle {
  const holderSecret = createHolderSecret();
  const skillTree = buildSkillTree([
    "Rust",
    "Cryptography",
    "Distributed Systems",
  ]);
  const credential = createWorkCredential({
    holderCommitment: deriveHolderCommitment(holderSecret),
    skillsRoot: skillTree.root,
    durationMonths: 12n,
    deliveredToProduction: true,
    clientRatingHundredths: 475n,
  });
  const issuerSignature = signWorkCredential(credential, issuer.signingKey);
  return {
    credential,
    skillTree,
    privateState: createCredentialPrivateState({
      credential,
      issuerPublicKey: issuer.publicKey,
      issuerSignature,
      issuerMembershipPath: deriveIssuerMembershipPath(
        issuerPathTree,
        issuer.publicKey,
      ),
      holderSecret,
      privateSkills: skillTree.leaves,
      requiredSkillMembershipPath: deriveSkillMembershipPath(skillTree, "Rust"),
    }),
  };
}

function createCompleteRequest(
  acceptedIssuerRoot: ReturnType<typeof buildAcceptedIssuerTree>["root"],
  overrides: Partial<ProofRequestV1> = {},
): ProofRequestV1 {
  return {
    ...createProofRequest({
      acceptedIssuerRoot,
      checkSkill: true,
      requiredSkillId: canonicalSkillId("Rust"),
      checkDuration: true,
      minimumDurationMonths: 6n,
      requireProductionDelivery: true,
      checkClientRating: true,
      minimumClientRatingHundredths: 450n,
    }),
    ...overrides,
  };
}

async function assertLocalRequestRejection(
  contract: AptorCredentialApi,
  request: ProofRequestV1,
  metrics: ProofInvocationMetrics,
  wallet: LocalWalletProvider,
  expectedError: RegExp,
): Promise<void> {
  const proofCallsBefore = metrics.proveTxCalls;
  const submissionsBefore = wallet.submittedTransactions;
  const stateBefore = await contract.publicState();
  assert.equal(stateBefore.fulfilledRequests.member(request.requestId), false);

  await assert.rejects(
    contract.proveAgainstRequest(request),
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
    (await contract.publicState()).fulfilledRequests.member(request.requestId),
    false,
    "failed request must remain unfulfilled",
  );
}

test(
  "registers and privately fulfills request-bound Aptor capability proofs",
  { timeout: 1_800_000 },
  async () => {
    await assertLocalNetworkHealthy();
    const config = localMidnightConfig();
    const runId = `capability-network-${Date.now().toString(36)}`;
    const privateStateRunRoot = path.resolve(config.privateStateRoot, runId);
    const wallet = await LocalWalletProvider.build(
      environmentConfiguration(config),
    );
    const acceptedIssuers = [
      createIssuerKeyPair(),
      createIssuerKeyPair(),
      createIssuerKeyPair(),
    ];
    const acceptedIssuerTree = buildAcceptedIssuerTree(
      acceptedIssuers.map((issuer) => issuer.publicKey),
    );
    const passingBundle = createSignedBundle(
      acceptedIssuers[1],
      acceptedIssuerTree,
    );

    try {
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
      );
      const initialState = await passingContract.publicState();
      assert.equal(initialState.requestCommitments.size(), 0n);
      assert.equal(initialState.fulfilledRequests.size(), 0n);

      const passingRequest = createCompleteRequest(acceptedIssuerTree.root);
      const requestProofCallsBefore = passingMetrics.proveTxCalls;
      const requestSubmissionsBefore = wallet.submittedTransactions;
      const requestTransaction =
        await passingContract.createProofRequest(passingRequest);
      assert.equal(
        passingMetrics.proveTxCalls,
        requestProofCallsBefore + 1,
        "request registration must use the proof provider",
      );
      assert.equal(
        wallet.submittedTransactions,
        requestSubmissionsBefore + 1,
        "request registration must submit a transaction",
      );
      const registeredState = await passingContract.publicState();
      assert.equal(
        registeredState.requestCommitments.member(passingRequest.requestId),
        true,
      );
      assert.deepEqual(
        registeredState.requestCommitments.lookup(passingRequest.requestId),
        requestTransaction.requestCommitment,
      );
      assert.equal(
        registeredState.fulfilledRequests.member(passingRequest.requestId),
        false,
      );

      const proofCallsBefore = passingMetrics.proveTxCalls;
      const submissionsBefore = wallet.submittedTransactions;
      const proofTransaction =
        await passingContract.proveAgainstRequest(passingRequest);
      assert.equal(passingMetrics.proveTxCalls, proofCallsBefore + 1);
      assert.equal(wallet.submittedTransactions, submissionsBefore + 1);
      assert.equal(proofTransaction.fulfilled, true);
      assert.ok(proofTransaction.txId);
      const fulfilledState = await passingContract.publicState();
      assert.equal(
        fulfilledState.fulfilledRequests.member(passingRequest.requestId),
        true,
      );

      const replayProofCalls = passingMetrics.proveTxCalls;
      const replaySubmissions = wallet.submittedTransactions;
      await assert.rejects(
        passingContract.proveAgainstRequest(passingRequest),
        /Proof request is already fulfilled/,
      );
      assert.equal(passingMetrics.proveTxCalls, replayProofCalls);
      assert.equal(wallet.submittedTransactions, replaySubmissions);
      assert.equal(
        (await passingContract.publicState()).fulfilledRequests.member(
          passingRequest.requestId,
        ),
        true,
      );

      const tamperedBaseRequest = createCompleteRequest(
        acceptedIssuerTree.root,
      );
      const tamperedRegistration =
        await passingContract.createProofRequest(tamperedBaseRequest);
      const tamperedRequest = {
        ...tamperedBaseRequest,
        minimumClientRatingHundredths: 451n,
      };
      await assertLocalRequestRejection(
        passingContract,
        tamperedRequest,
        passingMetrics,
        wallet,
        /does not match its registered commitment/,
      );

      const missingSkillRequest = createCompleteRequest(
        acceptedIssuerTree.root,
        { requiredSkillId: canonicalSkillId("Go") },
      );
      const missingSkillRegistration =
        await passingContract.createProofRequest(missingSkillRequest);
      await assertLocalRequestRejection(
        passingContract,
        missingSkillRequest,
        passingMetrics,
        wallet,
        /Skill membership path is for a different skill/,
      );

      const untrustedIssuer = createIssuerKeyPair();
      const untrustedPathTree = buildAcceptedIssuerTree([
        untrustedIssuer.publicKey,
        createIssuerKeyPair().publicKey,
      ]);
      const untrustedBundle = createSignedBundle(
        untrustedIssuer,
        acceptedIssuerTree,
        untrustedPathTree,
      );
      const untrustedMetrics = createMetrics();
      const untrustedProviders = createAptorProviders(
        config,
        wallet,
        `${runId}/untrusted`,
        untrustedMetrics,
      );
      const untrustedContract = await AptorCredentialApi.deploy(
        untrustedProviders,
        untrustedBundle.privateState,
      );
      const untrustedRequest = createCompleteRequest(acceptedIssuerTree.root);
      const untrustedRegistration =
        await untrustedContract.createProofRequest(untrustedRequest);
      await assertLocalRequestRejection(
        untrustedContract,
        untrustedRequest,
        untrustedMetrics,
        wallet,
        /Credential issuer is not in the accepted issuer set/,
      );

      const requestFinalizedData =
        await passingProviders.publicDataProvider.watchForTxData(
          requestTransaction.txId,
        );
      const proofFinalizedData =
        await passingProviders.publicDataProvider.watchForTxData(
          proofTransaction.txId,
        );
      const passingPublicDataResponse =
        await passingProviders.publicDataProvider.queryContractState(
          passingContract.contractAddress,
        );
      const publicLogRecord = {
        event: "aptor_request_fulfilled",
        contractAddress: passingContract.contractAddress,
        requestId: Buffer.from(passingRequest.requestId).toString("hex"),
        requestCommitment: Buffer.from(
          requestTransaction.requestCommitment,
        ).toString("hex"),
        acceptedIssuerRoot: passingRequest.acceptedIssuerRoot.field.toString(),
        checkSkill: passingRequest.checkSkill,
        requiredSkillId: Buffer.from(passingRequest.requiredSkillId).toString(
          "hex",
        ),
        minimumDurationMonths: passingRequest.minimumDurationMonths.toString(),
        requireProductionDelivery: passingRequest.requireProductionDelivery,
        minimumClientRatingHundredths:
          passingRequest.minimumClientRatingHundredths.toString(),
        txId: proofTransaction.txId,
        fulfilled: true,
      };
      const nonRequestedSkills = passingBundle.skillTree.skills.filter(
        (skill) => skill.normalized !== "rust",
      );
      const privatePathScalars = [
        ...passingBundle.privateState.issuerMembershipPath.path.map(
          (entry) => entry.sibling.field,
        ),
        ...passingBundle.privateState.requiredSkillMembershipPath.path.map(
          (entry) => entry.sibling.field,
        ),
      ];
      const privacyFindings = inspectForPrivateArtifacts(
        {
          requestCreationTransaction: requestFinalizedData,
          proofTransaction: proofFinalizedData,
          decodedLedger: fulfilledState,
          publicDataProviderResult: passingPublicDataResponse,
          requestApiResult: requestTransaction,
          proofApiResult: proofTransaction,
          applicationLog: publicLogRecord,
        },
        {
          bytes: [
            passingBundle.credential.credentialId,
            passingBundle.credential.holderCommitment,
            passingBundle.privateState.holderSecret,
            ...nonRequestedSkills.map((skill) => skill.id),
          ],
          scalars: [
            passingBundle.credential.skillsRoot.field,
            passingBundle.credential.durationMonths,
            passingBundle.credential.clientRatingHundredths,
            passingBundle.privateState.issuerPublicKey.x,
            passingBundle.privateState.issuerPublicKey.y,
            passingBundle.privateState.issuerSignature.response,
            passingBundle.privateState.issuerSignature.announcement.x,
            passingBundle.privateState.issuerSignature.announcement.y,
            ...privatePathScalars,
          ],
          encodedScalars: [
            passingBundle.credential.skillsRoot.field,
            passingBundle.privateState.issuerPublicKey.x,
            passingBundle.privateState.issuerPublicKey.y,
            passingBundle.privateState.issuerSignature.response,
            passingBundle.privateState.issuerSignature.announcement.x,
            passingBundle.privateState.issuerSignature.announcement.y,
            ...privatePathScalars,
          ],
        },
      );
      assert.deepEqual(
        privacyFindings,
        [],
        "inspected public artifacts must not expose private capability data",
      );

      console.info(
        JSON.stringify({
          event: "aptor_midnight_request_bound_result",
          passing: {
            contractAddress: passingContract.contractAddress,
            deploymentTxId: passingContract.deploymentTransaction.txId,
            deploymentBlockHeight:
              passingContract.deploymentTransaction.blockHeight,
            requestCreationTxId: requestTransaction.txId,
            requestCreationBlockHeight: requestTransaction.blockHeight,
            proofTxId: proofTransaction.txId,
            proofBlockHeight: proofTransaction.blockHeight,
            requestRegistered: true,
            requestFulfilled: true,
          },
          replay: "local-circuit-before-proof",
          tamperedRequest: {
            requestCreationTxId: tamperedRegistration.txId,
            failure: "local-circuit-before-proof",
            fulfilled: false,
          },
          missingSkill: {
            requestCreationTxId: missingSkillRegistration.txId,
            failure: "local-circuit-before-proof",
            fulfilled: false,
          },
          untrustedIssuer: {
            contractAddress: untrustedContract.contractAddress,
            requestCreationTxId: untrustedRegistration.txId,
            failure: "local-circuit-before-proof",
            fulfilled: false,
          },
          privacy: {
            inspectedPublicArtifactFindings: privacyFindings.length,
          },
        }),
      );
    } finally {
      await wallet.stop();
      await rm(privateStateRunRoot, { recursive: true, force: true });
    }
  },
);
