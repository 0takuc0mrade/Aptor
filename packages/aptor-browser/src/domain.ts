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
  deriveIssuerPublicKey,
  deriveProofRequestCommitment,
  deriveSkillMembershipPath,
  signWorkCredential,
  verifyWorkCredentialSignature,
  type AptorCredentialPrivateState,
  type ProofRequestV1,
  type Schnorr_SchnorrSignature,
  type WorkCredentialV1,
} from "@aptor/credential-contract";

import {
  bytesToHex,
  equalBytes,
  hexToBytes,
  pointFromString,
  pointToString,
  stableProfileId,
} from "./encoding.js";
import { AptorError } from "./errors.js";
import {
  holderProfileSchema,
  issuerProfileSchema,
  requestPackageSchema,
  signedCredentialSchema,
  type AptorHolderProfileV1,
  type AptorIssuerProfileV1,
  type AptorNetwork,
  type AptorProofRequestPackageV1,
  type AptorSignedCredentialV1,
  type IssuerVaultV1,
  type ProfessionalVaultV1,
} from "./schemas.js";

export type IssueCredentialInput = Readonly<{
  holderProfile: AptorHolderProfileV1;
  skills: readonly string[];
  durationMonths: number;
  deliveredToProduction: boolean;
  clientRatingHundredths: number;
}>;

export type CreateRequestInput = Readonly<{
  acceptedIssuerProfiles: readonly AptorIssuerProfileV1[];
  requiredSkill: string;
  minimumDurationMonths?: number;
  requireProductionDelivery: boolean;
  minimumClientRatingHundredths?: number;
}>;

function toWorkCredential(
  value: AptorSignedCredentialV1["credential"],
): WorkCredentialV1 {
  return {
    credentialId: hexToBytes(value.credentialId, 32),
    holderCommitment: hexToBytes(value.holderCommitment, 32),
    skillsRoot: { field: BigInt(value.skillsRoot) },
    durationMonths: BigInt(value.durationMonths),
    deliveredToProduction: value.deliveredToProduction,
    clientRatingHundredths: BigInt(value.clientRatingHundredths),
  };
}

function toSignature(
  value: AptorSignedCredentialV1["issuerSignature"],
): Schnorr_SchnorrSignature {
  return {
    announcement: pointFromString(value.announcement),
    response: BigInt(value.response),
  };
}

export function createProfessionalVault(): ProfessionalVaultV1 {
  const holderSecret = createHolderSecret();
  const createdAt = new Date().toISOString();
  const profile = holderProfileSchema.parse({
    format: "aptor-holder",
    version: 1,
    profileId: stableProfileId(),
    holderCommitment: bytesToHex(deriveHolderCommitment(holderSecret)),
    createdAt,
  });
  return {
    kind: "professional",
    holderSecret: bytesToHex(holderSecret),
    profile,
    credentials: [],
    requests: [],
  };
}

export function createIssuerVault(displayName?: string): IssuerVaultV1 {
  const keyPair = createIssuerKeyPair();
  const profile = issuerProfileSchema.parse({
    format: "aptor-issuer",
    version: 1,
    issuerPublicKey: pointToString(keyPair.publicKey),
    ...(displayName?.trim() ? { displayName: displayName.trim() } : {}),
    createdAt: new Date().toISOString(),
  });
  return {
    kind: "issuer",
    issuerSigningKey: keyPair.signingKey.toString(10),
    profile,
    issuanceHistory: [],
  };
}

