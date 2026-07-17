# Aptor credential contract

This package contains Aptor's authenticated private-duration Compact contract.
It proves that the deployment-configured issuer signed an unmodified
credential, the prover knows the credential's holder secret, and the signed
private duration is greater than or equal to a public verifier minimum.

`acceptedIssuerPublicKey` and the temporary
`successfulCredentialProofs` counter are public ledger fields. The credential,
signature, holder commitment, holder secret, and exact duration are private
witness data. Every assertion succeeds before the counter changes.

`issuer.ts` centralizes secure-random issuer and holder key material, canonical
Compact-compatible hashing, credential creation, signing, and verification.
The Compact Schnorr verifier follows Midnight's official ZK Loan example rather
than introducing a separate cryptographic construction.

## Commands

```bash
npm run compact
npm run compact:check
npm run typecheck
npm test
```

`npm run compact` invokes the officially supported compiler explicitly as
`compact compile +0.31.1`. Pinning the full version keeps generated APIs and ZK
artifacts repeatable even when another Compact compiler is selected globally.

Generated compiler output is written to `generated/aptor/` and ignored by Git.
It must be regenerated before TypeScript builds or tests.

The compiled wrapper exported by this package is consumed by
`packages/aptor-midnight`. See `docs/CONTRACT_MILESTONE_3.md` for the trust
model, test vectors, real local proof and transaction evidence, privacy
inspection, and limitations.
