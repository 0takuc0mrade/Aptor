# Aptor Preprod deployment runbook

## Status

Executed successfully. The user approved exactly one deployment in 1AM, it
finalized at Preprod block `1717550`, and both Aptor's deployment flow and a
separate post-deployment query read the contract through the v4 indexer. Do not
run the deployment route again for this release.

## Finalized deployment record

| Field                          | Observed value                                                       |
| ------------------------------ | -------------------------------------------------------------------- |
| Contract address               | `86577ec2059e8e0ee13216e6e92d90dda54cae79d75118e1e8ed81beb8becff4`   |
| Aptor finalized transaction ID | `00c56655f4b3a343ac3af7b0182773ff579e1e8790f59b2340c27af27fd480f781` |
| 1AM Explorer transaction hash  | `ada1036389941b4cc87385300f0288c05746cec707648266599e1657cbdc5cf3`   |
| Block height                   | `1717550`                                                            |
| Finalized at                   | `2026-07-18T23:11:19.061Z`                                           |
| Artifact fingerprint           | `63301367e8c09bc4c2bfe25b94e2e12a2197940d309bd0644dd15a75add96749`   |
| Indexer state query            | Passed during deployment and independently afterward                 |

The two transaction values are recorded under the names exposed by their
respective surfaces rather than being treated as interchangeable identifiers.
The user-observed 1AM transaction is available in the
[1AM Explorer](https://explorer.1am.xyz/tx/ada1036389941b4cc87385300f0288c05746cec707648266599e1657cbdc5cf3).

## Pinned release boundary

| Component                                   | Version or path                                                    |
| ------------------------------------------- | ------------------------------------------------------------------ |
| Compact devtools                            | `0.5.1`                                                            |
| Compact compiler / language / runtime       | `0.31.1` / `0.23.0` / `0.16.0`                                     |
| Compact JS / Platform JS / on-chain runtime | `2.5.1` / `2.2.4` / `3.0.0`                                        |
| Midnight.js / testkit-js                    | `4.1.1` / `4.1.1`                                                  |
| Wallet SDK                                  | `1.2.0` (the testkit also has a nested test-only `1.1.0`)          |
| Connector API / ledger                      | `4.0.1` / `8.1.0`                                                  |
| Official Preprod node / indexer             | `1.0.0` / `4.3.3`                                                  |
| Official compatible proof server            | `8.1.0`                                                            |
| Generated artifact fingerprint              | `63301367e8c09bc4c2bfe25b94e2e12a2197940d309bd0644dd15a75add96749` |
| RPC                                         | `https://rpc.preprod.midnight.network`                             |
| Indexer                                     | `https://indexer.preprod.midnight.network/api/v4/graphql`          |

The public app uses the proving provider returned by 1AM's
`getProvingProvider` Connector API v4 method. It does not need a public or
user-local proof-server URL. The LocalNet proof-server and indexer images remain
separate regression infrastructure; they were not upgraded merely to prepare
this browser release.

This boundary was checked against Midnight's official
[compatibility matrix](https://docs.midnight.network/relnotes/support-matrix)
and [Preprod endpoint list](https://docs.midnight.network/relnotes/network),
both last updated 2026-07-17. The public app uses the official managed Preprod
node and indexer; the proof-service version behind 1AM's connector is
wallet-managed and must pass the connector preflight rather than being assumed.

## Prepare the local deployment build

1. Run `npm run dev:preprod` from the repository root. Its lifecycle pre-step
   builds the contract and browser packages, stages the ZK artifacts, and reads
   the emitted fingerprint directly from the staged manifest. The launcher then
   creates an optimized production-mode Next.js build and serves it only on
   `127.0.0.1`; it does not rely on filesystem watchers.
2. Open `/release/preprod`. The launch script pins the official Preprod
   endpoints, leaves the contract address empty, and enables the otherwise
   hidden deployment route only for this local process.
3. Do not use the ordinary `npm run dev` command for deployment. It intentionally
   defaults to the undeployed LocalNet configuration.

`.env.preprod.example` remains the reference for the eventual hosted runtime;
the one-time local deployment does not depend on an untracked environment file.

## Preflight and deploy once

1. Confirm RPC, indexer, delivery storage, ZK manifest, and fingerprint checks.
2. Connect 1AM. Aptor rejects a non-1AM connector for this release action.
3. Confirm 1AM and its service configuration both report `preprod`.
4. Confirm 1AM reports positive spendable DUST.
5. Let Aptor request 1AM's real proving provider for the pinned key material.
6. Type the exact phrase `Deploy Aptor to Midnight Preprod.`
7. Click **Deploy once to Preprod** and approve the transaction in 1AM.
8. Wait. Aptor uses a finite ten-minute finalization timeout and does not submit
   a second transaction automatically.
9. Accept success only after `queryContractState` reads the deployed contract
   through the Preprod indexer.
10. Copy the evidence JSON before closing the route.

Never enter a seed phrase, wallet private key, vault password, holder secret,
issuer signing key, or credential plaintext into this route.

## Configure the hosted release

1. Configure Railway with the observed finalized contract address above and the
   exact variables in `docs/PRODUCTION_HOSTING.md`.
2. Keep `NEXT_PUBLIC_APTOR_ENABLE_PREPROD_DEPLOYMENT=false` on the public host.
3. Generate a Railway domain and set `APTOR_PUBLIC_URL` to
   `https://${{RAILWAY_PUBLIC_DOMAIN}}`.
4. Attach a Railway volume at `/data`, set
   `APTOR_DELIVERY_DB_PATH=/data/aptor.sqlite`, and deploy from `railway.json`.
5. Require `/api/health` to return HTTP 200.
6. Call `/api/release/preflight` without deployment mode. The configured
   contract check must pass.
7. Run the public smoke test and the single real request/proof scenario.

## Failure record

On any real Preprod failure, stop transaction retries and record the stage,
safe error text, endpoint, connector version, proving-provider state,
transaction ID if one exists, and whether DUST appears to have been consumed.
Do not include wallet addresses unless needed as public evidence, and never
include secrets.
