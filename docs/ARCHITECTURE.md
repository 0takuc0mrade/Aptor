# Aptor architecture

## Status

Milestone 3 implements an authenticated private credential under
`contracts/aptor-credential`. An issuer signs a fixed-width, domain-separated
credential containing an ID, holder commitment, and duration. Compact verifies
that signature against a deployment-configured public key, proves holder-secret
knowledge, checks the public duration threshold, and only then increments a
temporary public success counter. `packages/aptor-midnight` runs the generated
contract through the official local provider, proof, wallet, node, and indexer
stack. Broader predicates and structured request receipts remain later work.

## System context

```text
Issuer                    Professional                         Verifier
  │                            │                                  │
  │ create structured record   │                                  │
  │ sign / authorize commitment│                                  │
  ├───────────────────────────>│ store credential locally         │
  │                            │                                  │
  │                            │<──────── structured request ─────┤
  │                            │                                  │
  │                            │ select credential                │
  │                            │ create local witness             │
  │                            ├──── proof transaction ──────────>│ Midnight
  │                            │                                  │ verifies
  │                            │                                  │ public result
  │                            │                                  │<────────────
```

The issuer attests to work. Aptor and Midnight verify the attestation and its requested predicates; they do not establish that the issuer's claim is factually true.

## Data flow

### 1. Credential creation

The reusable issuer utility creates a bounded `DurationCredential` with
`credentialId: Bytes<32>`, `holderCommitment: Bytes<32>`, and
`durationMonths: Uint<16>`. It rejects invalid widths and durations. The
frontend is not connected to this utility yet.

### 2. Credential signing

The issuer signs
`persistentHash(["aptor:duration-credential:v1", credentialId,
holderCommitment, durationMonths])` using the Jubjub Schnorr construction from
Midnight's official ZK Loan example. TypeScript and generated Compact runtime
tests share a fixed digest vector. The accepted issuer public key is a
constructor argument stored in public ledger state; the signing key remains
outside the contract and private state.

### 3. Professional delivery and local storage

The professional receives the credential, signature, and holder secret out of
band. The private-state provider supplies those values only to the witness. A
holder commitment is derived as
`persistentHash(["aptor:holder:v1", holderSecret])` and is covered by the issuer
signature. Browser `localStorage` is not acceptable for raw credentials. A
future frontend milestone must choose wallet-managed private state or encrypted
browser storage whose key is not persisted alongside its ciphertext.

The foundation UI stores nothing and does not imply that a wallet is connected.

### 4. Proof-request creation

The verifier creates a `ProofRequest` containing only supported, bounded predicates:

- required skill;
- minimum duration in months;
- production delivery required or not;
- minimum client rating.

The request is normalized and bound to an opaque request ID or commitment. Arbitrary natural-language policies are out of scope for the Compact contract.

### 5. Credential selection

The professional evaluates compatible local credentials without revealing them to the verifier. The UI may indicate local compatibility, but it must distinguish a local pre-check from a verified Midnight result.

### 6. Proof generation

The current `proveCredentialDuration(public minimumDurationMonths)` circuit
receives the signed credential and holder secret as private witness data. It
verifies issuer authorization, holder-secret binding, and the duration
threshold. Real proofs are generated through the local HTTP proof provider.
Expiry and additional predicates are not part of the current schema.

### 7. Proof verification

The current contract records only `successfulCredentialProofs`, a temporary
counter used to confirm finalized state transitions. It is not bound to a
verifier request and must not be presented as the final receipt model. Failed
local circuit construction is not a verified `false`; the future UI must model
connection, proving, rejection, and verified-result states separately.

## Expected Compact responsibilities

The implemented contract is intentionally narrow:

1. Store one deployment-configured accepted issuer public key.
2. Hash every signed field with fixed-width descriptors and domain separation.
3. Verify issuer authorization inside Compact.
4. Verify credential integrity and holder-secret binding.
5. Evaluate one bounded private duration against a public minimum.
6. Reject altered fields, unaccepted issuers, wrong holders, and low durations.
7. Increment minimal public test instrumentation only after all assertions pass.

The contract does not store project category, skills, duration, production
status, exact rating, client/project identity, holder data, signatures, or the
raw credential.

## Expected frontend responsibilities

