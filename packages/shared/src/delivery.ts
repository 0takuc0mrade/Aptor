import { z } from "zod";

export const isoDateSchema = z.iso.datetime({ offset: true });
export const aptorProfileIdSchema = z
  .string()
  .regex(/^apt_[0-9a-f]{32}$/u, "Expected an Aptor profile ID.");
export const hexDigestSchema = z
  .string()
  .regex(/^[0-9a-f]{64}$/u, "Expected a 32-byte lowercase hex digest.");
export const aptorNetworkSchema = z.enum([
  "mainnet",
  "preview",
  "preprod",
  "undeployed",
]);

const jubjubPointSchema = z
  .string()
  .regex(/^aptor-jubjub-v1:[0-9a-f]{64}:[0-9a-f]{64}$/u);

export const holderProfileSchema = z
  .object({
    format: z.literal("aptor-holder"),
    version: z.literal(1),
    profileId: aptorProfileIdSchema,
    holderCommitment: hexDigestSchema,
    createdAt: isoDateSchema,
  })
  .strict();

export const issuerProfileSchema = z
  .object({
    format: z.literal("aptor-issuer"),
    version: z.literal(1),
    issuerPublicKey: jubjubPointSchema,
    displayName: z.string().trim().min(1).max(120).optional(),
    createdAt: isoDateSchema,
  })
  .strict();

export const publicEncryptionKeySchema = z
  .object({
    algorithm: z.literal("ECDH-P256"),
    format: z.literal("spki"),
    value: z.string().min(80).max(256),
  })
  .strict();

export const privateEncryptionKeySchema = z
  .object({
    algorithm: z.literal("ECDH-P256"),
    format: z.literal("pkcs8"),
    value: z.string().min(120).max(512),
  })
  .strict();

export const aptorProfileSchema = z
  .object({
    profileId: aptorProfileIdSchema,
    handle: z.string().regex(/^[a-z0-9](?:[a-z0-9_-]{1,30}[a-z0-9])?$/u),
    displayName: z.string().trim().min(1).max(120),
    publicEncryptionKey: publicEncryptionKeySchema,
    holderProfile: holderProfileSchema,
    issuerProfile: issuerProfileSchema,
    createdAt: isoDateSchema,
  })
  .strict();

export const privateProfileStateSchema = z
  .object({
    profileId: aptorProfileIdSchema,
    accessToken: z.string().min(43).max(128),
    privateEncryptionKey: privateEncryptionKeySchema,
  })
  .strict();

export const envelopeTypeSchema = z.enum(["work_credential", "proof_request"]);
export const deliveryStatusSchema = z.enum(["pending", "received", "deleted"]);

export const encryptedEnvelopeInputSchema = z
  .object({
    senderProfileId: aptorProfileIdSchema,
    recipientProfileId: aptorProfileIdSchema,
    envelopeType: envelopeTypeSchema,
    ciphertext: z.string().min(24).max(350_000),
    nonce: z.string().min(16).max(32),
    ephemeralPublicKey: publicEncryptionKeySchema,
    encryptionVersion: z.literal(1),
    contentDigest: hexDigestSchema,
  })
  .strict();

export const encryptedEnvelopeSchema = encryptedEnvelopeInputSchema.extend({
  envelopeId: z.string().uuid(),
  deliveryStatus: deliveryStatusSchema,
  createdAt: isoDateSchema,
  receivedAt: isoDateSchema.nullable(),
});

export const invitationStateSchema = z.enum([
  "active",
  "expired",
  "redeemed",
  "invalid",
]);

export const notificationSchema = z
  .object({
    notificationId: z.string().uuid(),
    profileId: aptorProfileIdSchema,
    type: z.enum([
      "invitation_redeemed",
      "credential_received",
      "proof_request_received",
      "request_fulfilled",
    ]),
    relatedEntityId: z.string().min(1).max(256),
    readAt: isoDateSchema.nullable(),
    createdAt: isoDateSchema,
  })
  .strict();

export const requestPublicStatusSchema = z.enum([
  "registering",
  "registered",
  "proof_submitted",
  "fulfilled",
]);

export const requestTrackingSchema = z
  .object({
    requestId: hexDigestSchema,
    verifierProfileId: aptorProfileIdSchema,
    professionalProfileId: aptorProfileIdSchema,
    contractAddress: z.string().min(8).max(256),
    networkId: aptorNetworkSchema,
    registrationTransactionId: z.string().min(8).max(256),
    fulfillmentTransactionId: z.string().min(8).max(256).nullable(),
    publicStatus: requestPublicStatusSchema,
    lastCheckedAt: isoDateSchema.nullable(),
    createdAt: isoDateSchema,
    updatedAt: isoDateSchema,
  })
  .strict();

export type AptorHolderProfileV1 = z.infer<typeof holderProfileSchema>;
export type AptorIssuerProfileV1 = z.infer<typeof issuerProfileSchema>;
export type AptorNetwork = z.infer<typeof aptorNetworkSchema>;
export type AptorProfileV1 = z.infer<typeof aptorProfileSchema>;
export type AptorPrivateProfileStateV1 = z.infer<
  typeof privateProfileStateSchema
>;
export type AptorPublicEncryptionKeyV1 = z.infer<
  typeof publicEncryptionKeySchema
>;
export type AptorPrivateEncryptionKeyV1 = z.infer<
  typeof privateEncryptionKeySchema
>;
export type AptorEnvelopeType = z.infer<typeof envelopeTypeSchema>;
export type AptorEncryptedEnvelopeInputV1 = z.infer<
  typeof encryptedEnvelopeInputSchema
>;
export type AptorEncryptedEnvelopeV1 = z.infer<typeof encryptedEnvelopeSchema>;
export type AptorNotificationV1 = z.infer<typeof notificationSchema>;
export type AptorRequestTrackingV1 = z.infer<typeof requestTrackingSchema>;
