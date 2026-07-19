import { resolve } from "node:path";

import { z } from "zod";

import { DeliveryDatabase } from "./database.js";
import { DeliveryError } from "./errors.js";
import { DeliveryService } from "./service.js";

const MAX_REQUEST_BYTES = 400_000;
let singleton: DeliveryService | undefined;

function service(): DeliveryService {
  singleton ??= new DeliveryService(
    new DeliveryDatabase(
      process.env.APTOR_DELIVERY_DB_PATH ??
        resolve(process.cwd(), ".aptor-delivery", "aptor.sqlite"),
    ),
  );
  return singleton;
}

async function readJson(request: Request): Promise<unknown> {
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BYTES) {
    throw new DeliveryError(
      "REQUEST_TOO_LARGE",
      "This Aptor request is too large.",
      413,
    );
  }
  if (request.body === null) return {};
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const result = await reader.read();
    if (result.done) break;
    length += result.value.byteLength;
    if (length > MAX_REQUEST_BYTES) {
      await reader.cancel();
      throw new DeliveryError(
        "REQUEST_TOO_LARGE",
        "This Aptor request is too large.",
        413,
      );
    }
    chunks.push(result.value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
  } catch {
    throw new DeliveryError(
      "INVALID_JSON",
      "The request body is not valid JSON.",
      400,
    );
  }
}

function bearer(request: Request): string {
  const authorization = request.headers.get("authorization") ?? "";
  const match = /^Bearer ([A-Za-z0-9_-]{43,128})$/u.exec(authorization);
  if (match?.[1] === undefined) {
    throw new DeliveryError(
      "UNAUTHORIZED",
      "Unlock your Aptor account to continue.",
      401,
    );
  }
  return match[1];
}

function json(value: unknown, status = 200): Response {
  return Response.json(value, {
    status,
    headers: {
      "cache-control": "no-store",
      "content-security-policy": "default-src 'none'",
    },
  });
}

export async function handleDeliveryRequest(
  request: Request,
  path: readonly string[],
  delivery = service(),
): Promise<Response> {
  try {
    const method = request.method.toUpperCase();
    if (method === "GET" && path.join("/") === "health") {
      return json({
        status: "ok",
        storage: "sqlite",
        ...delivery.database.health(),
      });
    }
    if (method === "POST" && path[0] === "profiles" && path.length === 1) {
      const body = z
        .object({ profile: z.unknown(), accessTokenHash: z.string() })
        .strict()
        .parse(await readJson(request));
      return json(
        delivery.createProfile(body.profile, body.accessTokenHash),
        201,
      );
    }
    if (method === "GET" && path[0] === "profiles" && path[1] !== undefined) {
      return json(delivery.getPublicProfile(path[1]));
    }
    if (method === "POST" && path.join("/") === "invitations/inspect") {
      const body = z
        .object({ token: z.string().min(43).max(128) })
        .strict()
        .parse(await readJson(request));
      return json(delivery.inspectInvitation(body.token));
    }

    const profile = delivery.authenticate(bearer(request));

    if (method === "POST" && path[0] === "invitations" && path.length === 1) {
      const body = z
        .object({ tokenHash: z.string() })
        .strict()
        .parse(await readJson(request));
      return json(
        delivery.createInvitation(profile.profileId, body.tokenHash),
        201,
      );
    }
    if (method === "POST" && path.join("/") === "invitations/redeem") {
      const body = z
        .object({ token: z.string().min(43).max(128) })
        .strict()
        .parse(await readJson(request));
      return json(delivery.redeemInvitation(body.token, profile.profileId));
    }
    if (method === "GET" && path[0] === "invitations") {
      const scope = new URL(request.url).searchParams.get("scope");
      if (scope !== "sent" && scope !== "received") {
        throw new DeliveryError(
          "INVALID_SCOPE",
          "Choose sent or received invitations.",
          400,
        );
      }
      return json(delivery.listInvitations(profile.profileId, scope));
    }
    if (method === "POST" && path[0] === "envelopes" && path.length === 1) {
      return json(
        delivery.sendEnvelope(profile.profileId, await readJson(request)),
        201,
      );
    }
    if (method === "GET" && path[0] === "envelopes" && path.length === 1) {
      return json(delivery.listInbox(profile.profileId));
    }
    if (
      method === "PATCH" &&
      path[0] === "envelopes" &&
      path[1] !== undefined
    ) {
      return json(delivery.markEnvelopeReceived(profile.profileId, path[1]));
    }
    if (method === "GET" && path[0] === "notifications" && path.length === 1) {
      return json(delivery.listNotifications(profile.profileId));
    }
    if (
      method === "PATCH" &&
      path[0] === "notifications" &&
      path[1] !== undefined
    ) {
      return json(delivery.markNotificationRead(profile.profileId, path[1]));
    }
    if (
      method === "POST" &&
      path[0] === "request-tracking" &&
      path.length === 1
    ) {
      return json(
        delivery.createRequestTracking(
          profile.profileId,
          await readJson(request),
        ),
        201,
      );
    }
    if (
      method === "GET" &&
      path[0] === "request-tracking" &&
      path.length === 1
    ) {
      return json(delivery.listRequestTracking(profile.profileId));
    }
    if (
      method === "PATCH" &&
      path[0] === "request-tracking" &&
      path[1] !== undefined
    ) {
      const body = z
        .object({
          status: z.enum(["proof_submitted", "fulfilled"]),
          fulfillmentTransactionId: z.string().min(8).max(256).optional(),
        })
        .strict()
        .parse(await readJson(request));
      return json(
        delivery.updateRequestTracking(
          profile.profileId,
          path[1],
          body.status,
          body.fulfillmentTransactionId,
        ),
      );
    }
    throw new DeliveryError(
      "NOT_FOUND",
      "This Aptor delivery endpoint does not exist.",
      404,
    );
  } catch (error) {
    if (error instanceof DeliveryError) {
      return json(
        { error: { code: error.code, message: error.message } },
        error.status,
      );
    }
    if (error instanceof z.ZodError) {
      return json(
        {
          error: {
            code: "INVALID_REQUEST",
            message: "The request failed runtime validation.",
          },
        },
        400,
      );
    }
    return json(
      {
        error: {
          code: "DELIVERY_FAILURE",
          message: "The delivery service could not complete this request.",
        },
      },
      500,
    );
  }
}

export function getDeliveryHealth(): Readonly<{
  status: "ok";
  storage: "sqlite";
  schemaVersion: number;
  writable: true;
}> {
  return {
    status: "ok",
    storage: "sqlite",
    ...service().database.health(),
  };
}

export function resetDeliveryServiceForTests(): void {
  singleton = undefined;
}
