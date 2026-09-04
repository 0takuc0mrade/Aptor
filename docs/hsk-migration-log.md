# Aptor HSK migration build log

## Safety and scope

The existing Midnight implementation remains intact. The HSK work is isolated
from Aptor's issuer, professional, and verifier product flows. Private
credential values must remain offchain; HSK receives only public inputs,
cryptographic proofs, commitments, status, and verification receipts.

> **Current status:** The later mainnet evidence gate described in the phased
> notes below passed on 2026-08-27. See
> [HSK mainnet deployment evidence](HSK_MAINNET_EVIDENCE.md) for public
> transactions and a reproducible live check.

## Phase 0 — viability preflight

- Foundry (`forge`, `cast`) and Circom are installed.
- The official HSK mainnet RPC returned chain ID `177` on 2026-08-27.
- No HSK deployer credential was found in repository-local environment files.
- Existing baseline: 22/22 Compact contract tests and 2/2 delivery test files pass.

## Phase 1 — Groth16 Solidity canary

### Objective

Prove a private `experienceMonths` value is greater than or equal to a public
`minimumMonths`, generate the proof locally, and verify it with a Solidity
verifier suitable for HSK. Per build direction, live deployment is testnet-first
(chain ID `133`); mainnet remains a later evidence gate.

### Design

- Circuit: `packages/zk-hsk/circuits/ExperienceThreshold.circom`
- Integer width: 16 bits for both values, preventing field wraparound.
- Private input: `experienceMonths`.
- Public input: `minimumMonths`.
- Constraint: `experienceMonths >= minimumMonths`.
- Dependencies: Circom `2.2.3` (installed tool), `circomlib@2.0.5`, and
  `snarkjs@0.7.5`.
- Trusted setup: a repository-local development Powers of Tau ceremony and a
  circuit-specific Groth16 contribution. This is reproducible canary tooling,
  not a production multi-party ceremony.

### Baseline commands

```bash
npm run delivery:test
npm run contract:test
```

Both passed before Phase 1 changes. Further commands and observed results are
recorded below as they run.

### Build note

The first setup run compiled the 55-constraint circuit and completed the
Powers of Tau and Groth16 contributions, but verifier export failed because the
isolated `contracts/hsk/src` output directory did not yet exist. The build
script now creates that directory before export; no cryptographic check was
bypassed.

The first proof-script run exposed that `snarkjs@0.7.5` has named ESM exports
and no default export. The script now imports the module namespace.

The proof generator initially remained alive after writing its files because
snarkjs worker resources were retained under Node 24. Explicit successful exit
was added after all writes complete; the subsequent CLI verification returned
`OK!`.

The first `cast calldata` preflight rejected JSON arrays whose field elements
were quoted strings. Proof generation now emits Foundry-compatible numeric
array arguments in `solidity-args.txt`; `cast calldata` successfully encoded
the four generated arguments into a 586-byte call plus newline.

### Commands and results

```bash
npm install
npm run hsk:zk:build
npm test --workspace @aptor/zk-hsk
forge test --root contracts/hsk -vv
cast chain-id --rpc-url https://testnet.hsk.xyz
cast block-number --rpc-url https://testnet.hsk.xyz
```

- Circuit: 49 nonlinear + 6 linear constraints, one public input, one private
  input, 54 wires.
- Valid input `{ experienceMonths: 36, minimumMonths: 24 }` generated a real
  Groth16 proof; snarkjs verification returned `OK!`.
- Invalid input `{ experienceMonths: 12, minimumMonths: 24 }` is rejected while
  calculating the witness because the threshold constraint is unsatisfied.
- Foundry: 5 passed, 0 failed. Cases cover valid verification, changed public
  input, changed proof, unrelated zero proof/input, and malformed calldata.
- HSK testnet RPC returned chain ID `133` and latest block `32317712` on
  2026-08-27.

### Generated artifacts

The pinned canary proving key, verification key, and WASM witness calculator
are kept together under `packages/zk-hsk/build/`. Intermediate R1CS, symbol,
Powers of Tau, and per-run proofs are ignored. The snarkjs-generated Solidity
verifier is `contracts/hsk/src/ExperienceThresholdVerifier.sol`.

