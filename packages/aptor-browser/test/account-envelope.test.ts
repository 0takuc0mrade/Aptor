import assert from "node:assert/strict";
import test from "node:test";

import {
  AptorError,
  createAptorAccount,
  decryptAccountVault,
  decryptEnvelopePayload,
  encryptAccountVault,
  encryptEnvelopePayload,
  hashCapability,
  normalizeHandle,
} from "../src/index.js";

test("profile creation normalizes handles and creates serializable device keys", async () => {
  const account = await createAptorAccount("  Maya  Chen  ", "Maya Chen");
  assert.equal(normalizeHandle("  Maya  Chen  "), "maya-chen");
  assert.equal(account.profile.handle, "maya-chen");
  assert.equal(
    account.profile.profileId,
    account.professional.profile.profileId,
  );
  assert.equal(account.privateProfile.profileId, account.profile.profileId);
  assert.equal(account.profile.publicEncryptionKey.format, "spki");
  assert.equal(account.privateProfile.privateEncryptionKey.format, "pkcs8");
  assert.match(
    await hashCapability(account.privateProfile.accessToken),
    /^[0-9a-f]{64}$/u,
  );
});

test("one encrypted account vault holds all role state without plaintext secrets", async () => {
  const account = await createAptorAccount("maya-chen", "Maya Chen");
  const encrypted = await encryptAccountVault(
    account,
    "Aptor account vault password 2026!",
  );
  const serialized = JSON.stringify(encrypted);
  assert.equal(serialized.includes("holderSecret"), false);
  assert.equal(serialized.includes("issuerSigningKey"), false);
  assert.equal(serialized.includes("accessToken"), false);
  assert.equal(serialized.includes("privateEncryptionKey"), false);
  assert.deepEqual(
    await decryptAccountVault(encrypted, "Aptor account vault password 2026!"),
    account,
  );
});

test("ECDH envelope encryption round-trips and binds sender, recipient, and type", async () => {
  const sender = await createAptorAccount("northstar", "Northstar Studio");
  const recipient = await createAptorAccount("maya-chen", "Maya Chen");
  const payload = {
    format: "test-payload",
    privateFact: "React for 18 months",
  };
  const envelope = await encryptEnvelopePayload(
    payload,
    sender.profile.profileId,
    recipient.profile.profileId,
    "work_credential",
    recipient.profile.publicEncryptionKey,
  );
  assert.equal(JSON.stringify(envelope).includes("React for 18 months"), false);
  assert.deepEqual(
    await decryptEnvelopePayload(
      envelope,
      recipient.profile.profileId,
      recipient.privateProfile.privateEncryptionKey,
    ),
    payload,
  );
  assert.deepEqual(
    await decryptEnvelopePayload(
      {
        ...envelope,
        envelopeId: globalThis.crypto.randomUUID(),
        deliveryStatus: "pending",
        createdAt: new Date().toISOString(),
        receivedAt: null,
      },
      recipient.profile.profileId,
      recipient.privateProfile.privateEncryptionKey,
    ),
    payload,
  );

  await assert.rejects(
    decryptEnvelopePayload(
      envelope,
      sender.profile.profileId,
      sender.privateProfile.privateEncryptionKey,
    ),
    (error: unknown) =>
      error instanceof AptorError && error.code === "WRONG_ENVELOPE_RECIPIENT",
  );
});

test("envelope tampering and unsupported encryption versions fail closed", async () => {
  const sender = await createAptorAccount("northstar", "Northstar Studio");
  const recipient = await createAptorAccount("maya-chen", "Maya Chen");
  const envelope = await encryptEnvelopePayload(
    { privateFact: "never persisted as plaintext" },
    sender.profile.profileId,
    recipient.profile.profileId,
    "work_credential",
    recipient.profile.publicEncryptionKey,
  );
  const altered = {
    ...envelope,
    ciphertext: `${envelope.ciphertext.startsWith("A") ? "B" : "A"}${envelope.ciphertext.slice(1)}`,
  };
  await assert.rejects(
    decryptEnvelopePayload(
      altered,
      recipient.profile.profileId,
      recipient.privateProfile.privateEncryptionKey,
    ),
    (error: unknown) =>
      error instanceof AptorError && error.code === "ENVELOPE_INTEGRITY_FAILED",
  );
  await assert.rejects(
    decryptEnvelopePayload(
      { ...envelope, encryptionVersion: 2 },
      recipient.profile.profileId,
      recipient.privateProfile.privateEncryptionKey,
    ),
    (error: unknown) =>
      error instanceof AptorError && error.code === "UNSUPPORTED_VERSION",
  );
});
