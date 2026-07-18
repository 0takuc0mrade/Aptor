# Build plan

## Completed contract milestones

### 1. Private threshold foundation

- [x] Pin Compact and Midnight dependencies.
- [x] Compile real prover/verifier assets.
- [x] Deploy and finalize a local proof-backed transaction.

### 2. Provider-backed proof flow

- [x] Connect node, indexer, proof server, wallet, and private-state providers.
- [x] Distinguish local rejection from proof and transaction submission.
- [x] Inspect returned public artifacts.

### 3. Authenticated private duration credential

- [x] Sign a fixed canonical credential with Jubjub Schnorr.
- [x] Add one accepted issuer and holder-secret binding.
- [x] Reject signed-field tampering, wrong holder, wrong issuer, and threshold failure.

### 4. Request-bound professional capability proof

- [x] Add `WorkCredentialV1` with skill root, duration, production, and rating.
- [x] Normalize skills and prove membership in a private depth-5 skill tree.
- [x] Hide the issuer behind a verifier-approved depth-5 issuer root.
- [x] Register domain-separated structured request commitments.
- [x] Replace the counter with request commitments and one-time receipts.
- [x] Cover optional predicates, all tampering, duplicate requests, and replay.
- [x] Record the final provider-backed identifiers and block-limit result in the
      Milestone 4 report after the real LocalNet run.

### 5. Connect the existing frontend

- [x] Adopt the official browser wallet/DApp connector for the pinned stack.
- [x] Add real Issuer, Professional, and Verifier browser workflows.
- [x] Connect credential issuance, request registration, proving, and receipts.
- [x] Add encrypted local vault creation, lock, backup, restore, and deletion.
- [x] Add versioned holder, issuer, encrypted credential, and request files.
- [x] Validate the complete three-profile flow with real LocalNet proofs and
      transactions.
- [x] Remove disconnected placeholders without fabricating activity.

### 6. Add encrypted in-app delivery

- [x] Add one encrypted, device-bound Aptor profile for every role.
- [x] Generate P-256 account encryption keys and high-entropy capabilities in
      the browser.
- [x] Add SQLite migrations, hashed capability authentication, invitations,
      encrypted envelopes, notifications, and request-status tracking.
- [x] Encrypt every credential and request envelope with fresh ECDH/HKDF/AES-GCM
      material and recipient-bound authenticated context.
- [x] Make Professional invitations and inboxes the default Issuer handoff.
- [x] Make encrypted request delivery and automatic receipt monitoring the
      default Verifier handoff.
- [x] Keep versioned file import/export under Advanced.
- [x] Add unit, API, browser-crypto, privacy, and three-context LocalNet tests.

## Remaining product work

### 7. Deploy improved workflow to Preprod

- Deploy the unchanged Compact contract to Midnight Preprod.
- Validate registration and fulfillment with the real 1AM wallet.
- Host the frontend and choose a durable hosted SQL replacement for local
  SQLite without changing the delivery-service boundary.
- Preserve public deployment and transaction evidence.
- Prepare the final hackathon submission without expanding product scope.

### 8. Post-hackathon credential lifecycle

- Add expiry, revocation, issuer identity policy, and key rotation.
- Add request expiration and authorization for request creation.
- Rate-limit adaptive requests that could narrow private ranges.
- Decide multi-skill and multi-credential proof composition.

## Exact next milestone

> Deploy the improved Aptor workflow to Midnight Preprod, validate it with the real 1AM wallet, host the frontend, preserve public transaction evidence, and prepare the final hackathon submission without expanding product scope.