### Testnet deployment gate

No deployer credential is configured, so no deployment or verification
transaction is claimed. Once a funded testnet wallet is supplied through the
environment:

```bash
export HSK_TESTNET_RPC_URL=https://testnet.hsk.xyz
export HSK_DEPLOYER_PRIVATE_KEY=<secret>
bash contracts/hsk/scripts/deploy-testnet.sh

export HSK_VERIFIER_ADDRESS=<deployed-address>
npm run proof --workspace @aptor/zk-hsk
bash contracts/hsk/scripts/verify-proof-testnet.sh
```

The deployment script refuses any chain other than `133`. Neither script logs
or stores the private key. The resulting contract address, deployment
transaction, proof-verification transaction, gas, and explorer URLs must be
added here only after they are observed.

## Phase 2 — Aptor credential proof and HSK contracts

### Existing schema and EVM encoding

Phase 2 preserves Aptor's implemented meanings: skills use NFKC normalization,
trim, lowercase, and whitespace collapse; experience remains an unsigned
16-bit count of months; production remains boolean; and rating remains an
integer in hundredths from `0` to `500`. Client and project context stay
outside the HSK circuit.

Midnight's `persistentHash` is not directly consumable by a BN254 Groth16
circuit. HSK skills therefore use this deterministic field encoding:

```text
normalized = NFKC(skill).trim().lowercase().collapseWhitespace()
digest = SHA-256("aptor:skill:hsk:v1\\0" || UTF8(normalized))
skillHash = bigEndian(digest) mod BN254_scalar_field
```

This preserves existing normalization semantics while adapting the digest to a
circuit field element. SHA-256 is performed outside the circuit; the resulting
field is committed inside the circuit with Poseidon. The encoder maps
`Solidity` to
`10889981254292748585425736428916895513607263255116764925564928327257381078764`.

### Circuit architecture

The five private inputs are `skillHash`, `experienceMonths`,
`productionExperience`, `ratingHundredths`, and `credentialSecret`.

The seven public signals have a fixed Solidity order:

1. `credentialCommitment` (output)
2. `requestNullifier` (output)
3. `requiredSkillHash`
4. `minimumMonths`
5. `requiresProduction` (`0` or `1`)
6. `minimumRatingHundredths`
7. `requestId`

The credential commitment is:

```text
Poseidon(skillHash, experienceMonths, productionExperience,
         ratingHundredths, credentialSecret)
```

Poseidon is efficient to constrain in a SNARK. Registering this output lets an
issuer approve exact hidden values without placing those values on HSK. A
proof alone shows internally consistent values; the registry adds the fact
that an approved issuer registered that commitment and has not revoked it.

The request nullifier is `Poseidon(credentialSecret, requestId)`. A nullifier
is a public identifier derived from private material. It binds the same secret
to one request without revealing the secret. Different requests produce
different nullifiers. The contract consumes each nullifier and closes the
fulfilled request to prevent replay.

Constraints enforce skill equality; unsigned 16-bit month ranges and the
minimum; boolean production flags and the conditional requirement; rating
ranges bounded to `0..500`; and the rating minimum. The compiled circuit has
667 nonlinear and 805 linear constraints, five public inputs, five private
inputs, two public outputs, and 1,467 wires.

### Real proof evidence

The test-only credential is Solidity, 36 months, production true, rating `470`.
Request `1001` asks for Solidity, 24 months, production true, and rating `400`.

```bash
npm run hsk:aptor:build
npm run hsk:aptor:proof
npm run fixtures:foundry --workspace @aptor/zk-hsk
npm run hsk:aptor:test
```

snarkjs returned `OK!`. The public commitment is
`1455048634371947279365260250185395754522518219554902773599709421245741446846`.
Request `1001` produced nullifier
`7015496002842872287927760091798428128564606889003925377312979190690757183842`.
Request `1002` used the same credential and produced the distinct nullifier
`12837836879954455529257924703279341017607449021298887233141099012776670779672`.