export function issueCredential(
  issuerVault: IssuerVaultV1,
  input: IssueCredentialInput,
): AptorSignedCredentialV1 {
  const holderProfile = holderProfileSchema.parse(input.holderProfile);
  const skillTree = buildSkillTree(input.skills);
  const credential = createWorkCredential({
    holderCommitment: hexToBytes(holderProfile.holderCommitment, 32),
    skillsRoot: skillTree.root,
    durationMonths: input.durationMonths,
    deliveredToProduction: input.deliveredToProduction,
    clientRatingHundredths: input.clientRatingHundredths,
  });
  const signingKey = BigInt(issuerVault.issuerSigningKey);
  const derivedPublicKey = deriveIssuerPublicKey(signingKey);
  if (pointToString(derivedPublicKey) !== issuerVault.profile.issuerPublicKey) {
    throw new AptorError(
      "INVALID_ISSUER_SIGNATURE",
      "The issuer vault key does not match its public profile.",
    );
  }
  const signature = signWorkCredential(credential, signingKey);
  return signedCredentialSchema.parse({
    format: "aptor-signed-credential",
    version: 1,
    holderProfileId: holderProfile.profileId,
    credential: {
      credentialId: bytesToHex(credential.credentialId),
      holderCommitment: bytesToHex(credential.holderCommitment),
      skillsRoot: credential.skillsRoot.field.toString(10),
      durationMonths: Number(credential.durationMonths),
      deliveredToProduction: credential.deliveredToProduction,
      clientRatingHundredths: Number(credential.clientRatingHundredths),
    },
    issuerPublicKey: pointToString(derivedPublicKey),
    issuerSignature: {
      announcement: pointToString(signature.announcement),
      response: signature.response.toString(10),
    },
    skills: skillTree.skills.map((skill) => ({
      display: skill.display,
      normalized: skill.normalized,
      id: bytesToHex(skill.id),
    })),
    issuedAt: new Date().toISOString(),
  });
}

export function validateSignedCredential(
  value: unknown,
): AptorSignedCredentialV1 {
  const parsed = signedCredentialSchema.parse(value);
  const skillTree = buildSkillTree(parsed.skills.map((skill) => skill.display));
  if (skillTree.root.field.toString(10) !== parsed.credential.skillsRoot) {
    throw new AptorError(
      "INVALID_FILE",
      "The credential skill tree does not match its signed root.",
    );
  }
  if (skillTree.skills.length !== parsed.skills.length) {
    throw new AptorError(
      "INVALID_FILE",
      "The credential contains duplicate or inconsistent skills.",
    );
  }
  for (const skill of parsed.skills) {
    const canonical = skillTree.skills.find(
      (candidate) => bytesToHex(candidate.id) === skill.id,
    );
    if (canonical === undefined || canonical.normalized !== skill.normalized) {
      throw new AptorError(
        "INVALID_FILE",
        "The credential contains an inconsistent normalized skill.",
      );
    }
  }
  if (
    !verifyWorkCredentialSignature(
      toWorkCredential(parsed.credential),
      toSignature(parsed.issuerSignature),
      pointFromString(parsed.issuerPublicKey),
    )
  ) {
    throw new AptorError(
      "INVALID_ISSUER_SIGNATURE",
      "The issuer signature on this credential is invalid.",
    );
  }
  return parsed;
}

export function validateCredentialForHolder(
  value: unknown,
  vault: ProfessionalVaultV1,
): AptorSignedCredentialV1 {
  const credential = validateSignedCredential(value);
  const holderCommitment = deriveHolderCommitment(
    hexToBytes(vault.holderSecret, 32),
  );
  if (
    credential.holderProfileId !== vault.profile.profileId ||
    !equalBytes(
      hexToBytes(credential.credential.holderCommitment, 32),
      holderCommitment,
    )
  ) {
    throw new AptorError(
      "WRONG_HOLDER",
      "This credential belongs to a different Aptor holder profile.",
    );
  }
  return credential;
}

export function portableRequestFieldsToContractRequest(
  request: AptorProofRequestPackageV1["request"],
): ProofRequestV1 {
  return {
    requestId: hexToBytes(request.requestId, 32),
    acceptedIssuerRoot: { field: BigInt(request.acceptedIssuerRoot) },
    checkSkill: request.checkSkill,
    requiredSkillId: hexToBytes(request.requiredSkillId, 32),
    checkDuration: request.checkDuration,
    minimumDurationMonths: BigInt(request.minimumDurationMonths),
    requireProductionDelivery: request.requireProductionDelivery,
    checkClientRating: request.checkClientRating,
    minimumClientRatingHundredths: BigInt(
      request.minimumClientRatingHundredths,
    ),
  };
}

