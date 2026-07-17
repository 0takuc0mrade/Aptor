# Contract milestone 4 — request-bound professional capability proof

## Outcome

Milestone 4 replaces the public single-issuer key and temporary success counter
with verifier-defined issuer-set commitments, structured proof-request
commitments, and one-time fulfillment receipts. A successful proof establishes
that one private issuer-signed credential from the accepted set satisfied every
enabled request criterion without identifying the issuer or disclosing the
credential.

Provider-backed result: passed on the pinned LocalNet. The request registration
finalized at block 542, the request-bound proof finalized at block 546, all
required negative cases remained unfulfilled, and privacy inspection reported
zero findings.

## 1. Credential schema

```text
WorkCredentialV1 {
  credentialId: Bytes<32>
  holderCommitment: Bytes<32>
  skillsRoot: MerkleTreeDigest
  durationMonths: Uint<16>
  deliveredToProduction: Boolean
  clientRatingHundredths: Uint<16> // constrained to 0–500
}
```

The schema deliberately excludes client/project identity, repositories,
documents, arbitrary metadata, expiry, and revocation.

## 2. Credential canonical encoding

The issuer signs the `persistentHash` of this fixed tuple:

```text
[
  Bytes<24> "aptor:work-credential:v1",
  Bytes<32> credentialId,
  Bytes<32> holderCommitment,
  MerkleTreeDigest skillsRoot,
  Uint<16> durationMonths,
  Boolean deliveredToProduction,
  Uint<16> clientRatingHundredths
]
```

Every protected field is included. TypeScript constructs the same Compact
descriptors in the same order; generated-runtime parity tests compare the two
digests. JSON, property ordering, locale formatting, and display strings do not
participate in signing.

