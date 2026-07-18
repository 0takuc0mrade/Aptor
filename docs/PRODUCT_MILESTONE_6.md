# Aptor product milestone 6

Milestone 6 replaces Aptor's default file handoff with in-platform invitations,
end-to-end encrypted delivery, inboxes, notifications, local credential
matching, and automatic Midnight receipt monitoring. Portable files remain an
Advanced fallback. No Preprod deployment or Compact contract change was made.

## 1. Implementation summary

The default journey now runs entirely inside Aptor:

1. A Professional creates one multi-role profile and a one-time Issuer invite.
2. The Issuer redeems it, signs a work credential, and encrypts it to the
   Professional.
3. The Professional decrypts, validates, verifies, and stores the credential in
   the encrypted local vault.
4. A Verifier registers a structured request on Midnight LocalNet and sends the
   registered package in an encrypted envelope.
5. The Professional matches compatible credentials locally and submits a real
   proof.
6. The Verifier dashboard queries Midnight and automatically reaches
   **Request fulfilled**.

No file, transfer password, copied request ID, or manual receipt inspection is
part of this primary path.

## 2. Account and profile model

One `AptorProfile` owns the public profile ID, normalized unique handle, display
name, P-256 public encryption key, public holder profile, and public Issuer
profile. Its encrypted local account bundle contains the raw access capability,
P-256 private encryption key, Professional vault state, Issuer signing state,
and Verifier trust/request state. The role switcher changes workspaces, not
accounts.

Profile IDs and 256-bit capability tokens are generated in the browser. The
server stores only a SHA-256 access-token hash and expires the capability after
30 days. The raw token, encryption private key, holder secret, Issuer signing
key, and vault password never enter server storage. This is intentionally a
device-bound hackathon account model without production recovery or multi-device
key synchronization.

## 3. Delivery-service architecture

`@aptor/delivery` is a focused framework-neutral workspace mounted through the
Next.js catch-all route at `/api/delivery/[...path]`. The API boundary performs
streamed body-size enforcement, Zod runtime validation, capability
authentication, sender/recipient authorization, safe error mapping, and durable
rate limiting. The service owns prepared database operations and returns only
public profiles, routing records, encrypted envelopes, notifications, and
public request-tracking state.

The service has no wallet, proof, vault, credential-signing, or envelope
decryption key. Midnight remains the receipt source of truth; cached delivery
status only supports notifications and interface continuity.

## 4. Database selected and why

The service uses Node's built-in SQLite API (`node:sqlite`). It provides durable
local storage, transactions, foreign keys, WAL mode, uniqueness constraints,
prepared statements, and migrations without a paid service, native add-on, or
large backend framework. Migrations create `profiles`, `invitations`,
`encrypted_envelopes`, `notifications`, `request_tracking`, `rate_limits`, and
`schema_migrations`.

Local data defaults to `.aptor-delivery/aptor.sqlite`. Public hosting should
replace this process-local file with a managed durable SQL database while
preserving the repository/service boundary and never adding plaintext envelope
columns.

## 5. Envelope-encryption design

Each credential or request envelope uses browser-native Web Crypto:

- recipient long-lived P-256 ECDH public key;
- fresh sender ephemeral P-256 keypair per envelope;
- HKDF-SHA-256 key derivation;
- AES-256-GCM authenticated encryption;
- fresh 12-byte nonce;
- 256 KiB plaintext limit;
- a SHA-256 content digest;
- version, sender, recipient, envelope type, and digest in authenticated domain
  context.

The stored/transmitted envelope contains ciphertext, nonce, ephemeral public
key, encryption version, digest, routing metadata, and receipt timestamps. It
contains no decryption key. Decryption rejects the wrong recipient, tampering,
invalid nonces, digest mismatch, and unsupported versions. The browser accepts
both pre-delivery and canonical server-returned envelope shapes.

## 6. Invitation flow

The Professional creates a seven-day single-use Issuer invitation. Only the
SHA-256 hash of its 256-bit opaque capability is stored. The raw capability
appears only in the shareable link, never as an account token. The landing page
shows the inviter, the requested Issuer action, and Aptor's verification limits.
It supports explicit active, invalid, expired, and already-redeemed states.

Redemption requires an Aptor profile, is transactional and one-time, establishes
the credential-delivery relationship, notifies the Professional, and scrubs the
raw token from browser history. Creation, inspection, and redemption are
durably rate limited.

## 7. Credential-delivery flow

The Issuer selects an accepted invitation, reviews the Professional's public
holder profile, enters bounded work facts, reviews the complete private
credential, and signs it with the existing local Issuer key. Aptor then
encrypts the signed bundle to the Professional public key and uploads only the
envelope. The Issuer sees **Credential encrypted for recipient. Delivered to
Professional inbox.**