export function createRequestDraft(input: CreateRequestInput): {
  request: AptorProofRequestPackageV1["request"];
  requestCommitment: string;
} {
  const accepted = input.acceptedIssuerProfiles.map((profile) =>
    issuerProfileSchema.parse(profile),
  );
  const issuerTree = buildAcceptedIssuerTree(
    accepted.map((profile) => pointFromString(profile.issuerPublicKey)),
  );
  const skillId = canonicalSkillId(input.requiredSkill);
  const request = createProofRequest({
    acceptedIssuerRoot: issuerTree.root,
    checkSkill: true,
    requiredSkillId: skillId,
    checkDuration: input.minimumDurationMonths !== undefined,
    minimumDurationMonths: input.minimumDurationMonths ?? 0,
    requireProductionDelivery: input.requireProductionDelivery,
    checkClientRating: input.minimumClientRatingHundredths !== undefined,
    minimumClientRatingHundredths: input.minimumClientRatingHundredths ?? 0,
  });
  const portableRequest = {
    requestId: bytesToHex(request.requestId),
    acceptedIssuerRoot: request.acceptedIssuerRoot.field.toString(10),
    checkSkill: request.checkSkill,
    requiredSkillId: bytesToHex(request.requiredSkillId),
    requiredSkill: input.requiredSkill,
    checkDuration: request.checkDuration,
    minimumDurationMonths: Number(request.minimumDurationMonths),
    requireProductionDelivery: request.requireProductionDelivery,
    checkClientRating: request.checkClientRating,
    minimumClientRatingHundredths: Number(
      request.minimumClientRatingHundredths,
    ),
  };
  return {
    request: portableRequest,
    requestCommitment: bytesToHex(deriveProofRequestCommitment(request)),
  };
}

export function finalizeRequestPackage(
  network: AptorNetwork,
  contractAddress: string,
  input: CreateRequestInput,
  registrationTransactionId: string,
): AptorProofRequestPackageV1 {
  const draft = createRequestDraft(input);
  return finalizeRequestDraftPackage(
    network,
    contractAddress,
    input.acceptedIssuerProfiles,
    draft,
    registrationTransactionId,
  );
}

export function finalizeRequestDraftPackage(
  network: AptorNetwork,
  contractAddress: string,
  acceptedIssuerProfiles: readonly AptorIssuerProfileV1[],
  draft: ReturnType<typeof createRequestDraft>,
  registrationTransactionId: string,
): AptorProofRequestPackageV1 {
  return requestPackageSchema.parse({
    format: "aptor-request",
    version: 1,
    network,
    contractAddress,
    ...draft,
    acceptedIssuerProfiles: acceptedIssuerProfiles.map((profile) => ({
      issuerPublicKey: profile.issuerPublicKey,
      ...(profile.displayName ? { displayName: profile.displayName } : {}),
    })),
    registrationTransactionId,
    createdAt: new Date().toISOString(),
  });
}

export function validateRequestPackage(
  value: unknown,
  expected?: Readonly<{ network: AptorNetwork; contractAddress: string }>,
): AptorProofRequestPackageV1 {
  const parsed = requestPackageSchema.parse(value);
  if (expected !== undefined && parsed.network !== expected.network) {
    throw new AptorError(
      "WRONG_NETWORK",
      `This request targets ${parsed.network}, not ${expected.network}.`,
    );
  }
  if (
    expected !== undefined &&
    parsed.contractAddress !== expected.contractAddress
  ) {
    throw new AptorError(
      "WRONG_CONTRACT",
      "This request targets a different Aptor contract.",
    );
  }
  const request = portableRequestFieldsToContractRequest(parsed.request);
  const commitment = deriveProofRequestCommitment(request);
  if (bytesToHex(commitment) !== parsed.requestCommitment) {
    throw new AptorError(
      "REQUEST_COMMITMENT_MISMATCH",
      "The request fields do not match the registered request commitment.",
    );
  }
  if (
    !equalBytes(
      canonicalSkillId(parsed.request.requiredSkill),
      request.requiredSkillId,
    )
  ) {
    throw new AptorError(
      "REQUEST_COMMITMENT_MISMATCH",
      "The required skill label does not match its canonical identifier.",
    );
  }
  const issuerTree = buildAcceptedIssuerTree(
    parsed.acceptedIssuerProfiles.map((profile) =>
      pointFromString(profile.issuerPublicKey),
    ),
  );
  if (issuerTree.root.field !== request.acceptedIssuerRoot.field) {
    throw new AptorError(
      "REQUEST_COMMITMENT_MISMATCH",
      "The accepted issuer list does not match its Merkle root.",
    );
  }
  return parsed;
}

