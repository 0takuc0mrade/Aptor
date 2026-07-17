# Contract milestone 1 — private duration threshold

## Status

Implemented and validated at the Compact contract and generated-runtime layer on
2026-07-16.

The compiler marks `proveDuration` as a provable circuit and generates its
prover key, verifier key, ZKIR, binary ZKIR, JavaScript implementation, and
TypeScript declarations. Automated tests execute the generated provable circuit
and its real Compact assertion. This milestone does not deploy the contract or
submit a transaction through a wallet, node, indexer, or proof server.

## What the contract proves

The contract proves the following bounded statement:

```text
private durationMonths >= public minimumDurationMonths
```

The private duration is provided by the caller through a Compact witness. The
public minimum is a `Uint<16>` circuit argument. When the assertion succeeds,
the public `successfulProofs` counter increments by one. When it fails, circuit
execution throws before the counter changes.

```compact
witness durationMonths(): Uint<16>;

export circuit proveDuration(minimumDurationMonths: Uint<16>): [] {
  assert(
    durationMonths() >= minimumDurationMonths,
    "Private duration does not satisfy the public minimum"
  );
  successfulProofs.increment(1);
}
```

Publishing a `false` result was deliberately avoided. A valid proof produces a
successful state transition; an invalid witness cannot satisfy the assertion.

## What it does not prove

This milestone does not prove:

- who issued the duration claim;
- whether the claimed work occurred;
- who owns the credential;
- credential integrity or expiry;
- any skill, rating, or production-delivery condition;
- request uniqueness or replay prevention.

The duration is currently an isolated private value, not yet part of a signed
`WorkCredential`.

## Privacy and disclosure

### Private

- exact `durationMonths`;
- private state containing the duration;
- the witness output and local private proof transcript;
- every unused Aptor credential field;
- issuer, project, and holder identities.

### Public

- `minimumDurationMonths`, as the exported circuit input;
- the success counter state transition;
- the empty circuit result;
- eventual proof or transaction status when network integration is added.

The exact duration necessarily appears in the generated runtime's
`privateTranscriptOutputs` while proof inputs are assembled locally. It does not
appear in the circuit input, circuit output, public transcript, returned value,
or public ledger. Tests inspect those public surfaces independently and never
log the private transcript or private state.

The counter exists because an assertion-only circuit with no public state effect
is classified by Compact as local/impure and does not generate ZK proving
artifacts. Incrementing a counter is the smallest useful public success signal:
it produces a provable transition without storing either the private duration or
the public minimum.

## Examples

| Private duration | Public minimum | Outcome                                                       |
| ---------------: | -------------: | ------------------------------------------------------------- |
|        12 months |       6 months | Succeeds; `successfulProofs` increments                       |
|         6 months |       6 months | Succeeds at the exact boundary                                |
|         3 months |       6 months | Throws `Private duration does not satisfy the public minimum` |

## Toolchain

### Installed and used

| Component              | Version |
| ---------------------- | ------- |
| Node.js                | 24.15.0 |
| npm                    | 11.12.1 |
| Compact devtools       | 0.5.1   |
| Compact compiler       | 0.31.1  |
| Compact language       | 0.23.0  |
| Compact runtime        | 0.16.0  |
| Compiler ledger target | 8.0.2   |
| TypeScript             | 6.0.3   |

### Official compatibility matrix checked on 2026-07-16

| Component                     | Current tested version |
| ----------------------------- | ---------------------- |
| Compact devtools              | 0.5.1                  |
| Compact toolchain             | 0.31.1                 |
| Compact runtime               | 0.16.0                 |
| Compact JS                    | 2.5.1                  |
| Midnight.js                   | 4.1.1                  |
| testkit-js                    | 4.1.1                  |
| Wallet SDK                    | 1.2.0                  |
| DApp Connector API            | 4.0.1                  |
| Proof server, Preview/Preprod | 8.1.0                  |

Midnight.js, testkit-js, Wallet SDK, DApp Connector, and the proof server are
not dependencies of this contract-only package. They remain intentionally
uninstalled here until deployment and transaction integration begins.

Official references:

- <https://docs.midnight.network/relnotes/support-matrix>
- <https://docs.midnight.network/compact/compilation-and-tooling/compiler-usage>
- <https://docs.midnight.network/compact/test-and-debug>
- <https://docs.midnight.network/guides/compact-javascript-runtime>

## Compile and test

From the repository root:

```bash
npm install --prefix contracts/aptor-credential
npm run contract:compile
npm run contract:typecheck
npm run contract:build
npm run contract:test
```

The compile script pins the compiler patch:

```bash
compact compile +0.31.1 \
  contracts/aptor-credential/src/aptor.compact \
  contracts/aptor-credential/generated/aptor
```

The package-level command uses paths relative to the package:

```bash
npm --prefix contracts/aptor-credential run compact
```

## Generated API

The official compiler emits:

```text
generated/aptor/
├── compiler/contract-info.json
├── contract/index.d.ts
├── contract/index.js
├── contract/index.js.map
├── keys/proveDuration.prover
├── keys/proveDuration.verifier
├── zkir/proveDuration.bzkir
└── zkir/proveDuration.zkir
```

The generated TypeScript API includes:

```ts
type Witnesses<PS> = {
  durationMonths(context: WitnessContext<Ledger, PS>): [PS, bigint];
};

type ProvableCircuits<PS> = {
  proveDuration(
    context: CircuitContext<PS>,
    minimumDurationMonths: bigint,
  ): CircuitResults<PS, []>;
};

type Ledger = {
  readonly successfulProofs: bigint;
};
```

The caller supplies private state such as:

```ts
createDurationPrivateState(12);
```

The witness implementation reads that caller-provided state and returns the
duration to the circuit. A future Midnight.js adapter will construct or locate a
deployed `Contract`, provide the encrypted private state, and invoke:

```ts
contract.callTx.proveDuration(6n);
```

That network call is not implemented in this milestone.

Generated files are ignored because they are reproducible and include proving
artifacts. Run the compile command before building or testing from a clean
checkout.

## Known limitations

- Tests execute the compiler-generated JavaScript representation and proof data
  construction; they do not ask a proof server to generate a cryptographic proof
  or submit it to a Midnight node.
- The public counter reports successful contract calls but is not bound to a
  verifier request.
- There is no issuer authorization, credential commitment, holder binding,
  expiry, nullifier, or replay policy.
- `Uint<16>` permits values up to 65,535. Product-level validation should later
  impose a realistic duration maximum.
- Repeated verifier thresholds can reveal a duration range even though the exact
  value is not disclosed by any one proof.

## Integration into a signed credential

The later credential milestone will replace the isolated witness with a
canonical, issuer-authorized `WorkCredential`. The circuit will first verify the
credential commitment, issuer authorization, holder binding, and expiry, then
apply this same duration comparison to the credential's private
`durationMonths` field.
