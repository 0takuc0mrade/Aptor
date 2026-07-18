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

## Remaining product work

### 6. Harden credential lifecycle

- Add expiry, revocation, issuer identity policy, and key rotation.
- Add request expiration and authorization for request creation.
- Rate-limit adaptive requests that could narrow private ranges.
- Decide multi-skill and multi-credential proof composition.

### 7. Deploy and prepare hackathon delivery

- Select and deploy to the supported public test environment.
- Harden the already working demo path without adding product scope.
- Add submission-grade architecture visuals and concise documentation.
- Record a reproducible two-minute demo from issuance through receipt.
- Prepare and verify the Devpost submission.

## Exact next milestone

> Deploy the polished Aptor MVP to the selected public test environment, harden the demo path, add submission-grade documentation and architecture visuals, record the two-minute demo, and prepare the Devpost submission without expanding product scope.