export function credentialSatisfiesRequest(
  credential: AptorSignedCredentialV1,
  requestPackage: AptorProofRequestPackageV1,
): boolean {
  const request = requestPackage.request;
  const hasSkill = credential.skills.some(
    (skill) => skill.id === request.requiredSkillId,
  );
  const acceptedIssuer = requestPackage.acceptedIssuerProfiles.some(
    (profile) => profile.issuerPublicKey === credential.issuerPublicKey,
  );
  return (
    acceptedIssuer &&
    (!request.checkSkill || hasSkill) &&
    (!request.checkDuration ||
      credential.credential.durationMonths >= request.minimumDurationMonths) &&
    (!request.requireProductionDelivery ||
      credential.credential.deliveredToProduction) &&
    (!request.checkClientRating ||
      credential.credential.clientRatingHundredths >=
        request.minimumClientRatingHundredths)
  );
}

export function createPrivateStateForRequest(
  vault: ProfessionalVaultV1,
  credentialValue: AptorSignedCredentialV1,
  requestValue: AptorProofRequestPackageV1,
): AptorCredentialPrivateState {
  const credential = validateCredentialForHolder(credentialValue, vault);
  const requestPackage = validateRequestPackage(requestValue);
  if (!credentialSatisfiesRequest(credential, requestPackage)) {
    throw new AptorError(
      "CREDENTIAL_CANNOT_SATISFY_REQUEST",
      "The selected credential does not satisfy this request.",
    );
  }
  const skillTree = buildSkillTree(
    credential.skills.map((skill) => skill.display),
  );
  const issuerTree = buildAcceptedIssuerTree(
    requestPackage.acceptedIssuerProfiles.map((profile) =>
      pointFromString(profile.issuerPublicKey),
    ),
  );
  const issuerPublicKey = pointFromString(credential.issuerPublicKey);
  return createCredentialPrivateState({
    credential: toWorkCredential(credential.credential),
    issuerPublicKey,
    issuerSignature: toSignature(credential.issuerSignature),
    issuerMembershipPath: deriveIssuerMembershipPath(
      issuerTree,
      issuerPublicKey,
    ),
    holderSecret: hexToBytes(vault.holderSecret, 32),
    privateSkills: skillTree.skills.map((skill) => skill.id),
    requiredSkillMembershipPath: deriveSkillMembershipPath(
      skillTree,
      requestPackage.request.requiredSkill,
    ),
  });
}

/**
 * Produces a valid, memory-only witness state required by Midnight.js while
 * constructing the contract deployment transaction. It is not persisted,
 * published, or represented as product activity.
 */
export function createDeploymentPrivateState(): AptorCredentialPrivateState {
  const professional = createProfessionalVault();
  const issuer = createIssuerVault("Aptor deployment authority");
  const credential = issueCredential(issuer, {
    holderProfile: professional.profile,
    skills: ["Deployment"],
    durationMonths: 1,
    deliveredToProduction: true,
    clientRatingHundredths: 500,
  });
  const request = finalizeRequestPackage(
    "preprod",
    "aptor-deployment-private-state",
    {
      acceptedIssuerProfiles: [issuer.profile],
      requiredSkill: "Deployment",
      requireProductionDelivery: true,
    },
    "aptor-deployment-private-state",
  );
  return createPrivateStateForRequest(professional, credential, request);
}

export function portableRequestToContractRequest(
  requestPackage: AptorProofRequestPackageV1,
): ProofRequestV1 {
  return portableRequestFieldsToContractRequest(
    validateRequestPackage(requestPackage).request,
  );
}
