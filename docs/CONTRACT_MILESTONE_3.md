# Contract milestone 3 — authenticated private work credential

## Outcome

Milestone 3 replaces Aptor's caller-supplied duration with a canonical,
issuer-signed private credential. The Compact circuit now proves all three
claims before changing public state:

1. the deployment-configured issuer signed the credential;
2. the prover knows the holder secret committed inside that signed credential;
3. the signed private duration meets the verifier's public minimum.

The final provider-backed run completed on 2026-07-17 against the pinned local
Midnight stack. It produced real proofs and finalized transactions for the
12/6 success and 6/6 boundary cases. Tampered duration, wrong holder, wrong
issuer, and 3/6 threshold cases stopped during local circuit execution before
the proof provider or call-transaction submission.

## 1. Trust model

For this milestone, an issuer is a previous client or employer, the holder is
the professional, and the verifier is an employer requesting a minimum-duration
proof.

Aptor proves that the accepted issuer authorized an unmodified credential, that
the prover knows its holder secret, and that its private duration satisfies the
public request. Aptor does not independently establish that the issuer's
original statement was factually true.

The holder mechanism is credential-secret binding. It is not browser-wallet
identity binding, legal identity verification, or proof that only one person
has ever known the secret.

## 2. Credential schema

The only signed fields are:

```text
DurationCredential {
  credentialId: Bytes<32>
  holderCommitment: Bytes<32>
  durationMonths: Uint<16>
}
```

Skills, ratings, production delivery, project/client identity, expiry,
revocation, and arbitrary metadata are intentionally absent.

Private state contains the credential, its Jubjub Schnorr signature, and the
32-byte holder secret. The accepted issuer public key is supplied as a
constructor argument and stored in public ledger state. The issuer signing key
is never passed to the contract.

## 3. Domain separation and canonical encoding

The canonical credential preimage is the fixed Compact tuple:

```text
[
  Bytes<28>  "aptor:duration-credential:v1",
  Bytes<32>  credentialId,
  Bytes<32>  holderCommitment,
  Uint<16>   durationMonths
]
```

`persistentHash` maps that tuple to the 32-byte credential digest. The
TypeScript issuer utility builds the same Compact runtime descriptors and
field-aligned value in the same order. No JSON, property-order convention,
locale encoding, or human-readable integer serialization participates in the
signature.

The fixed test vector uses credential ID `0x24` repeated 32 times, holder
secret `0x42` repeated 32 times, and duration `12`. Both TypeScript and the
generated Compact `deriveCredentialDigest` circuit produce:

```text
1374ba9720e64a91a12e46445ca2865ffcd571b9336707d2ea72d22a95556501
```

## 4. Issuer signature primitive

