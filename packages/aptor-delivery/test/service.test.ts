import assert from "node:assert/strict";
import test from "node:test";

import {
  DeliveryDatabase,
  DeliveryError,
  DeliveryService,
  hashAccessToken,
} from "../src/index.js";
import { envelope, profile } from "./fixtures.js";

function fixture() {
  const database = new DeliveryDatabase(":memory:");
  const service = new DeliveryService(database);
  const professional = profile(1, "maya-chen");
  const issuer = profile(2, "northstar-studio");
  const verifier = profile(3, "proof-lab");
  const tokens = {
    professional: "p".repeat(43),
    issuer: "i".repeat(43),
    verifier: "v".repeat(43),
  };
  service.createProfile(professional, hashAccessToken(tokens.professional));
  service.createProfile(issuer, hashAccessToken(tokens.issuer));
  service.createProfile(verifier, hashAccessToken(tokens.verifier));
  return { database, service, professional, issuer, verifier, tokens };
}

test("profiles enforce normalized unique handles and hashed capability authentication", () => {
  const { database, service, professional, tokens } = fixture();
  try {
    assert.equal(
      service.authenticate(tokens.professional).profileId,
      professional.profileId,
    );
    assert.equal(
      database.connection
        .prepare("SELECT access_token_hash FROM profiles WHERE profile_id = ?")
        .get(professional.profileId)?.access_token_hash,
      hashAccessToken(tokens.professional),
    );
    assert.throws(
      () => service.authenticate("x".repeat(43)),
      (error: unknown) =>
        error instanceof DeliveryError && error.code === "UNAUTHORIZED",
    );
    database.connection
      .prepare(
        "UPDATE profiles SET access_token_expires_at = ? WHERE profile_id = ?",
      )
      .run("2020-01-01T00:00:00.000Z", professional.profileId);
    assert.throws(
      () => service.authenticate(tokens.professional),
      (error: unknown) =>
        error instanceof DeliveryError && error.code === "ACCESS_TOKEN_EXPIRED",
    );
  } finally {
    database.close();
  }
});

test("invitations expire, redeem once, and authorize credential delivery", () => {
  const { database, service, professional, issuer } = fixture();
  try {
    const token = "invite".padEnd(43, "x");
    const invite = service.createInvitation(
      professional.profileId,
      hashAccessToken(token),
    );
    assert.equal(service.inspectInvitation(token).state, "active");
    service.redeemInvitation(token, issuer.profileId);
    assert.equal(service.inspectInvitation(token).state, "redeemed");
    assert.throws(
      () => service.redeemInvitation(token, issuer.profileId),
      (error: unknown) =>
        error instanceof DeliveryError && error.code === "INVITATION_USED",
    );
    const delivered = service.sendEnvelope(
      issuer.profileId,
      envelope(issuer.profileId, professional.profileId, "work_credential"),
    );
    assert.equal(delivered.deliveryStatus, "pending");

    const expiredToken = "expired".padEnd(43, "x");
    const expired = service.createInvitation(
      professional.profileId,
      hashAccessToken(expiredToken),
    );
    database.connection
      .prepare("UPDATE invitations SET expires_at = ? WHERE invitation_id = ?")
      .run("2020-01-01T00:00:00.000Z", expired.invitationId as string);
    assert.equal(service.inspectInvitation(expiredToken).state, "expired");
    assert.throws(
      () => service.redeemInvitation(expiredToken, issuer.profileId),
      (error: unknown) =>
        error instanceof DeliveryError && error.code === "INVITATION_EXPIRED",
    );
  } finally {
    database.close();
  }
});

