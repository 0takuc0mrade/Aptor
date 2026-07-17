# Contract milestone 2 — real local proof and execution

## Status

Milestone 2 passed on 2026-07-16.

Aptor deployed the duration contract through the official Midnight.js provider
stack, generated real zero-knowledge proofs through a running proof server,
submitted local transactions, waited for finalization, and queried the
resulting public ledger state.

No Preview or Preprod deployment was attempted. The complete required local
flow passed, so remote funding and synchronization were not needed.

## Environment

| Component                    | Version                             |
| ---------------------------- | ----------------------------------- |
| OS architecture              | Linux `x86_64`                      |
| Node.js                      | `24.15.0`                           |
| npm                          | `11.12.1`                           |
| Docker                       | `29.1.3`                            |
| Docker Compose               | `2.40.3`                            |
| Compact devtools             | `0.5.1`                             |
| Compact compiler             | `0.31.1`                            |
| Compact language             | `0.23.0`                            |
| Compact runtime              | `0.16.0`                            |
| Compact JS                   | `2.5.1`                             |
| Midnight.js packages         | `4.1.1`                             |
| testkit-js                   | `4.1.1`                             |
| Wallet SDK direct dependency | `1.2.0`                             |
| DApp Connector API           | `4.0.1`, transitive through testkit |
| Ledger target                | `8.0.2`                             |

`testkit-js@4.1.1` also installs its own
`@midnight-ntwrk/wallet-sdk@1.1.0`. Aptor pins the compatibility-matrix Wallet
SDK `1.2.0` as its direct integration dependency.

## Pinned local images

| Service      | Image                                    |
| ------------ | ---------------------------------------- |
| Proof server | `midnightntwrk/proof-server:8.0.3`       |
| Indexer      | `midnightntwrk/indexer-standalone:4.0.2` |
| Node         | `midnightntwrk/midnight-node:0.22.5`     |

The proof-server compatibility matrix lists `8.1.0` for Preview and Preprod.
The current official `midnight-local-dev` standalone Compose file pins `8.0.3`
for the local development network, so Aptor uses `8.0.3` locally rather than
mixing the remote-network image guidance into the standalone stack.

## Provider architecture

The `@aptor/midnight` package configures:

1. `levelPrivateStateProvider` for encrypted, contract-address-scoped private
   state;
2. `indexerPublicDataProvider` for deployments, finalized transactions, and
   public contract state;
3. `NodeZkConfigProvider` for the generated Aptor prover key, verifier key, and
   ZKIR;
4. `httpClientProofProvider` for real `/check` and `/prove` requests;
5. `LocalWalletProvider` for balancing, signing, and submitting transactions;
6. the same local wallet provider as `midnightProvider`.

The wallet uses only the official genesis-funded seed for the `undeployed`
local network. The seed is not logged or persisted by Aptor.

The provider-backed test wraps `ProofProvider.proveTx` and
`MidnightProvider.submitTx` with counters. These counters establish whether a
call reached proof generation and transaction submission without retaining
private inputs.

## Contract deployment and calls

### Passing fixture

Private fixture: `durationMonths = 12`  
Public argument: `minimumDurationMonths = 6`

| Result                       | Value                                                                |
| ---------------------------- | -------------------------------------------------------------------- |
| Contract address             | `b610a2c0ad61079e131b5a7b223b4675daec53651a79262e61859d69f81fc24a`   |
| Deployment action identifier | `006d6e100f788936b909ac026a4ca8933ef55cd17f33e88e91c56f7fcee030af15` |
| Deployment transaction hash  | `5e366c59ce41458b538356c6ffbc0460623c3fd6212f49a02c4f6cf3f9fb39cc`   |
| Deployment block             | `24`                                                                 |
| Call transaction identifier  | `004f7d2128556ba6d877ee2d561c833be3ae4613134a3089107d479fdedbb65523` |
| Call transaction hash        | `3c3d6a28e08cec41c7370c49bf49efe53fea99ed9fe0787994654fc8847ab3d7`   |
| Call block                   | `28`                                                                 |
| Finalized status             | `SucceedEntirely`                                                    |
| `successfulProofs` before    | `0`                                                                  |
| `successfulProofs` after     | `1`                                                                  |

The proof-provider invocation count increased by one for the call, and the
wallet submission count increased by one.

### Exact-boundary fixture

Private fixture: `durationMonths = 6`  
Public argument: `minimumDurationMonths = 6`

| Result                            | Value                                                                |
| --------------------------------- | -------------------------------------------------------------------- |
| Contract address                  | `af74b615d84d90b40da25f5cfe822b9d030d7aa927bdb6aaad121af29be1cd0d`   |
| Deployment transaction identifier | `00c08ed94a46b6784b6f9485a2f2c04eeedc08dd5e721cb691028d27ae8b1ec94b` |
| Deployment block                  | `31`                                                                 |
| Call transaction identifier       | `007c701ef3e373bf326f499ff52ef2a789703139a8a53e84d532898a007073b346` |
| Call transaction hash             | `4b22b794e2c85431c894b8dd6fe25b716776d6bdf9e73c94bf2abb70e2c1bb74`   |
| Call block                        | `34`                                                                 |
| Finalized status                  | `SucceedEntirely`                                                    |
| `successfulProofs` before         | `0`                                                                  |
| `successfulProofs` after          | `1`                                                                  |

