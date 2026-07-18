# Aptor envelope encryption

## Format

Milestone 6 uses `AptorEncryptedEnvelopeInputV1`:

```text
senderProfileId
recipientProfileId
envelopeType: work_credential | proof_request
ciphertext
nonce
ephemeralPublicKey
encryptionVersion: 1
contentDigest
```

The server adds the envelope ID, timestamps, and delivery state. The credential
or request payload exists only in browser memory before encryption and after
recipient decryption.

## Algorithms

- account and ephemeral keypairs: ECDH P-256;
- shared-secret derivation: Web Crypto `deriveBits`;
- key derivation: HKDF-SHA-256;
- content encryption: AES-256-GCM with a 128-bit tag;
- nonce: fresh random 96-bit value per envelope;
- digest: SHA-256 of the serialized payload;
- public-key serialization: SPKI base64;
- private-key serialization: PKCS#8 base64, stored only inside the encrypted
  IndexedDB account vault.

P-256 was selected because the current Chromium browser targets and Web Crypto
implementation support key generation, SPKI/PKCS#8 import/export, ECDH, HKDF,
and AES-GCM without a custom cryptographic implementation.

## Encryption

1. Validate and serialize the signed credential or registered request.
2. Reject payloads above 256 KiB.
3. Compute the SHA-256 content digest.
4. Generate a fresh ephemeral P-256 keypair.
5. Derive ECDH bits from the ephemeral private key and recipient public key.
6. Derive an AES-256 key with HKDF-SHA-256. The salt and info are domain
   separated under `aptor-envelope:*:1`.
7. Build authenticated context from version, sender profile, recipient profile,
   envelope type, and content digest.
8. Encrypt with a fresh AES-GCM nonce and the context as additional data.
9. Upload only the envelope fields.

The Issuer signs a credential before this sequence. A fresh ephemeral keypair
and nonce are generated for every delivery.

## Decryption

1. Reject unsupported versions before importing key material.
2. Check the active account profile matches `recipientProfileId`.
3. Import the recipient PKCS#8 private key from unlocked vault memory.
4. Import the ephemeral SPKI public key from the envelope.
5. Reproduce ECDH and HKDF with the authenticated context.
6. AES-GCM decrypt locally.
7. Recompute and compare the content digest.
8. Parse the runtime schema.
9. For credentials, verify the Issuer signature and holder-secret binding.
10. For requests, verify the package commitment and registered Midnight state.

Only after every check passes can the Professional accept the item into the
encrypted account vault. Wrong recipients, changed routing metadata, damaged
ciphertext, unsupported versions, invalid signatures, and wrong holders fail
with explicit user-safe states.

## Security boundary

The stored ephemeral public key is not sufficient to decrypt because the
ephemeral private key is discarded and the recipient private key never leaves
the encrypted browser vault. AES-GCM authenticates ciphertext and routing
context. The content digest supports duplicate detection and an extra local
integrity check; it does not replace the GCM tag.

The design does not hide sender, recipient, timing, envelope type, or size from
the service. Browser compromise, extension compromise, memory scraping,
malicious dependencies, lost keys, and traffic analysis remain outside the
cryptographic guarantee.
