import assert from "node:assert/strict";
import test from "node:test";

import {
  DeliveryDatabase,
  DeliveryService,
  handleDeliveryRequest,
  hashAccessToken,
} from "../src/index.js";
import { envelope, profile } from "./fixtures.js";

function apiFixture() {
  const database = new DeliveryDatabase(":memory:");
  const service = new DeliveryService(database);
  const professional = profile(11, "api-professional");
  const verifier = profile(12, "api-verifier");
  const issuer = profile(14, "api-issuer");
  const professionalToken = "p".repeat(43);
  const verifierToken = "v".repeat(43);
  const issuerToken = "i".repeat(43);
  service.createProfile(professional, hashAccessToken(professionalToken));
  service.createProfile(verifier, hashAccessToken(verifierToken));
  service.createProfile(issuer, hashAccessToken(issuerToken));
  return {
    database,
    service,
    professional,
    verifier,
    issuer,
    professionalToken,
    verifierToken,
    issuerToken,
  };
}

function request(
  path: string,
  method: "GET" | "PATCH" | "POST",
  token?: string,
  body?: unknown,
): Request {
  return new Request(`http://localhost/api/delivery${path}`, {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

test("API creates and reads profiles without exposing access-token hashes", async () => {
  const { database, service } = apiFixture();
  try {
    const created = profile(13, "new-profile");
    const response = await handleDeliveryRequest(
      request("/profiles", "POST", undefined, {
        profile: created,
        accessTokenHash: hashAccessToken("n".repeat(43)),
      }),
      ["profiles"],
      service,
    );
    assert.equal(response.status, 201);
    const publicResponse = await handleDeliveryRequest(
      request("/profiles/new-profile", "GET"),
      ["profiles", "new-profile"],
      service,
    );
    assert.equal(publicResponse.status, 200);
    assert.equal((await publicResponse.text()).includes("accessToken"), false);
  } finally {
    database.close();
  }
});

test("API rejects unauthorized inbox access, sender mismatch, expired capabilities, and oversized ciphertext", async () => {
  const { database, service, professional, verifier, verifierToken } =
    apiFixture();
  try {
    const unauthorized = await handleDeliveryRequest(
      request("/envelopes", "GET"),
      ["envelopes"],
      service,
    );
    assert.equal(unauthorized.status, 401);
    const oversized = await handleDeliveryRequest(
      request("/envelopes", "POST", verifierToken, {
        ...envelope(verifier.profileId, professional.profileId),
        ciphertext: "X".repeat(350_001),
      }),
      ["envelopes"],
      service,
    );
    assert.equal(oversized.status, 400);
    const wrongSender = await handleDeliveryRequest(
      request(
        "/envelopes",
        "POST",
        verifierToken,
        envelope(professional.profileId, verifier.profileId),
      ),
      ["envelopes"],
      service,
    );
    assert.equal(wrongSender.status, 403);
    database.connection
      .prepare(
        "UPDATE profiles SET access_token_expires_at = ? WHERE profile_id = ?",
      )
      .run("2020-01-01T00:00:00.000Z", verifier.profileId);
    const expired = await handleDeliveryRequest(
      request("/envelopes", "GET", verifierToken),
      ["envelopes"],
      service,
    );
    assert.equal(expired.status, 401);
  } finally {
    database.close();
  }
});

test("API invitation redemption authorizes encrypted credential delivery once", async () => {
  const {
    database,
    service,
    professional,
    issuer,
    professionalToken,
    issuerToken,
  } = apiFixture();
  try {
    const invitationToken = "invite-api".padEnd(43, "x");
    const created = await handleDeliveryRequest(
      request("/invitations", "POST", professionalToken, {
        tokenHash: hashAccessToken(invitationToken),
      }),
      ["invitations"],
      service,
    );
    assert.equal(created.status, 201);
    const inspected = await handleDeliveryRequest(
      request("/invitations/inspect", "POST", undefined, {
        token: invitationToken,
      }),
      ["invitations", "inspect"],
      service,
    );
    assert.equal((await inspected.json()).state, "active");
    const redeemed = await handleDeliveryRequest(
      request("/invitations/redeem", "POST", issuerToken, {
        token: invitationToken,
      }),
      ["invitations", "redeem"],
      service,
    );
    assert.equal(redeemed.status, 200);
    const replay = await handleDeliveryRequest(
      request("/invitations/redeem", "POST", issuerToken, {
        token: invitationToken,
      }),
      ["invitations", "redeem"],
      service,
    );
    assert.equal(replay.status, 409);

    const sent = await handleDeliveryRequest(
      request(
        "/envelopes",
        "POST",
        issuerToken,
        envelope(issuer.profileId, professional.profileId, "work_credential"),
      ),
      ["envelopes"],
      service,
    );
    assert.equal(sent.status, 201);
    const inbox = await handleDeliveryRequest(
      request("/envelopes", "GET", professionalToken),
      ["envelopes"],
      service,
    );
    assert.equal(((await inbox.json()) as unknown[]).length, 1);
  } finally {
    database.close();
  }
});

test("API invitation, delivery, inbox, receipt, and notification endpoints enforce recipients", async () => {
  const {
    database,
    service,
    professional,
    verifier,
    professionalToken,
    verifierToken,
  } = apiFixture();
  try {
    const sent = await handleDeliveryRequest(
      request(
        "/envelopes",
        "POST",
        verifierToken,
        envelope(verifier.profileId, professional.profileId),
      ),
      ["envelopes"],
      service,
    );
    assert.equal(sent.status, 201);
    const delivered = (await sent.json()) as { envelopeId: string };
    const inbox = await handleDeliveryRequest(
      request("/envelopes", "GET", professionalToken),
      ["envelopes"],
      service,
    );
    assert.equal(((await inbox.json()) as unknown[]).length, 1);
    const wrongRecipient = await handleDeliveryRequest(
      request(`/envelopes/${delivered.envelopeId}`, "PATCH", verifierToken),
      ["envelopes", delivered.envelopeId],
      service,
    );
    assert.equal(wrongRecipient.status, 404);
    const received = await handleDeliveryRequest(
      request(`/envelopes/${delivered.envelopeId}`, "PATCH", professionalToken),
      ["envelopes", delivered.envelopeId],
      service,
    );
    assert.equal(received.status, 200);
    const notifications = await handleDeliveryRequest(
      request("/notifications", "GET", professionalToken),
      ["notifications"],
      service,
    );
    assert.equal(((await notifications.json()) as unknown[]).length, 1);
  } finally {
    database.close();
  }
});
