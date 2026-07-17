# Privacy model

## Principle

Aptor publishes the verifier's request and a one-time fulfillment receipt. The
credential, holder material, specific accepted issuer, full skill set, and
exact credential values remain private witness data.

| Milestone 4 data                     |            Public? | Purpose                                      |
| ------------------------------------ | -----------------: | -------------------------------------------- |
| Request ID and commitment            |                Yes | Registration and receipt binding             |
| Accepted issuer Merkle root          |                Yes | Commits the verifier-approved set            |
| Predicate flags and requested values |                Yes | Defines what success means                   |
| Required canonical skill ID          | Yes when requested | Public requested capability                  |
| Fulfilled request ID                 |                Yes | One-time verification receipt                |
| Specific issuer public key           |                 No | Signature and private set-membership witness |
| Issuer signature and path            |                 No | Credential authorization witness             |
| Credential ID                        |                 No | Signed integrity field                       |
| Holder secret and commitment         |                 No | Holder-knowledge binding                     |
| Private skill root/list/path         |                 No | Skill membership witness                     |
| Exact credential duration            |                 No | Compared with public minimum                 |
| Credential production status         |       No raw field | Proved only when publicly required           |
| Exact credential rating              |                 No | Compared with public minimum                 |
| Issuer signing key                   | Never enters proof | Issuance only                                |

## Private witness

The Level private state contains `WorkCredentialV1`, the private issuer public
key and signature, a depth-5 issuer membership path, holder secret, private
canonical skill IDs, and a depth-5 selected-skill path. Witness functions return
only the fixed bundle required by Compact and never log it.

## Public contract state

- `requestCommitments: Map<Bytes<32>, Bytes<32>>`
- `fulfilledRequests: Set<Bytes<32>>`

There is no accepted issuer key, raw request object, credential commitment,
success counter, holder identifier, skill root, signature, or exact credential
attribute in ledger state.

## Selective disclosure

A successful receipt establishes that all enabled public criteria were
satisfied. It does not publish independent booleans or the underlying values.
When production delivery is required, success logically confirms that fact;
when rating 450 is requested, the public intentionally learns “at least 4.50,”
not the credential's exact rating.

The accepted issuer root hides which member signed, but the verifier already
knows the candidate set and may choose a singleton set. Set privacy therefore
depends on the verifier's policy as well as cryptography.

## Inspected surfaces

Generated-runtime tests inspect circuit public input/output, transcript, return,
and decoded ledger. Provider-backed tests inspect request/proof transactions,
decoded ledger, raw public-data-provider results, public API results, and the
deliberately public application log record. Findings are reported only for
these available surfaces; validator-internal data is not claimed inspected.
The scanner covers private field names, decoded scalar equality, embedded byte
sequences, high-entropy scalar bytes in both byte orders, and hexadecimal
string encodings.

## Threats and limitations

- Modify any signed credential field after issuance.
- Alter any request field after commitment registration.
- Substitute a holder secret or Merkle path.
- Prove with an issuer outside the accepted root.
- Replay an already fulfilled request.
- Infer ranges with repeated or overly narrow public thresholds.
- Use a singleton issuer set to remove practical issuer anonymity.
- Exfiltrate witness data through logs, browser storage, analytics, or errors.
- Treat possession of a holder secret as legal or wallet identity.

Expiry, revocation, request expiration, browser custody, legal issuer identity,
and anti-collusion policy remain outside Milestone 4.
