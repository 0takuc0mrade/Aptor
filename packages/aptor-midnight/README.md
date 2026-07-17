# Aptor Midnight local integration

This package deploys and calls Aptor's authenticated private-duration Compact
contract through the official Midnight.js provider stack.

It contains:

- the generated-contract wrapper and authenticated credential API;
- a contract-address-scoped Level private-state provider;
- a Node ZK configuration provider;
- the official HTTP proof provider;
- the indexer public-data provider;
- a local genesis-funded development wallet provider;
- pinned Docker Compose services for the node, indexer, and proof server;
- one serial provider-backed test covering signed success, exact boundary,
  tampering, wrong-holder, wrong-issuer, threshold, finalized-state, and
  public-data privacy behavior.

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

Private state contains the signed credential, issuer signature, and holder
secret. The witness reads that bundle without logging it. Provider metrics
count proof requests and wallet submissions, but never retain witness values or
private transaction payloads. Public inspection is limited to provider-returned
transactions, contract state, decoded ledger data, API return values, and
deliberately public test logs.

Local Level databases are written below `.midnight/private-state/`, removed
after a completed test run, and ignored by Git.