Invalid experience, skill, rating, and production witnesses fail during
witness generation. Changed public request fields, commitment, or request ID
use a previously valid proof and fail in Solidity.

The first hand-copied fixture contained two transcribed digits and caused the
success tests to return `InvalidProof`. Fixtures are now generated mechanically
from snarkjs output by `export-foundry-fixtures.mjs`; the next run passed.

### Solidity architecture and tests

- `AptorCredentialGroth16Verifier` is generated by snarkjs and performs BN254
  pairing verification.
- `AptorCredentialRegistry` provides an explicit admin, issuer approval,
  issuer-owned commitment registration/revocation, duplicate protection, and
  current-validity queries.
- `AptorProofRequests` stores public requirements, reconstructs the exact
  seven public signals, verifies current credential status and the real proof,
  consumes the nullifier, closes the request, and emits `RequestFulfilled`.

Foundry result: 15 Phase 2 tests passed, 0 failed. They cover issuer approval,
unauthorized registration, revocation authorization, revoked credentials,
valid fulfillment, all four predicate mismatches, changed commitment, changed
request ID, malformed proof, replay, and a second request/nullifier. The five
Phase 1 verifier tests also remain green.

### Public/privacy audit

| Field                   | Visibility                                 |
| ----------------------- | ------------------------------------------ |
| Credential skill field  | Private witness; requested skill is public |
| Exact experience months | Private                                    |
| Exact production value  | Private                                    |
| Exact rating            | Private                                    |
| Client and project      | Private and outside circuit                |
| Credential secret       | Private                                    |
| Credential commitment   | Public opaque Poseidon field               |
| Required skill hash     | Public request requirement                 |
| Minimum months          | Public request requirement                 |
| Production requirement  | Public request requirement                 |
| Minimum rating          | Public request requirement                 |
| Request ID              | Public                                     |
| Verifier address        | Public                                     |
| Request nullifier       | Public replay-protection value             |
| Issuer address          | Public registry provenance                 |

A successful proof necessarily establishes that the credential has the
requested public skill. It does not reveal additional skills, exact private
values, client, project, or secret.

### HSK deployment readiness

`DeployAptor.s.sol` deploys the generated verifier, registry, and request
contract. `APTOR_ADMIN_ADDRESS` is separate from the deployer, so an organizer
does not accidentally become the permanent administrator. Both shell and
Solidity enforce the expected chain.

Testnet:

```bash
export HSK_RPC_URL=https://testnet.hsk.xyz
export HSK_EXPECTED_CHAIN_ID=133
export HSK_DEPLOYER_PRIVATE_KEY=<secret>
export APTOR_ADMIN_ADDRESS=<admin>
bash contracts/hsk/scripts/deploy-network.sh
```

Mainnet uses the same path with `HSK_RPC_URL=https://mainnet.hsk.xyz` and
`HSK_EXPECTED_CHAIN_ID=177`. `demo-lifecycle.sh` approves the issuer, registers
the commitment, creates request `1001`, submits the generated proof, and queries
the receipt. No deployment or transaction is claimed yet.

### Hosting direction

Render free cannot attach the persistent disk assumed by Railway's `/data`
configuration. The selected free-tier target is a Render Next.js web service
plus Neon Postgres. That requires a Postgres delivery adapter; SQLite remains
the local-test adapter. Neon stores ciphertext and routing metadata, never
credential plaintext or ZK witnesses. HSK verification is independent of the
hosting database.

### Phase 2 regression result

- Real Aptor proof: snarkjs `OK!`.
- Invalid experience, skill, rating, and production fixtures were rejected.
- HSK Foundry suites: 20 passed, 0 failed (15 Phase 2 + 5 canary).
- Runtime sizes: verifier 1,909 bytes, registry 1,325 bytes, request contract
  2,328 bytes; all are well below EVM limits.
- Existing Midnight simulator: 22 passed, 0 failed.
- Delivery API/service: 2 test files passed, 0 failed.
- Workspace typecheck, web lint, Next.js production build, and security scan
  passed.