- Present one application with role-aware routes and navigation.
- Validate bounded credential and request fields.
- Create deterministic credential and request encodings through shared adapters.
- Connect through the supported Midnight wallet/DApp connector flow.
- Keep private credentials local and encrypted.
- Let a professional choose a credential without uploading it to Aptor.
- Surface proof generation progress and actionable failures.
- Label local checks, simulations, and on-chain verification distinctly.
- Never display a transaction hash or proof result that did not come from a real provider response.

## Repository boundaries

- `apps/web` owns presentation, role navigation, and future wallet/provider adapters.
- `packages/shared` owns typed credential and public-result boundaries.
- `packages/aptor-midnight` owns local deployment and authenticated credential-call providers.
- `contracts` owns hand-written Compact source; compiler output remains generated.
- `scripts` owns repeatable compile, deploy, fixture, and E2E commands.
- `docs` owns architectural decisions and the privacy threat model.

## Version-specific decisions

Verified on 2026-07-17:

| Component          | Local environment  | Latest tested official matrix | Decision                                                                                    |
| ------------------ | ------------------ | ----------------------------- | ------------------------------------------------------------------------------------------- |
| Node.js            | `24.15.0`          | Docs require `22+`            | Supported; CI should pin an LTS line before proof work                                      |
| Compact devtools   | `0.5.1`            | `0.5.1`                       | Aligned                                                                                     |
| Compact compiler   | `0.31.1`           | `0.31.1`                      | Pinned explicitly by the milestone-one compile script                                       |
| Compact runtime    | `0.16.0`           | `0.16.0`                      | Installed in the contract package and used by generated JavaScript tests                    |
| Midnight.js        | `4.1.1`            | `4.1.1`                       | Provider packages are pinned exactly in `@aptor/midnight`                                   |
| testkit-js         | `4.1.1`            | `4.1.1`                       | Used for the official local wallet builder                                                  |
| Wallet SDK         | `1.2.0`            | `1.2.0`                       | Aggregate package pinned for the Node integration; browser connector work remains later     |
| DApp Connector API | `4.0.1` transitive | `4.0.1`                       | Present through testkit only; no frontend connector integration exists yet                  |
| Proof server       | `8.0.3` local      | `8.1.0` for Preview/Preprod   | Local tag follows the current official standalone compose; remote matrix status is separate |

Official references:

- [Midnight compatibility matrix](https://docs.midnight.network/relnotes/support-matrix)
- [Midnight quickstart](https://docs.midnight.network/getting-started/quickstart)
- [Midnight.js guide](https://docs.midnight.network/sdks/official/midnight-js)
- [Wallet SDK guide](https://docs.midnight.network/sdks/official/wallet-developer-guide)
- [Compact hello-world tutorial](https://docs.midnight.network/getting-started/hello-world)

The official quickstart currently requires compiler `0.31.0`, while the current compatibility matrix lists `0.31.1`. Aptor treats the compatibility matrix as the release-wide authority and records this documentation discrepancy as a risk rather than guessing.

## Milestone 3 provider architecture

```text
Signed private credential + holder secret
                 │
                 ▼
Generated Aptor contract + witnesses
                 │
                 ▼
        deployContract / callTx
                 │
     ┌───────────┼──────────────┐
     ▼           ▼              ▼
Level private  Node ZK       HTTP proof
state          config        provider
     │           │              │
     └───────────┼──────────────┘
                 ▼
         local wallet provider
        balance + sign + submit
                 │
                 ▼
   local node → indexer → finalized public state
```

The Level private-state provider is set to the deployed contract address before
any circuit call. Normal logs contain lifecycle events, addresses, transaction
identifiers, and counters only; witness values and private transaction objects
are not logged.

The provider-backed test completed on 2026-07-17. The proof server recorded real
`/check` and `/prove` requests for signed passing and exact-boundary calls, the
wallet submitted them, the node applied them, and the indexer returned finalized
public state. Tampered duration, wrong holder, wrong issuer, and low duration
were rejected during generated local circuit execution before a proof request
or call transaction. See `CONTRACT_MILESTONE_3.md` for identifiers and the
public-artifact privacy inspection.

## Architecture decisions still required

1. Bounded skill representation and its membership construction.
2. Signed encodings for production delivery and private client rating.
3. Structured proof-request encoding, result binding, and replay policy.
4. Contract-safe expiry time source and revocation design.
5. Whether verifier predicates stay public or sit behind a request commitment.
6. Browser private-state provider, key custody, and recovery story.
7. Browser-wallet holder binding beyond the current credential-secret model.
8. Migration to a native Compact signature verifier when officially available.
