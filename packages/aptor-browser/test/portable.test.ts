import assert from "node:assert/strict";
import test from "node:test";

import {
  createIssuerVault,
  createPrivateStateForRequest,
  createProfessionalVault,
  credentialSatisfiesRequest,
  decryptCredentialPackage,
  encryptCredentialPackage,
  finalizeRequestPackage,
  issueCredential,
  parseCredentialFile,
  parseHolderFile,
  parseIssuerFile,
  parsePortableFile,
  parseRequestFile,
  serializePortableFile,
  validateCredentialForHolder,
  validateRequestPackage,
  validateSignedCredential,
  AptorError,
} from "../src/index.js";

const testTransactionId = "test-transaction-id-00000001";
const testContractAddress = "0200test-contract-address-for-runtime-validation";

function fixture() {
  const professional = createProfessionalVault();
  const issuer = createIssuerVault("Northstar Studio");
  const credential = issueCredential(issuer, {
    holderProfile: professional.profile,
    skills: ["React", "Accessibility", "TypeScript"],
    durationMonths: 18,
    deliveredToProduction: true,
    clientRatingHundredths: 475,
  });
  const request = finalizeRequestPackage(
    "undeployed",
    testContractAddress,
    {
      acceptedIssuerProfiles: [issuer.profile],
      requiredSkill: "react",
      minimumDurationMonths: 12,
      requireProductionDelivery: true,
      minimumClientRatingHundredths: 450,
    },
    testTransactionId,
  );
  return { professional, issuer, credential, request };
}

test("public holder and issuer profiles survive a JSON round trip", () => {
  const { professional, issuer } = fixture();
  assert.deepEqual(
    parseHolderFile(serializePortableFile(professional.profile)),
    professional.profile,
  );
  assert.deepEqual(
    parseIssuerFile(serializePortableFile(issuer.profile)),
    issuer.profile,
  );
  assert.equal("holderSecret" in professional.profile, false);
  assert.equal("issuerSigningKey" in issuer.profile, false);
});

test("credential encryption authenticates the package and restores its skill tree", async () => {
  const { credential } = fixture();
  const encrypted = await encryptCredentialPackage(
    credential,
    "correct horse battery staple",
  );
  const parsed = parseCredentialFile(serializePortableFile(encrypted));
  const decrypted = await decryptCredentialPackage(
    parsed,
    "correct horse battery staple",
  );
  assert.deepEqual(validateSignedCredential(decrypted), credential);

  const altered = {
    ...encrypted,
    ciphertext: `${encrypted.ciphertext.startsWith("A") ? "B" : "A"}${encrypted.ciphertext.slice(1)}`,
  };
  await assert.rejects(
    decryptCredentialPackage(altered, "correct horse battery staple"),
    (error: unknown) =>
      error instanceof AptorError &&
      error.code === "CREDENTIAL_PACKAGE_ALTERED",
  );
  await assert.rejects(
    decryptCredentialPackage(encrypted, "definitely the wrong passphrase"),
    (error: unknown) =>
      error instanceof AptorError &&
      error.code === "CREDENTIAL_PACKAGE_ALTERED",
  );
});

test("credential import rejects an invalid signature and a different holder", () => {
  const { professional, credential } = fixture();
  const tampered = structuredClone(credential);
  tampered.issuerSignature.response = (
    BigInt(tampered.issuerSignature.response) + 1n
  ).toString(10);
  assert.throws(
    () => validateSignedCredential(tampered),
    (error: unknown) =>
      error instanceof AptorError && error.code === "INVALID_ISSUER_SIGNATURE",
  );

  const otherProfessional = createProfessionalVault();
  assert.throws(
    () => validateCredentialForHolder(credential, otherProfessional),
    (error: unknown) =>
      error instanceof AptorError && error.code === "WRONG_HOLDER",
  );
  assert.deepEqual(
    validateCredentialForHolder(credential, professional),
    credential,
  );
});

test("credential bounds are enforced during issuance", () => {
  const professional = createProfessionalVault();
  const issuer = createIssuerVault();
  assert.throws(() =>
    issueCredential(issuer, {
      holderProfile: professional.profile,
      skills: ["React"],
      durationMonths: 1,
      deliveredToProduction: false,
      clientRatingHundredths: 501,
    }),
  );
});

test("request packages recompute commitments and matching private paths", () => {
  const { professional, credential, request } = fixture();
  const parsed = parseRequestFile(serializePortableFile(request));
  assert.deepEqual(parsed, request);
  assert.equal(credentialSatisfiesRequest(credential, request), true);
  const state = createPrivateStateForRequest(professional, credential, request);
  assert.equal(state.issuerMembershipPath.path.length, 5);
  assert.equal(state.requiredSkillMembershipPath.path.length, 5);

  const altered = structuredClone(request);
  altered.request.minimumDurationMonths += 1;
  assert.throws(
    () => validateRequestPackage(altered),
    (error: unknown) =>
      error instanceof AptorError &&
      error.code === "REQUEST_COMMITMENT_MISMATCH",
  );
});

test("request import rejects the wrong network and unsupported issuer", () => {
  const { professional, credential, request } = fixture();
  assert.throws(
    () =>
      validateRequestPackage(request, {
        network: "preprod",
        contractAddress: testContractAddress,
      }),
    (error: unknown) =>
      error instanceof AptorError && error.code === "WRONG_NETWORK",
  );

  const otherIssuer = createIssuerVault("Another issuer");
  const unsupported = finalizeRequestPackage(
    "undeployed",
    testContractAddress,
    {
      acceptedIssuerProfiles: [otherIssuer.profile],
      requiredSkill: "React",
      requireProductionDelivery: false,
    },
    testTransactionId,
  );
  assert.equal(credentialSatisfiesRequest(credential, unsupported), false);
  assert.throws(
    () => createPrivateStateForRequest(professional, credential, unsupported),
    (error: unknown) =>
      error instanceof AptorError &&
      error.code === "CREDENTIAL_CANNOT_SATISFY_REQUEST",
  );
});

test("unsupported portable-file versions are rejected", () => {
  const { professional } = fixture();
  assert.throws(() =>
    parseHolderFile(
      JSON.stringify({
        ...professional.profile,
        version: 2,
      }),
    ),
  );
});

test("malformed and unknown portable files are rejected at runtime", () => {
  assert.throws(() => parsePortableFile("not-json"));
  assert.throws(
    () => parsePortableFile(JSON.stringify({ format: "unknown", version: 1 })),
    (error: unknown) =>
      error instanceof AptorError && error.code === "INVALID_FILE",
  );
});