- `npm audit --omit=dev` reports six high-severity production dependency
  advisories in the existing Next.js/transitive stack. The HSK Circom/snarkjs
  packages are development-only. Upgrading Next.js and its coupled packages is
  a separate release-hardening task because npm requires an out-of-range
  upgrade; no forced audit rewrite was applied during the contract migration.
- Repository-wide Prettier still reports the pre-existing untracked `Cordon/`
  tree. Phase 2 files were formatted separately; no `Cordon/` file was changed.

Phase 2 does not claim HSK deployment. Remaining external evidence gates are
funded broadcasts and explorer receipts. Render + Neon is a separate hosting
phase because the current service is synchronous SQLite; Railway configuration
remains unchanged.

## Phase 3 — Product integration and Anvil validation

The existing Issuer → Professional → Verifier workflow now has an environment-
selected HSK mode. Midnight remains the default and its code path is preserved.
HSK mode adds injected EVM wallet connection with strict chain-ID checks,
client-side skill encoding and Poseidon commitment generation, encrypted
credential/request delivery, real browser Groth16 proof generation, HSK
submission, and an authoritative post-finality contract read.

Browser variables:

```bash
NEXT_PUBLIC_APTOR_CHAIN_MODE=hsk
NEXT_PUBLIC_HSK_CHAIN_ID=31337
NEXT_PUBLIC_HSK_RPC_URL=http://127.0.0.1:8545
NEXT_PUBLIC_HSK_CREDENTIAL_REGISTRY_ADDRESS=0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
NEXT_PUBLIC_HSK_PROOF_REQUESTS_ADDRESS=0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0
```

The issuer credential secret is created in the browser. It is included only in
the encrypted credential envelope and encrypted account vault; issuer history
deliberately omits it. The delivery API continues to receive ciphertext. The
Verifier receives public criteria and a fulfillment receipt, never the source
credential or witness.

### Anvil evidence

Contracts were deployed to a fresh Anvil chain `31337`, then
`npm run hsk:anvil:validate` performed issuer approval, commitment
registration, four-predicate request registration, fresh Groth16 proof
generation, fulfillment submission, and final state reads.

- Registry: `0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512`
- Requests: `0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0`
- Credential transaction:
  `0x00843fbd33ecbe18aab6ea64fc5e3f5f37e2f83c0710956fe466d5eaee16253b`
- Request transaction:
  `0xd62968a43e02a1192cc6e00b55e445931f442236a800f66104e6cb70d776dc01`
- Fulfillment transaction:
  `0xc5a88e339bbbe2befd3782662edcddfa692b1b71f8c0dfc11703f3786a586252`
- Final block: `6`
- Public signals: `7`; credential valid: `true`; request fulfilled: `true`

These are local-chain rehearsal receipts, not HSK testnet claims. The next
external gate is organizer-assisted deployment and issuer approval on HSK
testnet chain `133`; mainnet remains deferred.

The dedicated browser rehearsal (`npm run hsk:anvil:e2e`) also passed with
three isolated Aptor profiles and injected Anvil accounts. The UI registered
request transaction
`0x17fa5d500d31ec9c1e891b04ab44e528f7aa43309602b2438405e9d3b992403f`
and finalized fulfillment transaction
`0x93bb30da9761bdc8fce7fb2d666feee66c3e4a21d8d9ca787a2798ffdc79aec6`.
The delivery database contained exactly two encrypted envelopes, the tracking
row ended `fulfilled`, and outgoing delivery bodies contained neither
`credentialSecret`, exact duration fields, nor the private skill label.

### HSK testnet deployment evidence

On 2026-08-27, the deployment gate passed against HSK testnet chain `133`.
All four supplied role accounts held `0.1 HSK` before deployment. The deployer
key resolved to `0x4d313DA68C5870dEf4c6e2989CBd178Be630163A`; that address was explicitly
configured as the registry's immutable administrator.

All three deployments finalized in block `32322230`:

