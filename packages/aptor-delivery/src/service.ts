import { createHash, randomUUID, timingSafeEqual } from "node:crypto";

import {
  aptorProfileSchema,
  encryptedEnvelopeInputSchema,
  encryptedEnvelopeSchema,
  notificationSchema,
  requestTrackingSchema,
  type AptorEncryptedEnvelopeInputV1,
  type AptorEncryptedEnvelopeV1,
  type AptorNotificationV1,
  type AptorProfileV1,
  type AptorRequestTrackingV1,
} from "@aptor/shared";

import { DeliveryDatabase } from "./database.js";
import { DeliveryError } from "./errors.js";

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1_000;
const ACCESS_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1_000;

type Row = Record<string, unknown>;

function now(): string {
  return new Date().toISOString();
}

export function hashAccessToken(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function safeEqual(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left, "hex");
  const rightBytes = Buffer.from(right, "hex");
  return (
    leftBytes.length === rightBytes.length &&
    timingSafeEqual(leftBytes, rightBytes)
  );
}

function profileFromRow(row: Row): AptorProfileV1 {
  return aptorProfileSchema.parse({
    profileId: row.profile_id,
    handle: row.handle,
    displayName: row.display_name,
    publicEncryptionKey: JSON.parse(String(row.public_encryption_key)),
    holderProfile: JSON.parse(String(row.holder_profile)),
    issuerProfile: JSON.parse(String(row.issuer_profile)),
    createdAt: row.created_at,
  });
}

function envelopeFromRow(row: Row): AptorEncryptedEnvelopeV1 {
  return encryptedEnvelopeSchema.parse({
    envelopeId: row.envelope_id,
    senderProfileId: row.sender_profile_id,
    recipientProfileId: row.recipient_profile_id,
    envelopeType: row.envelope_type,
    ciphertext: row.ciphertext,
    nonce: row.nonce,
    ephemeralPublicKey: JSON.parse(String(row.ephemeral_public_key)),
    encryptionVersion: row.encryption_version,
    contentDigest: row.content_digest,
    deliveryStatus: row.delivery_status,
    createdAt: row.created_at,
    receivedAt: row.received_at,
  });
}

function notificationFromRow(row: Row): AptorNotificationV1 {
  return notificationSchema.parse({
    notificationId: row.notification_id,
    profileId: row.profile_id,
    type: row.type,
    relatedEntityId: row.related_entity_id,
    readAt: row.read_at,
    createdAt: row.created_at,
  });
}