test("invitation inspection and redemption are durably rate limited", () => {
  const { database, service, issuer } = fixture();
  try {
    const unknownToken = "unknown".padEnd(43, "x");
    for (let attempt = 0; attempt < 30; attempt += 1) {
      assert.equal(service.inspectInvitation(unknownToken).state, "invalid");
    }
    assert.throws(
      () => service.inspectInvitation(unknownToken),
      (error: unknown) =>
        error instanceof DeliveryError && error.code === "RATE_LIMITED",
    );

    const invalidToken = "invalid".padEnd(43, "x");
    for (let attempt = 0; attempt < 20; attempt += 1) {
      assert.throws(
        () => service.redeemInvitation(invalidToken, issuer.profileId),
        (error: unknown) =>
          error instanceof DeliveryError && error.code === "INVALID_INVITATION",
      );
    }
    assert.throws(
      () => service.redeemInvitation(invalidToken, issuer.profileId),
      (error: unknown) =>
        error instanceof DeliveryError && error.code === "RATE_LIMITED",
    );

    const persisted = database.connection
      .prepare("SELECT COUNT(*) AS count FROM rate_limits")
      .get() as { count: number };
    assert.equal(persisted.count >= 2, true);
  } finally {
    database.close();
  }
});

test("inbox authorization, duplicate envelopes, ciphertext persistence, and notifications are safe", () => {
  const { database, service, professional, verifier } = fixture();
  try {
    const input = envelope(verifier.profileId, professional.profileId);
    const first = service.sendEnvelope(verifier.profileId, input);
    const duplicate = service.sendEnvelope(verifier.profileId, input);
    assert.equal(duplicate.envelopeId, first.envelopeId);
    assert.equal(service.listInbox(professional.profileId).length, 1);
    assert.equal(service.listInbox(verifier.profileId).length, 0);
    assert.throws(
      () => service.markEnvelopeReceived(verifier.profileId, first.envelopeId),
      (error: unknown) =>
        error instanceof DeliveryError && error.code === "ENVELOPE_NOT_FOUND",
    );
    assert.equal(
      service.markEnvelopeReceived(professional.profileId, first.envelopeId)
        .deliveryStatus,
      "received",
    );
    const row = database.connection
      .prepare("SELECT * FROM encrypted_envelopes WHERE envelope_id = ?")
      .get(first.envelopeId);
    assert.equal(row?.ciphertext, input.ciphertext);
    assert.equal(JSON.stringify(row).includes("credentialId"), false);
    const notification = service.listNotifications(professional.profileId)[0]!;
    assert.equal(notification.type, "proof_request_received");
    assert.notEqual(
      service.markNotificationRead(
        professional.profileId,
        notification.notificationId,
      ).readAt,
      null,
    );
  } finally {
    database.close();
  }
});

test("request status cache only advances and preserves chain-facing transaction evidence", () => {
  const { database, service, professional, verifier } = fixture();
  try {
    const requestId = "cd".repeat(32);
    const tracking = service.createRequestTracking(verifier.profileId, {
      requestId,
      verifierProfileId: verifier.profileId,
      professionalProfileId: professional.profileId,
      contractAddress: "contract-address-localnet",
      networkId: "undeployed",
      registrationTransactionId: "registration-transaction",
    });
    assert.equal(tracking.publicStatus, "registered");
    assert.equal(
      service.updateRequestTracking(
        professional.profileId,
        requestId,
        "proof_submitted",
        "fulfillment-transaction",
      ).publicStatus,
      "proof_submitted",
    );
    assert.equal(
      service.updateRequestTracking(verifier.profileId, requestId, "fulfilled")
        .publicStatus,
      "fulfilled",
    );
    assert.equal(
      service.updateRequestTracking(
        professional.profileId,
        requestId,
        "proof_submitted",
      ).publicStatus,
      "fulfilled",
    );
    assert.throws(
      () =>
        service.updateRequestTracking(
          professional.profileId,
          requestId,
          "fulfilled",
        ),
      (error: unknown) =>
        error instanceof DeliveryError &&
        error.code === "TRACKING_NOT_AUTHORIZED",
    );
  } finally {
    database.close();
  }
});
