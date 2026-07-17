# Aptor credential contract

This package contains Aptor's first Compact privacy primitive. It proves that a
private project duration is greater than or equal to a public verifier minimum.

The contract has one public `Counter` ledger field. A successful call exposes
the public minimum through the circuit input and increments the success counter,
while the exact duration is supplied by a local witness and remains outside
public ledger state and circuit output. A failing duration triggers the circuit
assertion before the counter can change.

## Commands

```bash
npm run compact
npm run typecheck
npm test
```

`npm run compact` invokes the officially supported compiler explicitly as
`compact compile +0.31.1`. Pinning the full version keeps generated APIs and ZK
artifacts repeatable even when another Compact compiler is selected globally.

Generated compiler output is written to `generated/aptor/` and ignored by Git.
It must be regenerated before TypeScript builds or tests.

The compiled wrapper exported by this package is consumed by
`packages/aptor-midnight`. See `docs/CONTRACT_MILESTONE_2.md` for the real local
proof and transaction results.