The signature remains the Jubjub Schnorr construction from Midnight's official
[ZK Loan example](https://github.com/midnightntwrk/example-zkloan), pinned in
Milestone 3. The 32-byte digest is framed as
`[transientHash(digest), 0, 0, 0]` before signing and Compact verification.

## 3. Skill normalization

`canonicalSkillId(displaySkill)` applies these rules in order:

1. Unicode NFKC normalization;
2. leading/trailing whitespace removal;
3. Unicode lowercase conversion;
4. consecutive whitespace collapse to one ASCII space;
5. rejection of an empty result;
6. UTF-8 encoding limited to 64 bytes;
7. zero-padding to `Bytes<64>` with the real byte length bound separately;
8. `persistentHash` under `aptor:skill:id:v1`.

`Rust`, `rust`, `RUST`, and full-width `ＲＵＳＴ` therefore resolve to the
same identifier. Raw skill strings never enter Compact.

## 4. Private skill Merkle tree

The skill tree uses Compact's standard `MerkleTreePath<5, Bytes<32>>` semantics.
Canonical IDs are deduplicated and sorted lexicographically. Depth 5 is the
smallest depth supporting the required 32 unique skills. Unused leaves repeat
the final real leaf, so padding does not introduce another provable skill.

The TypeScript builder uses the official Compact runtime primitives and exact
standard-library construction observed in generated code:

- leaf: `degradeToTransient(persistentHash([Bytes<6> "mdn:lh", leaf]))`;
- parent: `transientHash<Vector<2, Field>>([left, right])`.

Generated Compact recomputes the root with `merkleTreePathRoot`. Tests confirm
TypeScript paths resolve to the same root. The full list, signed root, and path
remain private; only a requested skill ID may be public.

## 5. Accepted issuer Merkle tree

Verifier-approved Jubjub public keys are deduplicated and sorted by `(x, y)` in
a separate depth-5 tree. Unused leaves repeat the final accepted key. The
request contains only this tree's root.

The professional privately supplies the signing issuer key and its path.
Compact requires the path leaf to equal that private key, verifies the
credential signature against it, and requires the path root to equal the
request's public `acceptedIssuerRoot`.

This proves key membership, not company-domain ownership, legal identity, or
the factual truth of the signed claim. A verifier can also choose a singleton
set, so practical issuer anonymity depends on verifier policy.

## 6. Proof request schema and commitment

```text
ProofRequestV1 {
  requestId: Bytes<32>
  acceptedIssuerRoot: MerkleTreeDigest
  checkSkill: Boolean
  requiredSkillId: Bytes<32>
  checkDuration: Boolean
  minimumDurationMonths: Uint<16>
  requireProductionDelivery: Boolean
  checkClientRating: Boolean
  minimumClientRatingHundredths: Uint<16>
}
```

The commitment is the persistent hash of every field, in that order, prefixed
with `Bytes<22> "aptor:proof-request:v1"`. TypeScript/generated-Compact parity
is tested. At least one predicate must be active. A rating minimum above 500 is
rejected when rating checking is enabled.

Disabled predicates remain commitment-bound but are not enforced against the
credential. Tests use deliberately failing placeholder values of 65,535 for
disabled duration and rating predicates.

## 7. Request registration

`createProofRequest(requestId, requestCommitment)`:

1. rejects an existing request ID;
2. stores only the ID-to-commitment mapping;
3. does not read private credential state;
4. leaves the request unfulfilled.

The complete request may travel to the professional outside the chain. It is
not confidential in this milestone.

## 8. Request fulfillment and replay prevention

`proveAgainstRequest(request)` performs these checks before writing state:

1. at least one active requirement and valid enabled rating bound;
2. registered request ID;
3. exact registered request commitment;
4. request not already fulfilled;
5. credential rating within 0–500;
6. valid issuer signature over the complete credential;
7. private issuer-key membership in the request's accepted root;
8. holder-secret commitment equality;
9. selected skill membership when enabled;
10. duration threshold when enabled;
11. production delivery when required;
12. rating threshold when enabled.

Only then is the request ID inserted into `fulfilledRequests`. A second attempt
fails before proof generation and cannot create another receipt.

## 9. Public receipt model

Public ledger state is limited to:

```text
requestCommitments: Map<Bytes<32>, Bytes<32>>
fulfilledRequests: Set<Bytes<32>>
```

Successful set membership is the receipt that all criteria in the committed
request passed. Separate result booleans are unnecessary and would add public
state without more meaning.

## 10. Private state

The professional's private state contains:

- `WorkCredentialV1`;
- specific issuer public key and signature;
- issuer membership path;
- holder secret;
- private canonical skill IDs;
- selected skill membership path.

The issuer signing key is used only to issue and never enters this bundle.
Runtime helpers generate random issuer keys, holder secrets, credential IDs,
and request IDs with Node's cryptographically secure random source. Fixed keys
and IDs exist only in test fixtures.

## 11. Unit-test results

Command: `npm run contract:test`.

Result: 22 passed, 0 failed; the final parallel validation run completed in
2.309 seconds after the full compile.

Coverage includes complete success, disabled predicates, normalization,
deduplication, capacity, skill/issuer tree parity, credential/request digest
parity, signature verification, missing and invalid skill paths, duration,
production and rating failures, rating bounds, untrusted and invalid issuer
paths, all six signed-field mutations, every request-field mutation, wrong
holder, duplicate request, replay, empty request, fixed path depth, and public
surface privacy.

## 12. Provider-backed LocalNet results

Command: `npm run midnight:test:network`.

Result: 1 passed, 0 failed in 141.049 seconds against the real local node,
indexer, proof server, wallet, Level private-state provider, and generated ZK
configuration.

| Evidence                      | Public identifier                                                    | Block |
| ----------------------------- | -------------------------------------------------------------------- | ----: |
| Passing contract              | `3bbe4dbbce9d2658d097ab7c6e9cf621d6ca1f7d4cb7c3da660bb09abe4fd6db`   |     — |
| Deployment transaction        | `00c6e36498df21b334851d1ed9fa09dc861084325797363c2c32a5df15993019cf` |   539 |
| Request-creation transaction  | `00f07a80e02705e63276cd046c90bda7a4e4c3073be2a41d2d84c808a4ba14de90` |   542 |
| Fulfillment proof transaction | `0022b6f002508d1086390c080fa9b14522a801c1fea4baf913f5a960592dfa7fa6` |   546 |
| Untrusted-issuer contract     | `6e64b456fe8b0a7b00b3ee8d3e37958a084e4987219cb13ce6a5e9e1994c049a`   |     — |

The decoded public ledger contained the registered commitment before proving,
showed the request unfulfilled at that point, and contained the request ID in
`fulfilledRequests` only after the proof transaction finalized.

## 13. Failure stages

- Replay failed in generated local circuit execution because the request was
  already fulfilled; proof-provider and wallet-submission counts did not
  increase.
- The altered rating threshold failed commitment equality before proving. Its
  registration transaction was
  `00a9dd64fa004639a72b6f2277c89fedc7001b8b167fc68a8ed144906b0221c54a`.
- The absent `Go` skill failed because the private path leaf was for a different
  skill. Its registration transaction was
  `003f5fa81533fdfeaf2de12f020bc13d4324bc0df8f416ef03f5b88d5c06d31cc0`.
- The correctly signed but untrusted issuer failed issuer-root membership. Its
  registration transaction was
  `00b2f2d8977caab52f7a0b0097f9e2b0eccded673c491589d8a508a64a77ecafa0`.

Each negative case failed during generated local circuit execution before the
proof provider and before wallet submission. Every corresponding request
remained unfulfilled.

## 14. Privacy inspection

Generated-runtime inspection covers circuit public input/output, public
transcript, return value, and decoded ledger. Provider-backed inspection covers
the request-creation transaction, proof transaction, decoded ledger, raw
public-data-provider result, API results, and the deliberately public
application log record.

The scanner checks decoded private field names and scalar equality, embedded
private byte sequences inside larger byte arrays, high-entropy scalar encodings
in both byte orders, and hexadecimal string encodings.

Result: zero findings across every inspected provider-backed surface. The
deliberate application log contained only the public request criteria, contract
address, transaction identifier, and fulfillment result; it contained no
credential or witness data.

The request intentionally exposes its ID, commitment, accepted issuer root,
predicate flags, requested skill ID, thresholds, production requirement, and
fulfillment state. The exact credential values and specific issuer must not be
present as independent public data.

## 15. Merkle capacities and circuit observations

Both trees have depth 5 and capacity 32, the smallest configuration satisfying
the requested skill capacity. The compiled artifacts are:

| Circuit               |   Prover key | Verifier key |     ZKIR | Binary ZKIR |
| --------------------- | -----------: | -----------: | -------: | ----------: |
| `createProofRequest`  |    279,495 B |      1,351 B |  2,975 B |       184 B |
| `proveAgainstRequest` | 11,044,835 B |      2,311 B | 14,949 B |     1,062 B |

The full Compact proving-artifact compile took approximately 29 minutes 22
seconds on the validation machine. The depth-5 fulfillment circuit passed real
proof generation, node submission, and finalization at block 546 without a
block-size or execution-limit rejection.

## 16. Validation record

- `npm install`: up to date.
- Compact `+0.31.1` full compilation: passed for both circuits; prover,
  verifier, ZKIR, binary ZKIR, and generated bindings were emitted. The
  generated TypeScript package build passed.
- Compact formatting and all workspace TypeScript checks: passed.
- Credential/request digest parity, canonical skill parity, Merkle-tree parity,
  signing, holder binding, mutation, replay, and privacy tests: 22 passed, 0
  failed.
- `npm run midnight:network:up` and the hardened
  `npm run midnight:network:health`: node, indexer, and proof server healthy.
- Provider-backed test: 1 passed, 0 failed in 141.049 seconds. Proof-server logs
  recorded 5 successful `POST /check` and 12 successful `POST /prove` calls.
- The passing deployment, request registration, and fulfillment finalized at
  blocks 539, 542, and 546. Every failed case remained unfulfilled without a
  proof-provider call or wallet submission.
- Public-state and strict byte/scalar privacy inspection: zero findings.
- LocalNet teardown: passed.
- Repository formatting, frontend lint, workspace typecheck, credential and
  Midnight package builds, and the five-route frontend production build:
  passed.

The proof-server health helper was hardened to require an HTTP response from
the actual service. A TCP connection alone can terminate at Docker's host proxy
while the container is still downloading proving assets and is therefore not a
valid readiness signal.

## 17. Reproduction

```bash
npm install
npm run contract:compile
npm run contract:build
npm run contract:typecheck
npm run contract:test
npm run midnight:build
npm run midnight:network:up
npm run midnight:network:health
npm run midnight:test:network
npm run midnight:network:down
npm run format:check
npm run lint
npm run typecheck
npm run build
```

The proof server may need an extended first start while official proving assets
are downloaded and verified. Compose's container-local health check is the
authoritative readiness signal.

## 18. Known limitations

- Issuer-set roots establish key membership, not legal issuer identity.
- A singleton accepted set reveals the only possible issuer by inference.
- Holder-secret knowledge is not browser-wallet or legal-identity binding.
- Requests do not expire and registration is not role-authorized.
- Credentials have no expiry or revocation.
- One credential and one required skill are supported per proof.
- Repeated thresholds can narrow private values.
- The Schnorr Compact polyfill remains until a validated native verifier exists.
- The result is local-only; no Preview/Preprod deployment was attempted.
- The existing frontend is not connected to this flow.

## Recommended next milestone

> Connect the existing Issuer, Professional and Verifier interfaces to the real Aptor contract, add wallet-backed role sessions and encrypted local credential storage, and complete the end-to-end browser workflow without fabricated data.