function trackingFromRow(row: Row): AptorRequestTrackingV1 {
  return requestTrackingSchema.parse({
    requestId: row.request_id,
    verifierProfileId: row.verifier_profile_id,
    professionalProfileId: row.professional_profile_id,
    contractAddress: row.contract_address,
    networkId: row.network_id,
    registrationTransactionId: row.registration_transaction_id,
    fulfillmentTransactionId: row.fulfillment_transaction_id,
    publicStatus: row.public_status,
    lastCheckedAt: row.last_checked_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

export class DeliveryService {
  constructor(readonly database: DeliveryDatabase) {}

  createProfile(
    profileValue: unknown,
    accessTokenHash: string,
  ): AptorProfileV1 {
    const profile = aptorProfileSchema.parse(profileValue);
    if (!/^[0-9a-f]{64}$/u.test(accessTokenHash)) {
      throw new DeliveryError(
        "INVALID_ACCESS_TOKEN_HASH",
        "The account capability is invalid.",
        400,
      );
    }
    const timestamp = now();
    try {
      this.database.connection
        .prepare(
          `
          INSERT INTO profiles(
            profile_id, handle, display_name, public_encryption_key,
            holder_profile, issuer_profile, access_token_hash,
            access_token_expires_at, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        )
        .run(
          profile.profileId,
          profile.handle,
          profile.displayName,
          JSON.stringify(profile.publicEncryptionKey),
          JSON.stringify(profile.holderProfile),
          JSON.stringify(profile.issuerProfile),
          accessTokenHash,
          new Date(Date.now() + ACCESS_TOKEN_TTL_MS).toISOString(),
          timestamp,
          timestamp,
        );
    } catch (error) {
      if (String(error).includes("UNIQUE")) {
        throw new DeliveryError(
          "PROFILE_CONFLICT",
          "That Aptor handle is already in use.",
          409,
        );
      }
      throw error;
    }
    return profile;
  }

  getPublicProfile(identifier: string): AptorProfileV1 {
    const row = this.database.connection
      .prepare("SELECT * FROM profiles WHERE handle = ? OR profile_id = ?")
      .get(identifier.toLowerCase(), identifier) as Row | undefined;
    if (row === undefined) {
      throw new DeliveryError(
        "PROFILE_NOT_FOUND",
        "No Aptor profile was found.",
        404,
      );
    }
    return profileFromRow(row);
  }

  authenticate(accessToken: string): AptorProfileV1 {
    const candidate = hashAccessToken(accessToken);
    const row = this.database.connection
      .prepare("SELECT * FROM profiles WHERE access_token_hash = ?")
      .get(candidate) as Row | undefined;
    if (
      row === undefined ||
      !safeEqual(String(row.access_token_hash), candidate)
    ) {
      throw new DeliveryError(
        "UNAUTHORIZED",
        "This Aptor account capability is not authorized.",
        401,
      );
    }
    if (Date.parse(String(row.access_token_expires_at)) <= Date.now()) {
      throw new DeliveryError(
        "ACCESS_TOKEN_EXPIRED",
        "This device-bound account capability has expired.",
        401,
      );
    }
    return profileFromRow(row);
  }

  consumeRateLimit(
    profileId: string,
    action: string,
    limit: number,
    windowMs: number,
  ): void {
    const timestamp = Date.now();
    const row = this.database.connection
      .prepare("SELECT * FROM rate_limits WHERE rate_key = ? AND action = ?")
      .get(profileId, action) as Row | undefined;
    if (
      row === undefined ||
      timestamp - Number(row.window_started_at) >= windowMs
    ) {
      this.database.connection
        .prepare(
          `
          INSERT INTO rate_limits(rate_key, action, window_started_at, request_count)
          VALUES (?, ?, ?, 1)
          ON CONFLICT(rate_key, action) DO UPDATE SET
            window_started_at = excluded.window_started_at,
            request_count = 1
        `,
        )
        .run(profileId, action, timestamp);
      return;
    }
    if (Number(row.request_count) >= limit) {
      throw new DeliveryError(
        "RATE_LIMITED",
        "Too many delivery requests. Wait before trying again.",
        429,
      );
    }
    this.database.connection
      .prepare(
        "UPDATE rate_limits SET request_count = request_count + 1 WHERE rate_key = ? AND action = ?",
      )
      .run(profileId, action);
  }

  createInvitation(creatorProfileId: string, tokenHash: string): Row {
    this.consumeRateLimit(
      creatorProfileId,
      "create_invitation",
      10,
      60 * 60 * 1_000,
    );
    if (!/^[0-9a-f]{64}$/u.test(tokenHash)) {
      throw new DeliveryError(
        "INVALID_INVITATION",
        "The invitation capability is invalid.",
        400,
      );
    }
    const invitationId = randomUUID();
    const createdAt = now();
    const expiresAt = new Date(Date.now() + INVITATION_TTL_MS).toISOString();
    this.database.connection
      .prepare(
        `
        INSERT INTO invitations(
          invitation_id, created_by_profile_id, intended_role,
          opaque_token_hash, expires_at, created_at
        ) VALUES (?, ?, 'issuer', ?, ?, ?)
      `,
      )
      .run(invitationId, creatorProfileId, tokenHash, expiresAt, createdAt);
    return { invitationId, intendedRole: "issuer", expiresAt, createdAt };
  }

  inspectInvitation(rawToken: string): Row {
    const tokenHash = hashAccessToken(rawToken);
    this.consumeRateLimit(tokenHash, "inspect_invitation", 30, 60 * 60 * 1_000);
    const row = this.database.connection
      .prepare("SELECT * FROM invitations WHERE opaque_token_hash = ?")
      .get(tokenHash) as Row | undefined;
    if (row === undefined) return { state: "invalid" };
    if (row.redeemed_at !== null) return { state: "redeemed" };
    if (Date.parse(String(row.expires_at)) <= Date.now())
      return { state: "expired" };
    return {
      state: "active",
      invitationId: row.invitation_id,
      intendedRole: row.intended_role,
      expiresAt: row.expires_at,
      inviter: this.getPublicProfile(String(row.created_by_profile_id)),
    };
  }

  redeemInvitation(rawToken: string, redeemerProfileId: string): Row {
    this.consumeRateLimit(
      redeemerProfileId,
      "redeem_invitation",
      20,
      60 * 60 * 1_000,
    );
    const tokenHash = hashAccessToken(rawToken);
    const row = this.database.connection
      .prepare("SELECT * FROM invitations WHERE opaque_token_hash = ?")
      .get(tokenHash) as Row | undefined;
    if (row === undefined)
      throw new DeliveryError(
        "INVALID_INVITATION",
        "This invitation is invalid.",
        404,
      );
    if (row.redeemed_at !== null)
      throw new DeliveryError(
        "INVITATION_USED",
        "This invitation has already been used.",
        409,
      );
    if (Date.parse(String(row.expires_at)) <= Date.now()) {
      throw new DeliveryError(
        "INVITATION_EXPIRED",
        "This invitation has expired.",
        410,
      );
    }
    if (row.created_by_profile_id === redeemerProfileId) {
      throw new DeliveryError(
        "INVALID_INVITATION",
        "You cannot redeem your own invitation.",
        400,
      );
    }
    const redeemedAt = now();
    const result = this.database.connection
      .prepare(
        `
        UPDATE invitations SET redeemed_at = ?, redeemed_by_profile_id = ?
        WHERE invitation_id = ? AND redeemed_at IS NULL
      `,
      )
      .run(redeemedAt, redeemerProfileId, String(row.invitation_id));
    if (result.changes !== 1) {
      throw new DeliveryError(
        "INVITATION_USED",
        "This invitation has already been used.",
        409,
      );
    }
    this.createNotification(
      String(row.created_by_profile_id),
      "invitation_redeemed",
      String(row.invitation_id),
    );
    return {
      state: "redeemed",
      invitationId: row.invitation_id,
      redeemedAt,
      inviter: this.getPublicProfile(String(row.created_by_profile_id)),
    };
  }

  listInvitations(profileId: string, scope: "sent" | "received"): Row[] {
    const column =
      scope === "sent" ? "created_by_profile_id" : "redeemed_by_profile_id";
    const rows = this.database.connection
      .prepare(
        `SELECT * FROM invitations WHERE ${column} = ? ORDER BY created_at DESC`,
      )
      .all(profileId) as Row[];
    return rows.map((row) => ({
      invitationId: row.invitation_id,
      intendedRole: row.intended_role,
      state:
        row.redeemed_at !== null
          ? "redeemed"
          : Date.parse(String(row.expires_at)) <= Date.now()
            ? "expired"
            : "active",
      expiresAt: row.expires_at,
      redeemedAt: row.redeemed_at,
      createdAt: row.created_at,
      creator: this.getPublicProfile(String(row.created_by_profile_id)),
      ...(row.redeemed_by_profile_id === null
        ? {}
        : {
            redeemer: this.getPublicProfile(String(row.redeemed_by_profile_id)),
          }),
    }));
  }

  sendEnvelope(
    senderProfileId: string,
    value: unknown,
  ): AptorEncryptedEnvelopeV1 {
    this.consumeRateLimit(
      senderProfileId,
      "send_envelope",
      60,
      60 * 60 * 1_000,
    );
    const envelope = encryptedEnvelopeInputSchema.parse(value);
    if (envelope.senderProfileId !== senderProfileId) {
      throw new DeliveryError(
        "WRONG_SENDER",
        "The encrypted delivery sender does not match this account.",
        403,
      );
    }
    this.getPublicProfile(envelope.recipientProfileId);
    if (envelope.envelopeType === "work_credential") {
      const relationship = this.database.connection
        .prepare(
          `
          SELECT invitation_id FROM invitations
          WHERE created_by_profile_id = ? AND redeemed_by_profile_id = ?
            AND intended_role = 'issuer' AND redeemed_at IS NOT NULL
        `,
        )
        .get(envelope.recipientProfileId, senderProfileId);
      if (relationship === undefined) {
        throw new DeliveryError(
          "DELIVERY_NOT_AUTHORIZED",
          "Accept the Professional's invitation before delivering a credential.",
          403,
        );
      }
    }
    const duplicate = this.database.connection
      .prepare(
        `
        SELECT * FROM encrypted_envelopes
        WHERE sender_profile_id = ? AND recipient_profile_id = ?
          AND envelope_type = ? AND content_digest = ?
      `,
      )
      .get(
        senderProfileId,
        envelope.recipientProfileId,
        envelope.envelopeType,
        envelope.contentDigest,
      ) as Row | undefined;
    if (duplicate !== undefined) return envelopeFromRow(duplicate);
    const envelopeId = randomUUID();
    const createdAt = now();
    this.database.connection
      .prepare(
        `
        INSERT INTO encrypted_envelopes(
          envelope_id, sender_profile_id, recipient_profile_id, envelope_type,
          ciphertext, nonce, ephemeral_public_key, encryption_version,
          content_digest, delivery_status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
      `,
      )
      .run(
        envelopeId,
        senderProfileId,
        envelope.recipientProfileId,
        envelope.envelopeType,
        envelope.ciphertext,
        envelope.nonce,
        JSON.stringify(envelope.ephemeralPublicKey),
        envelope.encryptionVersion,
        envelope.contentDigest,
        createdAt,
      );
    this.createNotification(
      envelope.recipientProfileId,
      envelope.envelopeType === "work_credential"
        ? "credential_received"
        : "proof_request_received",
      envelopeId,
    );
    return envelopeFromRow(
      this.database.connection
        .prepare("SELECT * FROM encrypted_envelopes WHERE envelope_id = ?")
        .get(envelopeId) as Row,
    );
  }

  listInbox(recipientProfileId: string): AptorEncryptedEnvelopeV1[] {
    return (
      this.database.connection
        .prepare(
          "SELECT * FROM encrypted_envelopes WHERE recipient_profile_id = ? AND delivery_status != 'deleted' ORDER BY created_at DESC",
        )
        .all(recipientProfileId) as Row[]
    ).map(envelopeFromRow);
  }

  markEnvelopeReceived(
    recipientProfileId: string,
    envelopeId: string,
  ): AptorEncryptedEnvelopeV1 {
    const receivedAt = now();
    const result = this.database.connection
      .prepare(
        `
        UPDATE encrypted_envelopes SET delivery_status = 'received', received_at = COALESCE(received_at, ?)
        WHERE envelope_id = ? AND recipient_profile_id = ? AND delivery_status != 'deleted'
      `,
      )
      .run(receivedAt, envelopeId, recipientProfileId);
    if (result.changes !== 1) {
      throw new DeliveryError(
        "ENVELOPE_NOT_FOUND",
        "This delivery is unavailable or belongs to another profile.",
        404,
      );
    }
    return envelopeFromRow(
      this.database.connection
        .prepare("SELECT * FROM encrypted_envelopes WHERE envelope_id = ?")
        .get(envelopeId) as Row,
    );
  }

  createNotification(
    profileId: string,
    type: string,
    relatedEntityId: string,
  ): void {
    this.database.connection
      .prepare(
        "INSERT INTO notifications(notification_id, profile_id, type, related_entity_id, created_at) VALUES (?, ?, ?, ?, ?)",
      )
      .run(randomUUID(), profileId, type, relatedEntityId, now());
  }

  listNotifications(profileId: string): AptorNotificationV1[] {
    return (
      this.database.connection
        .prepare(
          "SELECT * FROM notifications WHERE profile_id = ? ORDER BY created_at DESC LIMIT 100",
        )
        .all(profileId) as Row[]
    ).map(notificationFromRow);
  }

  markNotificationRead(
    profileId: string,
    notificationId: string,
  ): AptorNotificationV1 {
    const readAt = now();
    const result = this.database.connection
      .prepare(
        "UPDATE notifications SET read_at = COALESCE(read_at, ?) WHERE notification_id = ? AND profile_id = ?",
      )
      .run(readAt, notificationId, profileId);
    if (result.changes !== 1)
      throw new DeliveryError(
        "NOTIFICATION_NOT_FOUND",
        "That notification is unavailable.",
        404,
      );
    return notificationFromRow(
      this.database.connection
        .prepare("SELECT * FROM notifications WHERE notification_id = ?")
        .get(notificationId) as Row,
    );
  }

  createRequestTracking(
    verifierProfileId: string,
    value: unknown,
  ): AptorRequestTrackingV1 {
    const parsed = requestTrackingSchema
      .omit({
        fulfillmentTransactionId: true,
        publicStatus: true,
        lastCheckedAt: true,
        createdAt: true,
        updatedAt: true,
      })
      .parse(value);
    if (parsed.verifierProfileId !== verifierProfileId) {
      throw new DeliveryError(
        "WRONG_SENDER",
        "The request owner does not match this account.",
        403,
      );
    }
    this.getPublicProfile(parsed.professionalProfileId);
    const timestamp = now();
    try {
      this.database.connection
        .prepare(
          `
          INSERT INTO request_tracking(
            request_id, verifier_profile_id, professional_profile_id,
            contract_address, network_id, registration_transaction_id,
            public_status, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, 'registered', ?, ?)
        `,
        )
        .run(
          parsed.requestId,
          parsed.verifierProfileId,
          parsed.professionalProfileId,
          parsed.contractAddress,
          parsed.networkId,
          parsed.registrationTransactionId,
          timestamp,
          timestamp,
        );
    } catch (error) {
      if (!String(error).includes("UNIQUE")) throw error;
    }
    return this.getRequestTracking(parsed.requestId, verifierProfileId);
  }

  getRequestTracking(
    requestId: string,
    profileId: string,
  ): AptorRequestTrackingV1 {
    const row = this.database.connection
      .prepare("SELECT * FROM request_tracking WHERE request_id = ?")
      .get(requestId) as Row | undefined;
    if (
      row === undefined ||
      (row.verifier_profile_id !== profileId &&
        row.professional_profile_id !== profileId)
    ) {
      throw new DeliveryError(
        "TRACKING_NOT_FOUND",
        "That request status is unavailable.",
        404,
      );
    }
    return trackingFromRow(row);
  }

  listRequestTracking(profileId: string): AptorRequestTrackingV1[] {
    return (
      this.database.connection
        .prepare(
          "SELECT * FROM request_tracking WHERE verifier_profile_id = ? OR professional_profile_id = ? ORDER BY updated_at DESC",
        )
        .all(profileId, profileId) as Row[]
    ).map(trackingFromRow);
  }

  updateRequestTracking(
    profileId: string,
    requestId: string,
    status: "proof_submitted" | "fulfilled",
    fulfillmentTransactionId?: string,
  ): AptorRequestTrackingV1 {
    const current = this.getRequestTracking(requestId, profileId);
    if (
      status === "proof_submitted" &&
      current.professionalProfileId !== profileId
    ) {
      throw new DeliveryError(
        "TRACKING_NOT_AUTHORIZED",
        "Only the Professional can report proof submission.",
        403,
      );
    }
    if (status === "fulfilled" && current.verifierProfileId !== profileId) {
      throw new DeliveryError(
        "TRACKING_NOT_AUTHORIZED",
        "Only the Verifier can confirm chain fulfillment.",
        403,
      );
    }
    const order = {
      registered: 1,
      proof_submitted: 2,
      fulfilled: 3,
      registering: 0,
    } as const;
    if (order[status] < order[current.publicStatus]) return current;
    const timestamp = now();
    this.database.connection
      .prepare(
        `
        UPDATE request_tracking SET public_status = ?,
          fulfillment_transaction_id = COALESCE(?, fulfillment_transaction_id),
          last_checked_at = ?, updated_at = ? WHERE request_id = ?
      `,
      )
      .run(
        status,
        fulfillmentTransactionId ?? null,
        timestamp,
        timestamp,
        requestId,
      );
    if (status === "fulfilled" && current.publicStatus !== "fulfilled") {
      this.createNotification(
        current.verifierProfileId,
        "request_fulfilled",
        requestId,
      );
    }
    return this.getRequestTracking(requestId, profileId);
  }
}
