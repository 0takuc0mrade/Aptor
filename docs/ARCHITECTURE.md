# Aptor architecture

## Status

This document defines the Aptor architecture. The first Compact primitive is now
implemented under `contracts/aptor-credential`: it proves a private duration
meets a public minimum and increments a public success counter. The
`packages/aptor-midnight` integration binds that generated contract to the
official provider stack for local deployment and proof-backed calls. The
broader credential trust model below remains the target for later milestones.

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

The issuer enters the bounded `WorkCredential` attributes. The frontend validates ranges and required fields before canonical serialization. Exact canonical byte encoding must be fixed before signatures exist; changing field order or integer encoding after issuance would invalidate credentials.

### 2. Credential signing

The issuer authorizes a commitment to the canonical credential. The preferred MVP shape is a real signature over a domain-separated credential commitment, including the credential ID, holder binding, issue time, and expiry.

The exact signature primitive is intentionally unresolved. It must be selected from a pattern supported by Compact `0.31.x` and Midnight.js `4.1.x`, then proven with a small spike. If direct signature verification is impractical in the circuit, the fallback is an issuer-authorized on-chain credential commitment; that fallback must still preserve a real issuer authorization step and must be described accurately in the UI.

### 3. Professional delivery and local storage

The professional receives the credential payload and issuer authorization out of band. Private fields remain local. Browser `localStorage` is not acceptable for raw credentials. The integration milestone must choose either wallet-managed private state or an encrypted browser store whose key is not persisted alongside its ciphertext.

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

The Compact circuit is expected to receive the credential and authorization as private witness data, bind the credential to the professional, verify expiry and issuer acceptance, and evaluate only the requested predicates. The proof is generated locally through a compatible proof provider.

### 7. Proof verification

The contract publishes or records only the minimum verification outcome bound to the request. The verifier reads the result from public contract state or a transaction result. Failed proof construction is not the same as a verified `false`; the UI must model connection, proving, rejection, and verified-result states separately.

## Expected Compact responsibilities

The first proof contract should be intentionally narrow:

1. Maintain or reference accepted issuer keys/commitments.
2. Bind a proof request to a stable request ID or commitment.
3. Verify issuer authorization or membership of an issuer-authorized credential commitment.
4. Verify credential integrity and holder binding.
5. Enforce expiry using a network-derived or otherwise contract-bound time source.
6. Evaluate the four supported predicates with bounded encodings.
7. Disclose only requested booleans and opaque binding identifiers.
8. Reject altered witness data, unknown issuers, holder mismatches, and expired credentials.
9. Record a nullifier only if replay prevention is required by the chosen request lifecycle.

The contract must not store project category, skills, duration, production status, exact rating, issuer identity, project identity, or the raw credential.

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
- `packages/shared` owns domain types and, later, canonical codecs and validators.
- `packages/aptor-midnight` owns the focused local deployment and duration-call provider stack.
- `contracts` owns hand-written Compact source; compiler output remains generated.
- `scripts` owns repeatable compile, deploy, fixture, and E2E commands.
- `docs` owns architectural decisions and the privacy threat model.

## Version-specific decisions

Verified on 2026-07-16:

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

## Milestone 2 provider architecture

```text
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

The provider-backed test completed on 2026-07-16. The proof server recorded
real `/check` and `/prove` requests, the node applied the corresponding
transactions, and the indexer returned `SucceedEntirely` finalized data for the
passing and exact-boundary calls.

## Architecture decisions still required

1. Signature primitive and canonical credential encoding.
2. Bounded skill representation and hash/commitment function.
3. Holder-binding mechanism and identifier semantics.
4. Contract-safe expiry time source.
5. Whether request replay must be prevented and therefore needs a nullifier.
6. Whether verifier predicates are public values or hidden behind a request commitment.
7. Browser private-state provider and recovery story.
8. Exact official full-DApp template to adopt after a local proof succeeds.