| Contract            | Address                                                                                                                             | Deployment transaction                                                                                                       |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Groth16 verifier    | [`0xb4aFc36F8f8b99Da2175548cB2780476a544029b`](https://testnet-explorer.hsk.xyz/address/0xb4aFc36F8f8b99Da2175548cB2780476a544029b) | [`0xd28ea62c…a0d3e`](https://testnet-explorer.hsk.xyz/tx/0xd28ea62cd35b86f45f1a695f784a6e9e61a8d6b5531bba31bd60b958823a0d3e) |
| Credential registry | [`0x0E4100F542106e0b60c918E01cE7f75dF0bb79e6`](https://testnet-explorer.hsk.xyz/address/0x0E4100F542106e0b60c918E01cE7f75dF0bb79e6) | [`0x1e9a6e2b…7f57d`](https://testnet-explorer.hsk.xyz/tx/0x1e9a6e2b822e886d274cc0e8f92d887d2c1de0d640375be7943cbce03bf7f57d) |
| Proof requests      | [`0x296F105eFA96eD3e672983bda9a2627Ba39a44C0`](https://testnet-explorer.hsk.xyz/address/0x296F105eFA96eD3e672983bda9a2627Ba39a44C0) | [`0x4a39c719…449b1`](https://testnet-explorer.hsk.xyz/tx/0x4a39c7194ac4a3870e80488300f69945dbcc93a67379d14ea73a9006f83449b1) |

Post-deployment RPC reads confirmed runtime bytecode sizes of 1,909, 1,325,
and 2,328 bytes respectively. The request contract's immutable verifier and
registry references match the deployed addresses, and the registry owner
matches the configured administrator.

Issuer `0x8Ff4cb9873Ed223ad6D6dd8f367AEC014f0B2647` was approved successfully in
block `32322260`, transaction
[`0x6e54feec…638cd`](https://testnet-explorer.hsk.xyz/tx/0x6e54feec07928baba7733c991fa4f8caa717a6bbffe8ef845cdd6016d90638cd).
An authoritative `approvedIssuers` read returned `true`. A production build
with these exact public testnet addresses also passed. No private key or local
deployment cache is tracked.

## Phase 4 — HSK mainnet deployment evidence

On 2026-08-27, Aptor's Groth16 verifier, credential registry, and proof-request
contracts were deployed successfully to HashKey Chain mainnet, chain `177`.
All three creation transactions finalized in block `26744614` at
`2026-08-27T13:12:43Z`.

| Contract            | Address                                                                                                                       | Deployment transaction                                                                                                   |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Groth16 verifier    | [`0xb4aFc36F8f8b99Da2175548cB2780476a544029b`](https://hsk.blockscout.com/address/0xb4aFc36F8f8b99Da2175548cB2780476a544029b) | [`0x4743f936…f6399e`](https://hsk.blockscout.com/tx/0x4743f936c2d89e613b8ff6100ff85a50c0a9cc2a380b928b66bc708c0bf6399e)  |
| Credential registry | [`0x0E4100F542106e0b60c918E01cE7f75dF0bb79e6`](https://hsk.blockscout.com/address/0x0E4100F542106e0b60c918E01cE7f75dF0bb79e6) | [`0xf945fb24…2481889`](https://hsk.blockscout.com/tx/0xf945fb241f16beb1ab126772e5eeb74a417093379f80f4e4219eb744b2481889) |
| Proof requests      | [`0x296F105eFA96eD3e672983bda9a2627Ba39a44C0`](https://hsk.blockscout.com/address/0x296F105eFA96eD3e672983bda9a2627Ba39a44C0) | [`0x58c0c0f6…31133c3`](https://hsk.blockscout.com/tx/0x58c0c0f666f9720137c8f74381c45593f728873e70a740915f3758f2831133c3) |

The live verifier (`npm run hsk:mainnet:verify`) confirms chain ID `177`,
successful receipts, non-empty runtime bytecode, the deployment block and
timestamp, the registry owner, and both request-contract dependencies. A
separate local comparison found exact byte-for-byte matches between the public
creation transaction inputs and the Foundry artifacts built from this
repository. Full details and scope are recorded in
[`HSK_MAINNET_EVIDENCE.md`](HSK_MAINNET_EVIDENCE.md).