The Professional opens the inbox item after unlocking the profile. Aptor
decrypts locally, validates the credential schema, verifies the Issuer
signature and holder binding, saves it to the encrypted account vault, and
marks the envelope received. Notifications reveal no credential attributes.

## 8. Proof-request-delivery flow

The Verifier adds trusted public Issuer profiles and selects a Professional by
handle. After reviewing requirements, the Verifier explicitly connects the
wallet, registers the request on Midnight, waits for finalization, encrypts the
validated registered request package to the Professional, and creates a public
tracking row. The active-request dashboard retains the registration transaction
evidence.

The Professional receives **New proof request**, decrypts and validates it,
checks registration and commitment against Midnight, and stores it locally. The
portable `.aptor-request.json` path remains available only under Advanced.

## 9. Automatic receipt-monitoring flow

The Verifier dashboard moves through registering, registered/awaiting proof,
proof submitted, and fulfilled. While open it polls through the existing
provider/query boundary for a finite ten-minute window, applies exponential
backoff capped at 30 seconds, refreshes on window focus, and offers manual retry.

After the Professional's proof transaction finalizes, the delivery cache may be
marked `proof_submitted`. Only a Verifier-side chain query can advance it to
`fulfilled`; that update stores the public fulfillment transaction ID and
creates a notification. Delivery state never overrides contract state.

## 10. Server-visible metadata

The Aptor server can observe profile IDs, handles and public keys; invitation
creator/redeemer relationships; sender and recipient IDs; envelope type, size,
digest, status, and timing; public contract/network/request IDs; transaction
IDs; notification state; capability expiry; and rate-limit counters. It cannot
decrypt credential or request envelopes because it never receives a recipient
private key.

Aptor does not claim to hide relationship, size, timing, or access-pattern
metadata. Midnight separately exposes the intentionally public request criteria
and fulfillment receipt defined by the contract.

## 11. Files created or changed

Created:

- `packages/aptor-delivery/` service, migration, API, CLI, and tests;
- `packages/shared/src/delivery.ts` canonical delivery schemas;
- `packages/aptor-browser/src/account.ts` and `src/envelope.ts`;
- `packages/aptor-browser/test/account-envelope.test.ts`;
- `apps/web/src/app/api/delivery/[...path]/route.ts`;
- `apps/web/src/app/invite/[token]/page.tsx`;
- `apps/web/src/components/account-provider.tsx`;
- `apps/web/src/components/profile-access.tsx`;
- `apps/web/src/components/invitation-landing.tsx`;
- `apps/web/src/lib/delivery-client.ts`;
- `docs/DELIVERY_SERVICE.md`, `docs/ENVELOPE_ENCRYPTION.md`, and
  `docs/IN_APP_USER_FLOW.md`;
- this report.

Updated:

- all three role workspaces, app shell, root layout, global responsive styles,
  Next configuration, web package scripts, Playwright configuration and flow;
- browser crypto, schemas, errors, exports, and package dependencies;
- shared package build/export configuration;
- root scripts, lockfile, ignore rules, and production security scan;
- `README.md`, `PRODUCT.md`, `docs/ARCHITECTURE.md`,
  `docs/PRIVACY_MODEL.md`, and `docs/BUILD_PLAN.md`.

## 12. Unit and API test results

- Compact simulator: 22/22 passed, including proof predicates, signature and
  holder binding, request binding, privacy surfaces, and replay rejection.
- Browser package: six test files passed, including profile/key creation,
  encrypted account vault, portable formats, provider boundaries, ZK helpers,
  delivered-envelope round trip, wrong recipient, tampering, and unsupported
  version.
- Delivery service/API: two compiled suite files passed. Coverage includes
  profile/authentication, public lookup, invitation expiry/replay/rate limits,
  relationship authorization, inbox/receipt authorization, duplicate envelope
  idempotency, ciphertext-only persistence, notifications, request tracking,
  and oversized-body/ciphertext rejection.

## 13. Playwright end-to-end result

The final production-build suite passed **9/9** in 2.9 minutes with one worker.
It used isolated Professional, Issuer, and Verifier contexts and the official
LocalNet testkit wallet adapter. The primary scenario performed invitation,
issuance, encrypted credential delivery, local verification, registered request
delivery, local matching, real proof submission, and automatic fulfillment
without a file, upload, transfer password, or copied request ID.

The same run passed encrypted profile backup/restore, the portable credential
regression, the landing laptop fold, and every role entry page at 320, 375, 414,
768, and desktop/1440 widths with no horizontal overflow or clipped primary
controls.

## 14. LocalNet transaction evidence

Final browser E2E deployment:

