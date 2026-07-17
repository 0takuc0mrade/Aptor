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

- Define canonical credential encoding and domain separation.
- Choose the issuer authorization design supported by the installed stack.
- Add accepted-issuer and holder binding.
- Create deterministic fixtures without real client data.

**Exit:** one valid issuer-authorized credential produces a verified success.

### 3. Make altered credentials fail

- Change each signed field one at a time.
- Test unknown issuer, wrong holder, expired credential, and malformed encoding.
- Distinguish proof-construction failure from a verified negative result.

**Exit:** automated tests show every alteration fails for the intended reason.

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

Replace the caller-supplied duration with a canonical issuer-signed Aptor
credential, bind that credential to its intended holder, and prove the duration
threshold from authenticated private credential data.
