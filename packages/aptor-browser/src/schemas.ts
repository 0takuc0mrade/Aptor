import { z } from "zod";
import {
  aptorNetworkSchema,
  aptorProfileIdSchema,
  aptorProfileSchema,
  holderProfileSchema,
  issuerProfileSchema,
  privateProfileStateSchema,
} from "@aptor/shared";
import type {
  AptorHolderProfileV1,
  AptorIssuerProfileV1,
  AptorNetwork,
  AptorProfileV1,
  AptorPrivateProfileStateV1,
} from "@aptor/shared";

const ISO_DATE = z.iso.datetime({ offset: true });
const HEX_32 = z.string().regex(/^[0-9a-f]{64}$/u, "Expected 32-byte hex.");
const DECIMAL_BIGINT = z.string().regex(/^(0|[1-9][0-9]*)$/u);
const JUBJUB_POINT = z
  .string()
  .regex(/^aptor-jubjub-v1:[0-9a-f]{64}:[0-9a-f]{64}$/u);

export { holderProfileSchema, issuerProfileSchema };
export type { AptorHolderProfileV1, AptorIssuerProfileV1, AptorNetwork };

export const workCredentialSchema = z
  .object({
    credentialId: HEX_32,
    holderCommitment: HEX_32,
    skillsRoot: DECIMAL_BIGINT,
    durationMonths: z.number().int().min(0).max(65_535),
    deliveredToProduction: z.boolean(),
    clientRatingHundredths: z.number().int().min(0).max(500),
  })
  .strict();

export const signedCredentialSchema = z
  .object({
    format: z.literal("aptor-signed-credential"),
    version: z.literal(1),
    holderProfileId: aptorProfileIdSchema,
    credential: workCredentialSchema,
    issuerPublicKey: JUBJUB_POINT,
    issuerSignature: z
      .object({
        announcement: JUBJUB_POINT,
        response: DECIMAL_BIGINT,
      })
      .strict(),
    skills: z
      .array(
        z
          .object({
            display: z.string().min(1).max(128),
            normalized: z.string().min(1).max(128),
            id: HEX_32,
          })
          .strict(),
      )
      .min(1)
      .max(32),
    issuedAt: ISO_DATE,
  })
  .strict();

export type AptorSignedCredentialV1 = z.infer<typeof signedCredentialSchema>;

export const encryptionMetadataSchema = z
  .object({
    algorithm: z.literal("AES-GCM"),
    keyDerivation: z.literal("PBKDF2-SHA-256"),
    salt: z.string().min(1),
    iterations: z.number().int().min(100_000).max(2_000_000),
    iv: z.string().min(1),
  })
  .strict();

export const encryptedCredentialPackageSchema = z
  .object({
    format: z.literal("aptor-credential"),
    version: z.literal(1),
    encryption: encryptionMetadataSchema,
    ciphertext: z.string().min(1),
    createdAt: ISO_DATE,
  })
  .strict();

export type AptorEncryptedCredentialPackageV1 = z.infer<
  typeof encryptedCredentialPackageSchema
>;

export const proofRequestSchema = z
  .object({
    requestId: HEX_32,
    acceptedIssuerRoot: DECIMAL_BIGINT,
    checkSkill: z.boolean(),
    requiredSkillId: HEX_32,
    requiredSkill: z.string().min(1).max(128),
    checkDuration: z.boolean(),
    minimumDurationMonths: z.number().int().min(0).max(65_535),
    requireProductionDelivery: z.boolean(),
    checkClientRating: z.boolean(),
    minimumClientRatingHundredths: z.number().int().min(0).max(500),
  })
  .strict()
  .superRefine((request, context) => {
    if (
      !request.checkSkill &&
      !request.checkDuration &&
      !request.requireProductionDelivery &&
      !request.checkClientRating
    ) {
      context.addIssue({
        code: "custom",
        message: "A proof request must enable at least one requirement.",
      });
    }
  });