- contract: `f39e9787c08192a048a6dd9d5f202f3c3d61e14561fffb5d46667a7e3a8d9c1c`;
- deployment transaction:
  `00a5f69e5b57f1ef82d28e51ba11c512f87eff3ed4b711a74a798b6f2a68dc9638`;
- deployment block: `214`;
- request ID:
  `57109ce974c69af4007f588add390219cba02deb289c7aa7cc667808a0ed73e5`;
- registration transaction:
  `0007fbc358daaf8b9c678499253dcf609d070a6e32328581330516b70e60e460ec`;
- fulfillment transaction:
  `003d647fc2dacc7fdc091c2262e44f3b7f4d0373aa8d78cf7992080e968097c7ea`.

The independent provider-backed test also passed with a finalized deployment,
registration, and proof transaction. It rejected replay, tampered request,
missing-skill, and untrusted-Issuer cases before proof submission and reported
zero inspected public-artifact privacy findings.

## 15. Privacy-inspection findings

- The final E2E database contained exactly two encrypted envelopes and no
  credential skill, duration, rating, signature, or holder-secret values.
- Captured request bodies contained no private credential attributes, holder
  secret, Issuer signing key, or recipient private encryption key.
- IndexedDB stored one encrypted account record; serialized storage exposed no
  access token, encryption private key, holder secret, or Issuer signing key.
- `localStorage` contained zero keys in the completed flow.
- The redeemed invitation URL was scrubbed from Issuer history.
- The Verifier received request/receipt data, not the private credential bundle
  or local match details.
- Source inspection found no credential/request-body logging path, and the
  service lacks the private material required to decrypt stored envelopes.

## 16. Security findings

The six-root production source scan passed. It checks secret patterns, private
field use in route handlers, request-body logging, suspicious plaintext database
columns, and secret-bearing `NEXT_PUBLIC_` variables. The production npm audit
reported **0 vulnerabilities**.

Capabilities and invitation tokens are hashed at rest. Authorization is applied
to inbox, delivery, notification, invitation, and tracking mutations. Envelope
and request-body limits, runtime schemas, timing-safe capability comparison,
one-time invitation redemption, uniqueness constraints, recipient/sender checks,
safe errors, and durable rate limits are active. No secrets were added to Git.

## 17. Validation commands and results

| Command                                                            | Result                                                |
| ------------------------------------------------------------------ | ----------------------------------------------------- |
| `npm install`                                                      | Passed; workspace dependencies installed              |
| `npm run delivery:migrate`                                         | Passed; root local SQLite database migrated           |
| `npm run delivery:test`                                            | Passed; service and API suites                        |
| `npm test --workspace @aptor/browser`                              | Passed; 6 test files                                  |
| `npm run contract:test`                                            | Passed; 22/22                                         |
| `npm run midnight:network:health`                                  | Node, indexer, and proof server healthy               |
| `npm run midnight:test:network`                                    | Passed; real deploy/register/prove and negative cases |
| `npx playwright test --config apps/web/playwright.local.config.ts` | Passed; 9/9                                           |
| `npm run typecheck`                                                | Passed for every workspace                            |
| `npm run lint`                                                     | Passed                                                |
| `npm run format:check`                                             | Passed                                                |
| `npm run security:scan`                                            | Passed across 6 production roots                      |
| `npm audit --omit=dev`                                             | Passed; 0 vulnerabilities                             |
| `npm run build`                                                    | Passed; production Next.js build                      |
| Impeccable detector and responsive smoke                           | 0 detector findings; no overflow/clipped actions      |

## 18. Git commit and status

The milestone is committed locally as `feat: add encrypted in-app Aptor
delivery`. The final commit hash, branch, working-tree status, untracked files,
and configured remotes are reported in the handoff after the validation commit.
No remote push is performed.

## 19. Known limitations

- Device-bound capability authentication has no recovery, rotation UI,
  multi-device synchronization, or remote logout.
- SQLite is appropriate for local validation but needs managed durable storage
  and operational backups for public hosting.
- Invitation links must be shared out of band; email delivery is not included.
- Aptor profiles and Issuer signatures prove control of Aptor keys, not legal
  employer identity, organization ownership, or domain verification.
- Relationship, timing, size, and access metadata remain visible to the delivery
  service.
- There is no revocation, encrypted search, mobile app, or long-running server
  worker; receipt polling occurs while the Verifier dashboard is active.
- This milestone is LocalNet-only and intentionally does not deploy to Preprod.

## 20. Recommended next milestone

Deploy the improved Aptor workflow to Midnight Preprod, validate it with the
real 1AM wallet, host the frontend, preserve public transaction evidence, and
prepare the final hackathon submission without expanding product scope.
