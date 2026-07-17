# Privacy model

## Principle

Private credential fields stay with the professional. The current proof uses
them as witness data and discloses only whether a public duration threshold was
satisfied. Milestone 3 does not yet bind results to a structured request.

| Milestone 3 data             | Visibility                        | Location                                   | Proof use                          | Public artifact |
| ---------------------------- | --------------------------------- | ------------------------------------------ | ---------------------------------- | --------------- |
| `credentialId`               | Issuer and professional           | Signed private credential                  | Signature integrity                | No              |
| `holderCommitment`           | Issuer and professional           | Signed private credential                  | Signed field and holder comparison | No              |
| `durationMonths`             | Issuer and professional           | Signed private credential                  | Public-threshold comparison        | No              |
| Issuer signature             | Issuer and professional           | Private credential bundle                  | Issuer authentication              | No              |
| `holderSecret`               | Professional                      | Private credential bundle                  | Commitment knowledge               | No              |
| Issuer signing key           | Issuer only                       | Ephemeral memory or ignored secret storage | Signing only; never a witness      | No              |
| `acceptedIssuerPublicKey`    | Everyone                          | Contract ledger                            | Signature verification             | Yes             |
| `minimumDurationMonths`      | Verifier, professional, observers | Circuit call input                         | Threshold bound                    | Yes             |
| `successfulCredentialProofs` | Everyone                          | Contract ledger                            | Test instrumentation only          | Yes             |
| Transaction metadata         | Everyone                          | Local network/indexer                      | Finalization                       | Yes             |

## Local and private

- The raw credential and exact duration.
- Credential ID, holder commitment, issuer signature, and holder secret.
- Issuer signing key and the professional's credential inventory.
- Wallet seeds, private keys, and private-state encryption keys.

## Circuit witness

The concrete witness bundle contains the canonical `DurationCredential`, its
Jubjub Schnorr signature, and the 32-byte holder secret. The circuit verifies
the signature against the public accepted issuer key, recomputes the holder
commitment, and tests the signed duration. Witness values are not logged.

## Public inputs and state

- Contract and circuit identifiers plus normal transaction metadata.
- The deployment-configured accepted issuer public key.
- The public minimum duration supplied to the circuit.
- The temporary successful-proof counter and empty circuit return.

There is no public credential commitment, holder identifier, request ID,
nullifier, timestamp, or raw signature in Milestone 3.

## Selective disclosure

For this milestone, a finalized successful call shows that the signed duration
met one public minimum. It does not reveal the exact duration, credential ID,
holder secret/commitment, signature, client identity, or project identity. The
temporary counter is not yet a request-bound verification receipt.

## Threats to test

- Modify any signed field after issuance.
- Substitute a different professional as holder.
- Use an unknown issuer.
- Add and test expiry once expiry is part of the signed schema.
- Rebind or replay a result once structured requests exist.
- Infer exact values from overly narrow or repeated threshold requests.
- Exfiltrate raw credentials through logs, analytics, error traces, or browser storage.

Repeated adaptive requests can leak ranges even when each result is only a boolean. The MVP should rate-limit or expire requests at the product layer and document that selective disclosure does not eliminate inference attacks.
