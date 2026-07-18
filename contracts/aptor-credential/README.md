# Aptor credential contract

This package contains Aptor's request-bound private capability contract. A
verifier registers a commitment to a structured request. The professional then
proves that one signed private credential satisfies every enabled requirement.

Public state contains only `requestCommitments` and `fulfilledRequests`. The
specific issuer key, issuer and skill paths, signature, credential, holder
material, private skill set, exact duration, production status, and exact
rating remain witness data. A request is marked fulfilled only after every
assertion succeeds.

`issuer.ts`, `merkle.ts`, and `request.ts` centralize secure-random issuer,
holder and request material, skill normalization, Compact-compatible depth-5
Merkle trees, fixed credential/request encodings, signing, and verification.
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

The compiled wrapper is consumed by both `packages/aptor-midnight` and the
browser boundary in `packages/aptor-browser`. The web app's build copies only
the six public ZK artifacts into `/zk/aptor` and validates that every prover,
verifier, and ZKIR file exists. The `proveAgainstRequest` prover key is
approximately 11 MB, so its first browser load is expected to be visible.

See `docs/CONTRACT_MILESTONE_4.md` for the contract trust model and
`docs/PRODUCT_MILESTONE_5.md` for browser provider, vault, transport, and real
LocalNet E2E evidence.
