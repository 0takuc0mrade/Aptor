import {
  aptorProfileSchema,
  encryptedEnvelopeSchema,
  notificationSchema,
  requestTrackingSchema,
  type AptorEncryptedEnvelopeInputV1,
  type AptorEncryptedEnvelopeV1,
  type AptorNotificationV1,
  type AptorProfileV1,
  type AptorRequestTrackingV1,
} from "@aptor/shared";
import { z } from "zod";

const BASE = "/api/delivery";

export class DeliveryClientError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "DeliveryClientError";
  }
}

async function request(
  path: string,
  options: Readonly<{
    accessToken?: string;
    body?: unknown;
    method?: "GET" | "PATCH" | "POST";
  }> = {},
): Promise<unknown> {
  const response = await fetch(`${BASE}${path}`, {
    method: options.method ?? "GET",
    cache: "no-store",
    headers: {
      accept: "application/json",
      ...(options.body === undefined
        ? {}
        : { "content-type": "application/json" }),
      ...(options.accessToken === undefined
        ? {}
        : { authorization: `Bearer ${options.accessToken}` }),
    },
    ...(options.body === undefined
      ? {}
      : { body: JSON.stringify(options.body) }),
  });
  const value = (await response.json()) as {
    error?: { code?: string; message?: string };
  };
  if (!response.ok) {
    throw new DeliveryClientError(
      value.error?.code ?? "DELIVERY_FAILURE",
      value.error?.message ?? "Aptor delivery could not complete this request.",
    );
  }
  return value;
}

export async function registerProfile(
  profile: AptorProfileV1,
  accessTokenHash: string,
): Promise<AptorProfileV1> {
  return aptorProfileSchema.parse(
    await request("/profiles", {
      method: "POST",
      body: { profile, accessTokenHash },
    }),
  );
}

export async function getPublicProfile(
  identifier: string,
): Promise<AptorProfileV1> {
  return aptorProfileSchema.parse(
    await request(`/profiles/${encodeURIComponent(identifier)}`),
  );
}

const invitationSchema = z
  .object({
    invitationId: z.string().uuid(),
    intendedRole: z.literal("issuer"),
    state: z.enum(["active", "expired", "redeemed"]).optional(),
    expiresAt: z.string(),
    redeemedAt: z.string().nullable().optional(),
    createdAt: z.string(),
    creator: aptorProfileSchema.optional(),
    redeemer: aptorProfileSchema.optional(),
  })
  .passthrough();

export type AptorInvitationView = z.infer<typeof invitationSchema>;

export async function createInvitation(
  accessToken: string,
  tokenHash: string,
): Promise<{ invitationId: string; expiresAt: string }> {
  return z
    .object({ invitationId: z.string().uuid(), expiresAt: z.string() })
    .parse(
      await request("/invitations", {
        accessToken,
        method: "POST",
        body: { tokenHash },
      }),
    );
}

export async function inspectInvitation(token: string): Promise<{
  state: "active" | "expired" | "redeemed" | "invalid";
  inviter?: AptorProfileV1;
  expiresAt?: string;
}> {
  const value = await request("/invitations/inspect", {
    method: "POST",
    body: { token },
  });
  return z
    .object({
      state: z.enum(["active", "expired", "redeemed", "invalid"]),
      inviter: aptorProfileSchema.optional(),
      expiresAt: z.string().optional(),
    })
    .passthrough()
    .parse(value);
}

export async function redeemInvitation(
  accessToken: string,
  token: string,
): Promise<{ inviter: AptorProfileV1 }> {
  return z
    .object({ inviter: aptorProfileSchema })
    .passthrough()
    .parse(
      await request("/invitations/redeem", {
        accessToken,
        method: "POST",
        body: { token },
      }),
    );
}

export async function listInvitations(
  accessToken: string,
  scope: "received" | "sent",
): Promise<AptorInvitationView[]> {
  return z
    .array(invitationSchema)
    .parse(await request(`/invitations?scope=${scope}`, { accessToken }));
}

export async function sendEnvelope(
  accessToken: string,
  envelope: AptorEncryptedEnvelopeInputV1,
): Promise<AptorEncryptedEnvelopeV1> {
  return encryptedEnvelopeSchema.parse(
    await request("/envelopes", {
      accessToken,
      method: "POST",
      body: envelope,
    }),
  );
}

export async function listInbox(
  accessToken: string,
): Promise<AptorEncryptedEnvelopeV1[]> {
  return z
    .array(encryptedEnvelopeSchema)
    .parse(await request("/envelopes", { accessToken }));
}

export async function markEnvelopeReceived(
  accessToken: string,
  envelopeId: string,
): Promise<AptorEncryptedEnvelopeV1> {
  return encryptedEnvelopeSchema.parse(
    await request(`/envelopes/${encodeURIComponent(envelopeId)}`, {
      accessToken,
      method: "PATCH",
    }),
  );
}

export async function listNotifications(
  accessToken: string,
): Promise<AptorNotificationV1[]> {
  return z
    .array(notificationSchema)
    .parse(await request("/notifications", { accessToken }));
}

export async function markNotificationRead(
  accessToken: string,
  notificationId: string,
): Promise<AptorNotificationV1> {
  return notificationSchema.parse(
    await request(`/notifications/${encodeURIComponent(notificationId)}`, {
      accessToken,
      method: "PATCH",
    }),
  );
}

export async function createRequestTracking(
  accessToken: string,
  input: Pick<
    AptorRequestTrackingV1,
    | "contractAddress"
    | "networkId"
    | "professionalProfileId"
    | "registrationTransactionId"
    | "requestId"
    | "verifierProfileId"
  >,
): Promise<AptorRequestTrackingV1> {
  return requestTrackingSchema.parse(
    await request("/request-tracking", {
      accessToken,
      method: "POST",
      body: input,
    }),
  );
}

export async function listRequestTracking(
  accessToken: string,
): Promise<AptorRequestTrackingV1[]> {
  return z
    .array(requestTrackingSchema)
    .parse(await request("/request-tracking", { accessToken }));
}

export async function updateRequestTracking(
  accessToken: string,
  requestId: string,
  input: Readonly<{
    status: "fulfilled" | "proof_submitted";
    fulfillmentTransactionId?: string;
  }>,
): Promise<AptorRequestTrackingV1> {
  return requestTrackingSchema.parse(
    await request(`/request-tracking/${encodeURIComponent(requestId)}`, {
      accessToken,
      method: "PATCH",
      body: input,
    }),
  );
}