export const requestPackageSchema = z
  .object({
    format: z.literal("aptor-request"),
    version: z.literal(1),
    network: aptorNetworkSchema,
    contractAddress: z.string().min(8).max(256),
    request: proofRequestSchema,
    requestCommitment: HEX_32,
    acceptedIssuerProfiles: z
      .array(
        z
          .object({
            issuerPublicKey: JUBJUB_POINT,
            displayName: z.string().trim().min(1).max(120).optional(),
          })
          .strict(),
      )
      .min(1)
      .max(32),
    registrationTransactionId: z.string().min(8).max(256),
    createdAt: ISO_DATE,
  })
  .strict();

export type AptorProofRequestPackageV1 = z.infer<typeof requestPackageSchema>;

export const professionalVaultSchema = z
  .object({
    kind: z.literal("professional"),
    holderSecret: HEX_32,
    profile: holderProfileSchema,
    credentials: z.array(signedCredentialSchema).max(500),
    requests: z.array(requestPackageSchema).max(500),
  })
  .strict();

export type ProfessionalVaultV1 = z.infer<typeof professionalVaultSchema>;

export const issuerVaultSchema = z
  .object({
    kind: z.literal("issuer"),
    issuerSigningKey: DECIMAL_BIGINT,
    profile: issuerProfileSchema,
    issuanceHistory: z
      .array(
        z
          .object({
            credentialId: HEX_32,
            holderProfileId: aptorProfileIdSchema,
            issuedAt: ISO_DATE,
          })
          .strict(),
      )
      .max(5_000),
  })
  .strict();

export type IssuerVaultV1 = z.infer<typeof issuerVaultSchema>;

export const encryptedVaultSchema = z
  .object({
    format: z.literal("aptor-vault-backup"),
    version: z.literal(1),
    kind: z.enum(["professional", "issuer"]),
    profileId: aptorProfileIdSchema.optional(),
    encryption: encryptionMetadataSchema,
    ciphertext: z.string().min(1),
    createdAt: ISO_DATE,
    updatedAt: ISO_DATE,
  })
  .strict();

export type AptorEncryptedVaultV1 = z.infer<typeof encryptedVaultSchema>;
export type AptorVaultKind = AptorEncryptedVaultV1["kind"];

export const verifierStateSchema = z
  .object({
    trustedProfiles: z.array(aptorProfileSchema).max(32),
    activeRequests: z
      .array(
        z
          .object({
            professionalProfileId: aptorProfileIdSchema,
            professionalHandle: z.string().min(3).max(32),
            request: requestPackageSchema,
            envelopeId: z.string().uuid().optional(),
            fulfillmentTransactionId: z.string().min(8).max(256).optional(),
          })
          .strict(),
      )
      .max(500),
  })
  .strict();

export const accountVaultSchema = z
  .object({
    kind: z.literal("account"),
    profile: aptorProfileSchema,
    privateProfile: privateProfileStateSchema,
    professional: professionalVaultSchema,
    issuer: issuerVaultSchema,
    verifier: verifierStateSchema,
  })
  .strict();

export type AptorVerifierStateV1 = z.infer<typeof verifierStateSchema>;
export type AptorAccountVaultV1 = z.infer<typeof accountVaultSchema>;
export type { AptorPrivateProfileStateV1, AptorProfileV1 };

export const encryptedAccountVaultSchema = z
  .object({
    format: z.literal("aptor-account-vault-backup"),
    version: z.literal(1),
    profileId: aptorProfileIdSchema,
    encryption: encryptionMetadataSchema,
    ciphertext: z.string().min(1),
    createdAt: ISO_DATE,
    updatedAt: ISO_DATE,
  })
  .strict();

export type AptorEncryptedAccountVaultV1 = z.infer<
  typeof encryptedAccountVaultSchema
>;

export function parseImportedJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    throw new TypeError("The selected file is not valid JSON.", {
      cause: error,
    });
  }
}
