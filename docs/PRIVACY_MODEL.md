# Privacy model

## Principle

Private credential fields stay with the professional. The proof uses them as witness data and discloses only request-bound results. Public state contains the minimum information required to validate issuer acceptance, bind a request, and prevent misuse.

| Data field                     | Who can see it                                                        | Stored where                                           | Enters proof?                               | Becomes public?                                                              |
| ------------------------------ | --------------------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------- | ---------------------------------------------------------------------------- |
| `credentialId`                 | Issuer, professional                                                  | Signed local credential                                | Yes, for integrity/binding                  | Prefer commitment or nullifier only                                          |
| `holderId`                     | Issuer, professional                                                  | Signed local credential and holder key context         | Yes, for holder binding                     | No raw identifier                                                            |
| `issuerId`                     | Issuer, professional; registry may expose an issuer key or commitment | Signed local credential; accepted-issuer registry      | Yes                                         | Only accepted key/commitment as required; client identity need not be public |
| `projectCategory`              | Issuer, professional                                                  | Signed local credential                                | Only if a future request supports it        | No in initial MVP                                                            |
| `skills`                       | Issuer, professional                                                  | Signed local credential                                | Yes when skill is requested                 | No; only the requested boolean                                               |
| `durationMonths`               | Issuer, professional                                                  | Signed local credential                                | Yes when a threshold is requested           | No; only pass/fail                                                           |
| `deliveredToProduction`        | Issuer, professional                                                  | Signed local credential                                | Yes when requested                          | No; only pass/fail                                                           |
| `clientRating`                 | Issuer, professional                                                  | Signed local credential                                | Yes when a threshold is requested           | No exact value; only pass/fail                                               |
| `issuedAt`                     | Issuer, professional                                                  | Signed local credential                                | Yes for signed integrity and policy checks  | Not required as raw value                                                    |
| `expiresAt`                    | Issuer, professional                                                  | Signed local credential                                | Yes for expiry                              | Not required as raw value                                                    |
| Issuer signature/authorization | Issuer, professional                                                  | Alongside local credential                             | Yes                                         | No raw signature unless the selected design requires it                      |
| Credential commitment          | Issuer, professional, network observers                               | Local credential and/or contract state                 | Yes                                         | Opaque commitment may be public                                              |
| Accepted issuer key/commitment | Everyone                                                              | Contract state or referenced registry                  | Yes                                         | Yes, at the minimum granularity needed for trust                             |
| Required skill                 | Verifier, professional                                                | Proof request; optionally public request state         | Yes                                         | Usually public for MVP; may be committed later                               |
| Minimum duration               | Verifier, professional                                                | Proof request; optionally public request state         | Yes                                         | Usually public for MVP                                                       |
| Production requirement         | Verifier, professional                                                | Proof request; optionally public request state         | Yes                                         | Usually public for MVP                                                       |
| Minimum rating                 | Verifier, professional                                                | Proof request; optionally public request state         | Yes                                         | Usually public for MVP                                                       |
| Proof-request ID/commitment    | Everyone                                                              | Contract state                                         | Yes                                         | Yes, opaque                                                                  |
| Per-requirement results        | Verifier, professional, network observers if stored on chain          | Transaction result or contract state                   | Proof output                                | Yes if recorded; contains booleans only                                      |
| Credential nullifier           | Everyone                                                              | Contract state, only if replay prevention is required  | Yes                                         | Yes, opaque and unlinkable beyond intended scope                             |
| Wallet seed/private keys       | Professional only                                                     | Wallet-controlled storage                              | Used by wallet, never as credential witness | Never                                                                        |
| Raw private credential         | Issuer and professional                                               | Issuer system and encrypted professional-local storage | Yes                                         | Never                                                                        |

## Local and private

- The raw credential and its confidential attributes.
- Issuer authorization material not required in public state.
- The professional's credential inventory and selection process.
- Wallet seeds, private keys, and private-state encryption keys.
- Exact values used to satisfy thresholds.

## Circuit witness

The witness is expected to include the canonical credential, issuer authorization or membership path, holder-binding secret or proof, and any private request material. The concrete shape depends on the signature and commitment spike.

## Public inputs and state

- Network or contract identifier.
- Accepted issuer key/commitment or registry root.
- Request ID/commitment and supported predicate values if public.
- Credential commitment/nullifier only where required.
- A time value sourced in a way the contract can trust.
- Requested boolean results.

## Selective disclosure

For each requested condition, the verifier learns a boolean and which request it belongs to. The verifier must not receive the exact private value, unrequested conditions, client identity, project identity, or a reusable credential payload.

## Threats to test

- Modify any signed field after issuance.
- Substitute a different professional as holder.
- Use an unknown issuer.
- Use an expired credential.
- Rebind a valid proof to another request.
- Replay a proof when the request is intended to be single-use.
- Infer exact values from overly narrow or repeated threshold requests.
- Exfiltrate raw credentials through logs, analytics, error traces, or browser storage.

Repeated adaptive requests can leak ranges even when each result is only a boolean. The MVP should rate-limit or expire requests at the product layer and document that selective disclosure does not eliminate inference attacks.
