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

## Remaining product work

### 5. Connect the existing frontend

- Adopt the official browser wallet/DApp connector for the pinned stack.
- Add wallet-backed Issuer, Professional, and Verifier sessions.
- Connect credential issuance, request registration, proving, and receipts.
- Add encrypted local credential storage and recovery behavior.
- Remove all disconnected placeholders without fabricating activity.

### 6. Harden credential lifecycle

- Add expiry, revocation, issuer identity policy, and key rotation.
- Add request expiration and authorization for request creation.
- Rate-limit adaptive requests that could narrow private ranges.
- Decide multi-skill and multi-credential proof composition.

### 7. Validate and prepare delivery

- Complete keyboard, focus, contrast, reduced-motion, and responsive testing.
- Add loading, empty, failure, recovery, and proof-progress states.
- Record a reproducible demo from issuance through fulfilled receipt.
- State real, simulated, and unsupported behavior in product copy.

## Exact next milestone

> Connect the existing Issuer, Professional and Verifier interfaces to the real Aptor contract, add wallet-backed role sessions and encrypted local credential storage, and complete the end-to-end browser workflow without fabricated data.
