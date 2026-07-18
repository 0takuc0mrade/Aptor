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

## Browser custody

One AES-256-GCM account container in IndexedDB holds every role's private state,
the raw access capability, and the P-256 private encryption key. PBKDF2-HMAC-
SHA-256 derives a key from the user password with a random 32-byte salt and
310,000 iterations; each encryption uses a fresh 12-byte IV and authenticated
context data. Passwords and derived keys are not persisted. Locking the profile
clears the in-memory session.

The default handoff uses recipient-key envelope encryption. Portable public
files contain only the holder commitment, Issuer public key, or registered
request fields appropriate to their role. Portable credentials remain an
authenticated encrypted container protected by a separately shared transfer
passphrase under Advanced.

## Delivery privacy

Each envelope uses a fresh ephemeral P-256 ECDH keypair. HKDF-SHA-256 derives an
AES-256-GCM key under versioned context containing sender, recipient, envelope
type, and content digest. A fresh 12-byte nonce protects each encryption. The
recipient derives the key locally from the encrypted account vault. Sender and
recipient binding is authenticated as additional data, so rerouting or field
tampering fails closed.

The delivery service stores ciphertext, nonce, ephemeral public key,
encryption version, and routing metadata. It stores no plaintext credential
payload, holder secret, Issuer signing key, private encryption key, raw access
capability, or vault password. Public proof-request tracking contains only data
already public or intended to be public on Midnight.

The backend can observe who communicates with whom, when, the envelope type,
and approximate payload size. Aptor does not claim network-level or metadata
privacy.

## Private witness

The browser proof-scoped private state contains `WorkCredentialV1`, the private
issuer public key and signature, a depth-5 issuer membership path, holder
secret, private canonical skill IDs, and a depth-5 selected-skill path. It is
hydrated from the unlocked vault only after explicit credential selection,
cannot be exported, and is disposed after success, failure, timeout, or vault
lock. Node provider tests use a separate ignored Level store.

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

Generated-runtime tests inspect circuit public input/output, transcript,
return, and decoded ledger. Provider-backed tests inspect request/proof
transactions, decoded ledger, raw public-data-provider results, public API
results, and the deliberately public application log record. Browser tests
also inspect the IndexedDB record, public portable files, `localStorage`, and
the public receipt UI. The repository scan checks production source for
private values sent to console/localStorage/URL-like sinks and literal wallet
or credential secrets. Findings are limited to inspected surfaces; the scan
cannot establish that the browser, extensions, dependencies, or operating
system are uncompromised.

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

Expiry, revocation, request expiration, multi-device recovery, legal Issuer
identity, capability renewal, and anti-collusion policy remain outside
Milestone 6. This hackathon account is device-bound and has no recovery flow. A
forgotten vault password or lost private encryption key cannot be recovered. A
Verifier can deliberately choose a singleton Issuer set or make repeated
threshold requests, so product policy is still required alongside cryptography.
