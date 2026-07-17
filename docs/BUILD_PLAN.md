# Build plan

## Implementation order

### 1. Prove one private predicate in Compact

- [x] Align local Compact compiler `0.31.1` with the official compatibility matrix.
- [x] Create the focused `contracts/aptor-credential` package.
- [x] Confirm Compact language `0.23.0`, runtime `0.16.0`, generated TypeScript surface, and provable circuit metadata.
- [x] Prove one private numeric threshold against a public bound at the generated contract-runtime layer.
- [x] Generate the prover key, verifier key, ZKIR, and binary ZKIR.
- [x] Automate passing, exact-boundary, failing, and public-surface privacy tests.
- [x] Validate deployment, real proof generation, transaction finalization, and the public counter transition through the pinned local stack.

**Exit:** compilation, generated provable-circuit execution, real proof-server
requests, local deployment, finalized call transactions, counter transitions,
and the failing no-submission path are repeatable.

### 2. Add credential integrity and valid-credential success

- [x] Define fixed-width canonical credential encoding and domain separation.
- [x] Use the official ZK Loan Jubjub Schnorr construction supported by the installed stack.
- [x] Add a deployment-configured accepted issuer and private holder-secret binding.
- [x] Create deterministic unit fixtures and ephemeral network fixtures without real client data.

**Exit:** complete. A valid issuer-signed credential produced a real proof,
finalized local transaction, and `successfulCredentialProofs` transition from
0 to 1.

### 3. Make altered credentials fail

- [x] Change duration, holder commitment, and credential ID after signing.
- [x] Test unaccepted issuer, wrong holder, threshold failure, and malformed bounds.
- [x] Distinguish local circuit rejection from proof-server and transaction submission.
- [ ] Add expiry tests only when expiry becomes part of the signed schema.

**Exit:** complete for the Milestone 3 schema. Automated unit and provider-backed
tests show every supported alteration fails before public state changes.

### 4. Implement all requested thresholds

- Add bounded skill encoding and membership.
- Add duration, production delivery, and rating predicates.
- Disclose results only for predicates present in the request.
- Test boundary values and omitted optional predicates.

**Exit:** the four-condition example passes without revealing exact values.

### 5. Integrate the frontend

- Adopt the official browser wallet/DApp connector pattern compatible with the pinned stack.
- Add credential and request forms with local validation.
- Add encrypted local credential storage.
- Add credential selection, proof progress, verified result, and actionable error states.
- Keep simulations visibly labelled.

**Exit:** the issuer → professional → verifier journey works end to end in one app.

### 6. Polish the UI

- Test keyboard navigation, focus, contrast, reduced motion, and 320/375/414/768 px widths.
- Add loading, empty, error, and recovery states.
- Remove debug data and ensure private attributes never enter logs or analytics.

**Exit:** the product is understandable without explaining it live.

### 7. Prepare the submission

- Pin versions and document setup.
- Record a short demo of valid success and altered failure.
- Add architecture and privacy diagrams based on the implemented flow.
- State real versus simulated components and known limitations.

**Exit:** another developer can reproduce the demo from a clean checkout.

## Exact next milestone

> Expand the authenticated Aptor credential to support skill membership, production-delivery status and private client-rating thresholds, then bind each verification to a structured proof request.