Aptor uses the Jubjub Schnorr construction maintained by Midnight's official
[ZK Loan example](https://github.com/midnightntwrk/example-zkloan) at commit
`141ef7b0c029879862f2d40ac50fec6d15e572b6` (2026-06-26). The copied Compact
module retains its Apache-2.0 attribution. This is the current official example
pattern because Compact `0.31.1` does not yet expose the example's planned
`jubjubSchnorrVerify` standard-library primitive.

The 32-byte persistent credential digest is framed as the official example's
four-field message:

```text
[transientHash<Bytes<32>>(credentialDigest), 0, 0, 0]
```

The signature challenge covers the announcement point, issuer public key, and
all four message fields. The circuit verifies the same Jubjub equation and
witness-assisted 248-bit challenge reduction as the official example. Aptor
did not introduce another cryptography dependency or a new signature scheme.

The TypeScript issuer utility provides secure-random issuer key generation,
holder-secret generation, random credential IDs, bounded credential creation,
digest derivation, signing, public-key derivation, and verification. Fixed
issuer keys exist only in `test/fixtures.ts`; production helpers do not accept
fixed randomness or log secret material.

## 5. Holder binding

The holder commitment is:

```text
persistentHash([
  Bytes<15> "aptor:holder:v1",
  Bytes<32> holderSecret
])
```

The issuer signs the resulting commitment as part of the credential digest.
During proof generation, the circuit derives the commitment from the private
holder secret and requires equality with the signed private credential. A
different holder secret therefore fails even when the issuer signature itself
is valid.

## 6. Circuit assertions and public state

`proveCredentialDuration(public minimumDurationMonths)` performs, in order:

1. read the credential bundle through a witness;
2. derive the fixed credential digest;
3. verify the issuer signature against `acceptedIssuerPublicKey`;
4. derive and compare the holder commitment;
5. compare signed private duration with the public minimum;
6. increment `successfulCredentialProofs`.

`successfulCredentialProofs` is temporary test instrumentation for confirming
finalized state changes. It is not Aptor's final verification-receipt model.

Public data is limited to the accepted issuer public key, requested minimum,
contract/circuit identifiers and normal transaction metadata, the empty circuit
return, and the counter. No raw credential attribute is stored in ledger state.

## 7. Unit and cross-language results

Command:

```bash
npm run contract:test
```

Result: 12 tests passed, 0 failed.

Covered cases:

- accepted issuer, signed 12 months, correct holder, minimum 6;
- exact signed boundary 6/6;
- signed 3/6 threshold rejection;
- duration changed from 12 to 24 after signing;
- holder commitment changed after signing;
- wrong holder secret;
- signature from an unaccepted issuer;
- credential ID changed after signing;
- fixed TypeScript/generated-Compact credential digest vector;
- off-chain sign/verify and tamper rejection;
- invalid `Uint<16>` and `Bytes<32>` inputs;
- generated-runtime public-surface privacy inspection.

Tampered signed fields and wrong issuer fail with `Invalid issuer signature`.
Wrong holder fails with `Holder secret does not match the signed credential`.
The 3/6 case fails with `Signed private duration does not satisfy the public
minimum`.

## 8. Provider-backed local network results

Stack health passed for:

- node `0.22.5`;
- indexer standalone `4.0.2`;
- proof server `8.0.3`.

Command:

```bash
npm run midnight:test:network
```

Result: 1 serial provider-backed test passed, 0 failed, in 151.691 seconds.

### Successful authenticated credential

```text
contract address:
b0ec7c43ad59d6e186fd58f92b739a88c2c7ccd802fc18d3ea231aa21efeac52

deployment transaction:
00db83969d8d7558ded207f5d813ecb059ec648c7060197ba451121f529a58ad47

authenticated call transaction:
003244fc8d19d4333f967d7b3a4e716ba44fec2ab63eb7b56f0dd2e27f2dde2d47

successfulCredentialProofs: 0 -> 1
```

The test generated an ephemeral issuer keypair and holder secret, deployed with
the issuer public key, signed a 12-month credential, invoked the circuit at
minimum 6, observed one call to the proof-provider wrapper, submitted one call
transaction, waited for finalized indexer data, and read the incremented public
counter.

Proof-server access evidence for the call:

```text
2026-07-17T10:21:44.569323Z Starting to process request for /check
2026-07-17T10:21:44.572458Z POST /check HTTP/1.1
2026-07-17T10:21:44.642817Z Starting to process request for /prove
2026-07-17T10:21:46.207994Z POST /prove HTTP/1.1
```

### Exact boundary

```text
contract address:
e0efb000b2be8941191f870c20ef41705074a7d9a9ba3513b754ec1f0d41944d

authenticated call transaction:
008fd71d268581871a169c1af8e4ec1dd93ccc63ae4498d394d6b8b07bc1708b4c

successfulCredentialProofs: 0 -> 1
```

The proof server recorded `/check` at `10:22:20.548185Z` and `/prove` at
`10:22:20.610835Z` for the boundary call.

### Rejected cases

Each rejected fixture was deployed with public counter 0. The call then failed
during generated local circuit execution:

| Case                                  | Failure                  | Proof provider after call | Call submitted | Counter after |
| ------------------------------------- | ------------------------ | ------------------------: | -------------: | ------------: |
| signed 12, changed to 24              | invalid issuer signature |                         0 |              0 |             0 |
| correctly signed, wrong holder secret | holder binding           |                         0 |              0 |             0 |
| signed by unaccepted issuer           | invalid issuer signature |                         0 |              0 |             0 |
| signed 3, requested 6                 | threshold assertion      |                         0 |              0 |             0 |

The proof-server log contains only the deployment `/prove` requests at
`10:22:39`, `10:22:56`, `10:23:15`, and `10:23:32` for those four fixtures. No
rejected call reached `/check` or the contract proof path, and wallet submission
counters did not change after each attempted call.

## 9. Privacy inspection

The generated-runtime test inspected circuit public input, circuit public
output, public transcript, circuit return, and decoded ledger keys. The
provider-backed test inspected:

- finalized deployment data;
- finalized call transaction data;
- decoded contract ledger;
- the raw public-data provider contract-state response;
- the contract API return value;
- the deliberately public application log record.

The inspection searched for private field names and exact values for credential
ID, holder commitment, holder secret, duration, signature response, and
signature announcement coordinates. It found zero matches. The only ledger
keys were `acceptedIssuerPublicKey` and `successfulCredentialProofs`; the public
minimum was 6 and the circuit return was empty.

No project information existed in the milestone schema, so none could be
exposed. The inspection does not claim visibility into validator-internal or
cryptographic implementation artifacts that the local APIs did not return.

## 10. Validation record

The following passed on 2026-07-17:

```text
npm install
npm --prefix contracts/aptor-credential run compact:check
npm run contract:compile
npm run contract:build
npm run contract:typecheck
npm run contract:test
npm run midnight:build
npm run midnight:network:up
npm run midnight:network:health
npm run midnight:test:network
npm run typecheck
npm run format:check
npm run lint
npm run build
```

The first cold Docker start exhausted the Compose proof-server health retries
while official proving assets were downloading. The direct endpoint health
check then passed, and a second `network:up --wait` passed with all three
containers healthy before the successful network suite. Containers were
removed with `npm run midnight:network:down` after log capture.

## 11. Reproduction

```bash
npm install
npm run contract:compile
npm run contract:build
npm run contract:typecheck
npm run contract:test
npm run midnight:network:up
npm run midnight:network:health
npm run midnight:test:network
npm run midnight:network:down
```

Generated keys, ZKIR, private-state databases, credentials, and local secrets
remain ignored. The tests generate non-deterministic issuer and holder secrets
ephemerally and never print them.

## 12. Known limitations

- One accepted issuer key is fixed per deployment.
- The official example's temporary Schnorr Compact module should be replaced
  when the native standard-library verifier becomes available and is validated.
- Holder-secret knowledge is not browser-wallet or legal-identity binding.
- No expiry, revocation, replay prevention, or request-bound receipt exists.
- The public counter is test instrumentation and does not identify a verifier
  request.
- Repeated threshold requests can narrow a private duration range.
- Local development deployment is not a remote Preview/Preprod deployment.
- The frontend remains unchanged and is not connected to this flow.

## 13. Recommended next milestone

> Expand the authenticated Aptor credential to support skill membership, production-delivery status and private client-rating thresholds, then bind each verification to a structured proof request.