The exact boundary generated a real proof, submitted a transaction, and
incremented the counter.

### Failing fixture

Private fixture: `durationMonths = 3`  
Public argument: `minimumDurationMonths = 6`

| Result                                            | Value                                                                |
| ------------------------------------------------- | -------------------------------------------------------------------- |
| Contract address                                  | `ed7d5c86ab481a2a3c3facb800c23495e79c4ffc487456181add180cf1013e4b`   |
| Deployment transaction identifier                 | `00ffc5ceb655a9b1b8cedd3b1a052e7a050cb3734e85ebd4cf05b17b24d6df161a` |
| Deployment block                                  | `37`                                                                 |
| Proof-provider calls after attempted circuit call | unchanged                                                            |
| Wallet submissions after attempted circuit call   | unchanged                                                            |
| `successfulProofs` before                         | `0`                                                                  |
| `successfulProofs` after                          | `0`                                                                  |

The generated Compact runtime rejected the assertion locally. No proof request
for the failing call was made and no call transaction was submitted.

## Proof-server evidence

The proof server reached healthy state on `127.0.0.1:6300`. Its logs recorded
real HTTP work during the test, including:

- `POST /check`;
- `POST /prove`;
- successful `/prove` response processing for both Aptor call fixtures.

The proof server also generated proofs needed by local wallet and deployment
transactions. Aptor does not infer the Aptor call count from raw server traffic;
the automated assertion uses the wrapped official `proveTx` boundary.

## Public-data and privacy inspection

The test inspected:

- the finalized deployment data;
- the finalized call transaction data returned by the public-data provider;
- decoded public ledger state;
- the empty Compact return value;
- application-owned structured output.

For the passing fixture, a recursive semantic inspection found:

```text
decoded public occurrences of the exact private value: 0
```

No public field named `durationMonths` was present. The only decoded Aptor
ledger field was `successfulProofs`. Normal application output included
contract addresses, transaction identifiers, transaction status, and counters
only.

This inspection does not claim to prove absence from every possible
network-level side channel or from arbitrary byte coincidences inside hashes
and proof material. It verifies the decoded public artifacts available through
the installed provider APIs and Aptor logs.

## Reproduction

Install dependencies and regenerate the contract:

```bash
npm install
npm run contract:compile
npm run contract:build
npm run contract:typecheck
npm run contract:test
```

Start and validate the pinned local stack:

```bash
npm run midnight:network:up
npm run midnight:network:health
```

Run the real network test:

```bash
npm run midnight:test:network
```

Stop the local stack:

```bash
npm run midnight:network:down
```

The combined lifecycle command is:

```bash
npm run midnight:test:local
```

## Validation results

| Command                                    | Result                                                                                   |
| ------------------------------------------ | ---------------------------------------------------------------------------------------- |
| `npm install`                              | Passed after one transient registry `ECONNRESET` retry                                   |
| `npm run contract:compile`                 | Passed; one provable circuit compiled                                                    |
| `npm run contract:build`                   | Passed                                                                                   |
| `npm run contract:typecheck`               | Passed                                                                                   |
| `npm run contract:test`                    | Passed; 4 tests                                                                          |
| `npm run typecheck`                        | Passed for all workspaces                                                                |
| `npm run midnight:build`                   | Passed                                                                                   |
| `npm run format:check -- --ignore-unknown` | Passed                                                                                   |
| `npm run midnight:network:up`              | Passed after removing three stopped, two-month-old conflicting local Midnight containers |
| `npm run midnight:network:health`          | Passed; node, indexer, and proof server healthy                                          |
| `npm run midnight:test:network`            | Passed; 1 serial provider-backed test in `98.86s`                                        |
| `npm run lint`                             | Passed; existing frontend ESLint clean                                                   |
| `npm run build`                            | Passed; Next.js production build generated every role route                              |
| `npm run midnight:network:down`            | Passed; containers and Compose network removed                                           |
| `npm audit --json`                         | Reported 2 moderate advisories through Next.js → PostCSS; no high or critical advisories |

## Local versus remote status

- Local standalone network: complete.
- Real local proof generation: complete.
- Real local deployment and finalized calls: complete.
- Preview: not attempted.
- Preprod: not attempted.
- Frontend wallet connection: intentionally not implemented in this milestone.

## Known limitations

1. The witness value is still caller-supplied private state, not an
   issuer-authenticated credential.
2. The local genesis-funded wallet is for development only.
3. The first proof-server start downloads and verifies additional official
   proving material.
4. The Level private-state password in the automated local fixture is a
   test-only value; production secret handling is not implemented.
5. The privacy inspection covers decoded public provider artifacts, not all
   possible metadata or timing side channels.
6. No public Preview or Preprod explorer link exists because no remote
   deployment was attempted.
7. npm reports two moderate advisories caused by Next.js resolving a PostCSS
   version below `8.5.10`. The automatic fix proposes downgrading Next.js to
   `9.3.3`, which is not an acceptable or verified fix for this project.

## Next milestone

Replace the caller-supplied duration with a canonical issuer-signed Aptor
credential, bind that credential to its intended holder, and prove the duration
threshold from authenticated private credential data.
