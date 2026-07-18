# Aptor Midnight local integration

This package deploys and calls Aptor's request-bound capability contract
through the official Midnight.js provider stack.

It contains:

- request registration and private fulfillment APIs;
- a contract-address-scoped Level private-state provider;
- a Node ZK configuration provider;
- the official HTTP proof provider;
- the indexer public-data provider;
- a local genesis-funded development wallet provider;
- pinned Docker Compose services for the node, indexer, and proof server;
- one serial provider-backed test covering request creation, valid fulfillment,
  replay, request tampering, missing skill, untrusted issuer, finalized state,
  and public-data privacy.

## Commands

From the repository root:

```bash
npm run contract:compile
npm run contract:build
npm run midnight:network:up
npm run midnight:network:health
npm run midnight:test:network
npm run midnight:network:down
```

For a single lifecycle command:

```bash
npm run midnight:test:local
```

The network test expects generated Compact assets under
`contracts/aptor-credential/generated/aptor`. It does not mock proof generation
and fails if the proof server, node, or indexer is unavailable.

## Privacy

Private state contains the signed credential, private issuer key/path,
holder secret, skill inventory, and selected skill path. The witness reads that
bundle without logging it. Provider metrics count proof requests and wallet
submissions but do not retain witness values or private transaction payloads.
Public inspection covers provider-returned request/proof transactions, contract
state, decoded ledger data, API results, and deliberately public test logs.

Local Level databases are written below `.midnight/private-state/`, removed
after a completed test run, and ignored by Git.

## Browser test adapter

Milestone 5 keeps this Node package out of the production browser bundle. The
Playwright LocalNet suite uses the official `DAppConnectorWalletAdapter` with
`LocalWalletProvider`, then exposes only the connector methods a browser wallet
would provide. The browser still assembles its own indexer, ZK, proof, wallet,
transaction, and ephemeral private-state providers and executes real contract
calls. No proof or ledger state is mocked.

From the repository root:

```bash
npm run midnight:network:up
npm run browser:e2e:prepare
npm run test:e2e:local --workspace @aptor/web
npm run midnight:network:down
```

The test deployment metadata and results live under ignored `.midnight/`
paths. See `docs/PRODUCT_MILESTONE_5.md` for the recorded contract and
transaction evidence.
