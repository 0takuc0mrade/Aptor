import assert from "node:assert/strict";
import { describe, it } from "node:test";

import * as compactRuntime from "@midnight-ntwrk/compact-runtime";
import type {
  JubjubPoint,
  MerkleTreePath,
} from "@midnight-ntwrk/compact-runtime";

import {
  Contract,
  ledger,
  pureCircuits,
  type ProofRequestV1,
  type WorkCredentialV1,
} from "../generated/aptor/contract/index.js";
import {
  buildAcceptedIssuerTree,
  buildSkillTree,
  canonicalSkillId,
  createWorkCredential,
  deriveIssuerMembershipPath,
  deriveIssuerPublicKey,
  deriveSkillMembershipPath,
  deriveWorkCredentialDigest,
  encodeNormalizedSkill,
  normalizeSkillDisplay,
  verifyWorkCredentialSignature,
} from "../src/issuer.ts";
import { MERKLE_TREE_CAPACITY, MERKLE_TREE_DEPTH } from "../src/merkle.ts";
import {
  createProofRequest,
  deriveProofRequestCommitment,
} from "../src/request.ts";
import {
  createCredentialPrivateState,
  witnesses,
  type AptorCredentialPrivateState,
} from "../src/witnesses.ts";
import {
  createCompleteFixture,
  fixedBytes,
  TEST_ISSUER_SIGNING_KEYS,
  TEST_SIGNING_KEY,
  TEST_UNTRUSTED_SIGNING_KEY,
  type CompleteFixture,
} from "./fixtures.ts";

function createExecution(privateState: AptorCredentialPrivateState) {
  const contract = new Contract(witnesses);
  const initial = contract.initialState(
    compactRuntime.createConstructorContext(privateState, {
      bytes: new Uint8Array(32),
    }),
  );
  const context = compactRuntime.createCircuitContext(
    compactRuntime.dummyContractAddress(),
    initial.currentZswapLocalState,
    initial.currentContractState.data,
    initial.currentPrivateState,
  );
  return { contract, context };
}

function registerFixture(
  fixture: CompleteFixture,
  request = fixture.request,
  commitment = deriveProofRequestCommitment(request),
) {
  const execution = createExecution(fixture.privateState);
  const registration = execution.contract.provableCircuits.createProofRequest(
    execution.context,
    request.requestId,
    commitment,
  );
  return { ...execution, registration };
}

function proveFixture(
  fixture: CompleteFixture,
  request = fixture.request,
  commitment = deriveProofRequestCommitment(request),
) {
  const registered = registerFixture(fixture, request, commitment);
  const proof = registered.contract.provableCircuits.proveAgainstRequest(
    registered.registration.context,
    request,
  );
  return { ...registered, proof };
}

function withPrivateState(
  fixture: CompleteFixture,
  overrides: Partial<AptorCredentialPrivateState>,
): AptorCredentialPrivateState {
  return createCredentialPrivateState({
    ...fixture.privateState,
    ...overrides,
  });
}

function withCredential(
  fixture: CompleteFixture,
  credential: WorkCredentialV1,
): AptorCredentialPrivateState {
  return withPrivateState(fixture, { credential });
}

function clonePointPath(
  path: MerkleTreePath<JubjubPoint>,
): MerkleTreePath<JubjubPoint> {
  return {
    leaf: { x: path.leaf.x, y: path.leaf.y },
    path: path.path.map((entry) => ({
      sibling: { field: entry.sibling.field },
      goes_left: entry.goes_left,
    })),
  };
}

function cloneBytesPath(
  path: MerkleTreePath<Uint8Array>,
): MerkleTreePath<Uint8Array> {
  return {
    leaf: new Uint8Array(path.leaf),
    path: path.path.map((entry) => ({
      sibling: { field: entry.sibling.field },
      goes_left: entry.goes_left,
    })),
  };
}

function publicLedger(context: ReturnType<typeof createExecution>["context"]) {
  return ledger(context.currentQueryContext.state.state);
}

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
  needles: Readonly<{
    bytes: readonly Uint8Array[];
    scalars: readonly bigint[];
    encodedScalars?: readonly bigint[];
  }>,
  currentPath = "public",
  findings: string[] = [],
  seen = new WeakSet<object>(),
  byteNeedles: readonly Uint8Array[] = [
    ...needles.bytes,
    ...(needles.encodedScalars ?? []).flatMap(scalarEncodings),
  ],
): string[] {
  if (typeof value === "bigint" && needles.scalars.includes(value)) {
    findings.push(`${currentPath}: private scalar`);
    return findings;
  }
  if (typeof value === "string") {
    const normalized = value.toLowerCase();
    if (
      byteNeedles.some((needle) =>
        normalized.includes(Buffer.from(needle).toString("hex")),
      )
    ) {
      findings.push(`${currentPath}: hex-encoded private bytes`);
    }
    return findings;
  }
  if (value instanceof Uint8Array) {
    if (byteNeedles.some((needle) => containsBytes(value, needle))) {
      findings.push(`${currentPath}: private bytes`);
    }
    return findings;
  }
  if (value === null || typeof value !== "object") return findings;
  if (seen.has(value)) return findings;
  seen.add(value);

  for (const [key, child] of Object.entries(value)) {
    if (
      /^(credentialId|holderSecret|holderCommitment|issuerPublicKey|issuerSignature|issuerMembershipPath|skillsRoot|privateSkills|requiredSkillMembershipPath|durationMonths|deliveredToProduction|clientRatingHundredths)$/i.test(
        key,
      )
    ) {
      findings.push(`${currentPath}.${key}: private field name`);
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

describe("Aptor request-bound capability contract", () => {
  it("fulfills a complete Rust, duration, production, and rating request", () => {
    const fixture = createCompleteFixture();
    const { registration, proof } = proveFixture(fixture);
    const registeredLedger = publicLedger(registration.context);
    const fulfilledLedger = publicLedger(proof.context);

    assert.deepEqual(proof.result, []);
    assert.equal(registeredLedger.requestCommitments.size(), 1n);
    assert.equal(registeredLedger.fulfilledRequests.size(), 0n);
    assert.deepEqual(
      registeredLedger.requestCommitments.lookup(fixture.request.requestId),
      fixture.requestCommitment,
    );
    assert.equal(
      fulfilledLedger.fulfilledRequests.member(fixture.request.requestId),
      true,
    );
  });

  it("does not enforce disabled predicate placeholders", () => {
    const fixture = createCompleteFixture();
    const request = createProofRequest({
      requestId: fixedBytes(0x62),
      acceptedIssuerRoot: fixture.acceptedIssuerTree.root,
      checkSkill: false,
      checkDuration: false,
      minimumDurationMonths: 65_535n,
      requireProductionDelivery: true,
      checkClientRating: false,
      minimumClientRatingHundredths: 65_535n,
    });

    assert.deepEqual(proveFixture(fixture, request).proof.result, []);
  });

  it("normalizes skills with NFKC, trimming, lowercasing, and collapsed whitespace", () => {
    const canonical = canonicalSkillId("rust");
    for (const variant of ["Rust", "rust", " RUST ", "ＲＵＳＴ"]) {
      assert.equal(normalizeSkillDisplay(variant), "rust");
      assert.deepEqual(canonicalSkillId(variant), canonical);
    }
    assert.equal(
      normalizeSkillDisplay("  Distributed\t  Systems  "),
      "distributed systems",
    );
    assert.throws(() => canonicalSkillId(" \t "), /must not be empty/);
  });

  it("deduplicates normalized skills, sorts deterministically, and enforces capacity", () => {
    const unique = buildSkillTree(["Rust", "Cryptography"]);
    const duplicated = buildSkillTree([
      " cryptography ",
      "RUST",
      "Rust",
      "Cryptography",
    ]);
    assert.equal(MERKLE_TREE_DEPTH, 5);
    assert.equal(MERKLE_TREE_CAPACITY, 32);
    assert.deepEqual(duplicated.root, unique.root);
    assert.equal(duplicated.leaves.length, 2);
    assert.throws(() => buildSkillTree([]), /at least one leaf/);
    assert.throws(
      () =>
        buildSkillTree(
          Array.from({ length: 33 }, (_value, index) => `skill ${index}`),
        ),
      /at most 32 leaves/,
    );
  });

  it("matches TypeScript and Compact skill identifiers and Merkle roots", () => {
    const fixture = createCompleteFixture();
    const encoded = encodeNormalizedSkill(" Rust ");
    assert.deepEqual(
      encoded.id,
      pureCircuits.deriveCanonicalSkillId(
        encoded.paddedBytes,
        encoded.byteLength,
      ),
    );
    assert.deepEqual(
      pureCircuits.deriveSkillPathRoot(
        deriveSkillMembershipPath(fixture.skillTree, "Rust"),
      ),
      fixture.skillTree.root,
    );
    assert.deepEqual(
      pureCircuits.deriveIssuerPathRoot(
        deriveIssuerMembershipPath(
          fixture.acceptedIssuerTree,
          fixture.issuerPublicKey,
        ),
      ),
      fixture.acceptedIssuerTree.root,
    );
  });

  it("matches TypeScript and generated Compact credential and request digests", () => {
    const fixture = createCompleteFixture();
    const credentialDigest = deriveWorkCredentialDigest(fixture.credential);
    const requestCommitment = deriveProofRequestCommitment(fixture.request);

    assert.deepEqual(
      credentialDigest,
      pureCircuits.deriveWorkCredentialDigest(fixture.credential),
    );
    assert.deepEqual(
      requestCommitment,
      pureCircuits.deriveProofRequestCommitment(fixture.request),
    );
  });

  it("signs and verifies the complete canonical credential", () => {
    const fixture = createCompleteFixture();
    assert.equal(
      verifyWorkCredentialSignature(
        fixture.credential,
        fixture.privateState.issuerSignature,
        fixture.issuerPublicKey,
      ),
      true,
    );
  });

  it("rejects a required skill absent from the signed skill root", () => {
    const fixture = createCompleteFixture();
    const request = {
      ...fixture.request,
      requestId: fixedBytes(0x63),
      requiredSkillId: canonicalSkillId("Go"),
    };
    const registered = registerFixture(fixture, request);

    assert.throws(
      () =>
        registered.contract.provableCircuits.proveAgainstRequest(
          registered.registration.context,
          request,
        ),
      /Skill membership path is for a different skill/,
    );
    assert.equal(
      publicLedger(registered.registration.context).fulfilledRequests.size(),
      0n,
    );
  });

  it("rejects a correct skill with a path from a different tree", () => {
    const fixture = createCompleteFixture();
    const otherTree = buildSkillTree(["Rust", "Go", "TypeScript"]);
    const invalidState = withPrivateState(fixture, {
      requiredSkillMembershipPath: deriveSkillMembershipPath(otherTree, "Rust"),
    });
    const invalidFixture = { ...fixture, privateState: invalidState };

    assert.throws(
      () => proveFixture(invalidFixture),
      /Required skill is not in the signed credential/,
    );
  });

  it("rejects duration, production, and rating failures", () => {
    const failures: readonly [CompleteFixture, RegExp][] = [
      [
        createCompleteFixture({ durationMonths: 3n }),
        /Signed private duration does not satisfy the request/,
      ],
      [
        createCompleteFixture({ deliveredToProduction: false }),
        /does not confirm production delivery/,
      ],
      [
        createCompleteFixture({ clientRatingHundredths: 425n }),
        /Signed private rating does not satisfy the request/,
      ],
    ];
    for (const [fixture, expected] of failures) {
      assert.throws(() => proveFixture(fixture), expected);
    }
  });

  it("rejects ratings outside the 0–500 credential range", () => {
    const fixture = createCompleteFixture();
    assert.throws(
      () =>
        createWorkCredential({
          ...fixture.credential,
          clientRatingHundredths: 501n,
        }),
      /between 0 and 500/,
    );
    assert.throws(
      () =>
        createProofRequest({
          requestId: fixedBytes(0x64),
          acceptedIssuerRoot: fixture.acceptedIssuerTree.root,
          checkSkill: false,
          checkDuration: false,
          minimumDurationMonths: 0n,
          requireProductionDelivery: false,
          checkClientRating: true,
          minimumClientRatingHundredths: 501n,
        }),
      /between 0 and 500/,
    );
  });

  it("rejects a valid signature from an issuer outside the accepted root", () => {
    const untrustedFixture = createCompleteFixture({
      signingKey: TEST_UNTRUSTED_SIGNING_KEY,
      acceptedSigningKeys: [TEST_UNTRUSTED_SIGNING_KEY, 7_771_001n],
    });
    const trustedRoot = buildAcceptedIssuerTree(
      TEST_ISSUER_SIGNING_KEYS.map(deriveIssuerPublicKey),
    ).root;
    const request = {
      ...untrustedFixture.request,
      acceptedIssuerRoot: trustedRoot,
    };

    assert.throws(
      () => proveFixture(untrustedFixture, request),
      /Credential issuer is not in the accepted issuer set/,
    );
  });

  it("rejects an accepted issuer with an invalid membership path", () => {
    const fixture = createCompleteFixture();
    const otherTree = buildAcceptedIssuerTree([
      fixture.issuerPublicKey,
      deriveIssuerPublicKey(7_771_001n),
      deriveIssuerPublicKey(7_771_003n),
    ]);
    const invalidState = withPrivateState(fixture, {
      issuerMembershipPath: deriveIssuerMembershipPath(
        otherTree,
        fixture.issuerPublicKey,
      ),
    });

    assert.throws(
      () => proveFixture({ ...fixture, privateState: invalidState }),
      /Credential issuer is not in the accepted issuer set/,
    );
  });

  it("rejects every protected credential field after signing", () => {
    const fixture = createCompleteFixture();
    const otherSkillRoot = buildSkillTree(["Go", "TypeScript"]).root;
    const tamperedCredentials: readonly [string, WorkCredentialV1][] = [
      [
        "credential ID",
        { ...fixture.credential, credentialId: fixedBytes(0xa1) },
      ],
      [
        "holder commitment",
        { ...fixture.credential, holderCommitment: fixedBytes(0xa2) },
      ],
      ["skills root", { ...fixture.credential, skillsRoot: otherSkillRoot }],
      ["duration", { ...fixture.credential, durationMonths: 13n }],
      [
        "production status",
        { ...fixture.credential, deliveredToProduction: false },
      ],
      ["rating", { ...fixture.credential, clientRatingHundredths: 474n }],
    ];

    for (const [field, credential] of tamperedCredentials) {
      assert.equal(
        verifyWorkCredentialSignature(
          credential,
          fixture.privateState.issuerSignature,
          fixture.issuerPublicKey,
        ),
        false,
        `${field} must invalidate off-chain verification`,
      );
      const privateState = withCredential(fixture, credential);
      assert.throws(
        () => proveFixture({ ...fixture, privateState }),
        /Invalid issuer signature/,
        `${field} must invalidate Compact verification`,
      );
    }
  });

  it("rejects every altered request field after commitment registration", () => {
    const fixture = createCompleteFixture();
    const alternativeIssuerRoot = buildAcceptedIssuerTree([
      deriveIssuerPublicKey(7_771_101n),
      deriveIssuerPublicKey(7_771_103n),
    ]).root;
    const alteredRequests: readonly [string, ProofRequestV1][] = [
      [
        "required skill",
        { ...fixture.request, requiredSkillId: canonicalSkillId("Go") },
      ],
      ["duration threshold", { ...fixture.request, minimumDurationMonths: 7n }],
      [
        "production requirement",
        { ...fixture.request, requireProductionDelivery: false },
      ],
      [
        "rating threshold",
        { ...fixture.request, minimumClientRatingHundredths: 451n },
      ],
      [
        "accepted issuer root",
        { ...fixture.request, acceptedIssuerRoot: alternativeIssuerRoot },
      ],
      ["skill flag", { ...fixture.request, checkSkill: false }],
      ["duration flag", { ...fixture.request, checkDuration: false }],
      ["rating flag", { ...fixture.request, checkClientRating: false }],
    ];

    for (const [field, altered] of alteredRequests) {
      const registered = registerFixture(
        fixture,
        fixture.request,
        fixture.requestCommitment,
      );
      assert.throws(
        () =>
          registered.contract.provableCircuits.proveAgainstRequest(
            registered.registration.context,
            altered,
          ),
        /does not match its registered commitment/,
        `${field} must fail request commitment verification`,
      );
      assert.equal(
        publicLedger(registered.registration.context).fulfilledRequests.size(),
        0n,
      );
    }

    const registered = registerFixture(
      fixture,
      fixture.request,
      fixture.requestCommitment,
    );
    const alteredRequestId = {
      ...fixture.request,
      requestId: fixedBytes(0xa3),
    };
    assert.throws(
      () =>
        registered.contract.provableCircuits.proveAgainstRequest(
          registered.registration.context,
          alteredRequestId,
        ),
      /Proof request is not registered/,
      "request ID must not be substitutable after registration",
    );
    assert.equal(
      publicLedger(registered.registration.context).fulfilledRequests.size(),
      0n,
    );
  });

  it("rejects a different holder secret", () => {
    const fixture = createCompleteFixture();
    const privateState = withPrivateState(fixture, {
      holderSecret: fixedBytes(0x99),
    });
    assert.throws(
      () => proveFixture({ ...fixture, privateState }),
      /Holder secret does not match the signed credential/,
    );
  });

  it("rejects duplicate request registration", () => {
    const fixture = createCompleteFixture();
    const registered = registerFixture(fixture);
    assert.throws(
      () =>
        registered.contract.provableCircuits.createProofRequest(
          registered.registration.context,
          fixture.request.requestId,
          fixture.requestCommitment,
        ),
      /Proof request already exists/,
    );
    assert.equal(
      publicLedger(registered.registration.context).requestCommitments.size(),
      1n,
    );
  });

  it("rejects replay after one successful fulfillment", () => {
    const fixture = createCompleteFixture();
    const fulfilled = proveFixture(fixture);
    assert.throws(
      () =>
        fulfilled.contract.provableCircuits.proveAgainstRequest(
          fulfilled.proof.context,
          fixture.request,
        ),
      /Proof request is already fulfilled/,
    );
    assert.equal(
      publicLedger(fulfilled.proof.context).fulfilledRequests.size(),
      1n,
    );
  });

  it("rejects a request with no active requirements", () => {
    const fixture = createCompleteFixture();
    assert.throws(
      () =>
        createProofRequest({
          requestId: fixedBytes(0x65),
          acceptedIssuerRoot: fixture.acceptedIssuerTree.root,
          checkSkill: false,
          checkDuration: false,
          minimumDurationMonths: 0n,
          requireProductionDelivery: false,
          checkClientRating: false,
          minimumClientRatingHundredths: 0n,
        }),
      /at least one requirement/,
    );

    const inactive: ProofRequestV1 = {
      ...fixture.request,
      checkSkill: false,
      checkDuration: false,
      requireProductionDelivery: false,
      checkClientRating: false,
    };
    const commitment = pureCircuits.deriveProofRequestCommitment(inactive);
    const registered = registerFixture(fixture, inactive, commitment);
    assert.throws(
      () =>
        registered.contract.provableCircuits.proveAgainstRequest(
          registered.registration.context,
          inactive,
        ),
      /must enable at least one requirement/,
    );
  });

  it("keeps issuer and credential material out of public circuit surfaces", () => {
    const fixture = createCompleteFixture();
    const { proof } = proveFixture(fixture);
    const visible = {
      circuitInput: proof.proofData.input,
      circuitOutput: proof.proofData.output,
      publicTranscript: proof.proofData.publicTranscript,
      returnedValue: proof.result,
      ledger: publicLedger(proof.context),
    };
    const nonRequestedSkill = fixture.skillTree.skills.find(
      (skill) => skill.normalized !== "rust",
    );
    assert.ok(nonRequestedSkill);
    const findings = inspectForPrivateArtifacts(visible, {
      bytes: [
        fixture.credential.credentialId,
        fixture.credential.holderCommitment,
        fixture.privateState.holderSecret,
        nonRequestedSkill.id,
      ],
      scalars: [
        fixture.credential.skillsRoot.field,
        fixture.credential.durationMonths,
        fixture.credential.clientRatingHundredths,
        fixture.issuerPublicKey.x,
        fixture.issuerPublicKey.y,
        fixture.privateState.issuerSignature.response,
        fixture.privateState.issuerSignature.announcement.x,
        fixture.privateState.issuerSignature.announcement.y,
      ],
      encodedScalars: [
        fixture.credential.skillsRoot.field,
        fixture.issuerPublicKey.x,
        fixture.issuerPublicKey.y,
        fixture.privateState.issuerSignature.response,
        fixture.privateState.issuerSignature.announcement.x,
        fixture.privateState.issuerSignature.announcement.y,
      ],
    });

    assert.deepEqual(findings, []);
    assert.deepEqual(Object.keys(publicLedger(proof.context)), [
      "requestCommitments",
      "fulfilledRequests",
    ]);
    assert.ok(proof.proofData.privateTranscriptOutputs.length > 0);
  });

  it("requires fixed depth paths in private state", () => {
    const fixture = createCompleteFixture();
    const issuerPath = clonePointPath(
      fixture.privateState.issuerMembershipPath,
    );
    const skillPath = cloneBytesPath(
      fixture.privateState.requiredSkillMembershipPath,
    );
    issuerPath.path.pop();
    skillPath.path.pop();

    assert.throws(
      () =>
        createCredentialPrivateState({
          ...fixture.privateState,
          issuerMembershipPath: issuerPath,
        }),
      /must contain 5 entries/,
    );
    assert.throws(
      () =>
        createCredentialPrivateState({
          ...fixture.privateState,
          requiredSkillMembershipPath: skillPath,
        }),
      /must contain 5 entries/,
    );
  });

  it("rejects an issuer path for a different public key", () => {
    const fixture = createCompleteFixture();
    const otherTree = buildAcceptedIssuerTree([
      deriveIssuerPublicKey(TEST_SIGNING_KEY),
      deriveIssuerPublicKey(TEST_ISSUER_SIGNING_KEYS[0]),
    ]);
    const otherKey = deriveIssuerPublicKey(TEST_ISSUER_SIGNING_KEYS[0]);
    const privateState = withPrivateState(fixture, {
      issuerMembershipPath: deriveIssuerMembershipPath(otherTree, otherKey),
    });

    assert.throws(
      () => proveFixture({ ...fixture, privateState }),
      /Issuer membership path is for a different public key/,
    );
  });
});
