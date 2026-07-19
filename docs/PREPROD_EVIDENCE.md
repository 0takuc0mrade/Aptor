# Aptor Preprod evidence

## Evidence status

**Contract deployment complete; public hosting and the real request/proof
scenario remain pending.** The single 1AM-approved deployment finalized and the
v4 Preprod indexer returned the deployed contract state. Remaining blank fields
are deliberately not presented as completed evidence.

## Public release record

| Evidence                                  | Observed value                                                                                                        |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Live HTTPS URL                            | Pending Railway deployment                                                                                            |
| Contract address                          | `86577ec2059e8e0ee13216e6e92d90dda54cae79d75118e1e8ed81beb8becff4`                                                    |
| Aptor finalized deployment transaction ID | `00c56655f4b3a343ac3af7b0182773ff579e1e8790f59b2340c27af27fd480f781`                                                  |
| 1AM Explorer deployment hash              | `ada1036389941b4cc87385300f0288c05746cec707648266599e1657cbdc5cf3`                                                    |
| Deployment block height                   | `1717550`                                                                                                             |
| Deployment timestamp                      | `2026-07-18T23:11:19.061Z`                                                                                            |
| Request ID                                | Pending real scenario                                                                                                 |
| Request commitment                        | Pending real scenario                                                                                                 |
| Registration transaction / height         | Pending real scenario                                                                                                 |
| Fulfillment transaction / height          | Pending real scenario                                                                                                 |
| Final contract receipt                    | Pending real scenario                                                                                                 |
| Midnight Explorer links                   | [Preprod Explorer](https://preprod.midnightexplorer.com)                                                              |
| 1AM Explorer links                        | [Successful deployment](https://explorer.1am.xyz/tx/ada1036389941b4cc87385300f0288c05746cec707648266599e1657cbdc5cf3) |
| Screenshots                               | 1AM Explorer success screenshot observed in the release session; repository asset pending                             |

## Exact deployment evidence JSON

Copied from Aptor immediately after finalization and the successful indexer
query:

```json
{
  "network": "preprod",
  "contractAddress": "86577ec2059e8e0ee13216e6e92d90dda54cae79d75118e1e8ed81beb8becff4",
  "deploymentTransactionId": "00c56655f4b3a343ac3af7b0182773ff579e1e8790f59b2340c27af27fd480f781",
  "deploymentBlockHeight": 1717550,
  "deploymentTimestamp": "2026-07-18T23:11:19.061Z",
  "artifactFingerprint": "63301367e8c09bc4c2bfe25b94e2e12a2197940d309bd0644dd15a75add96749",
  "indexerQueryVerified": true,
  "explorerUrl": "https://preprod.midnightexplorer.com",
  "oneAmExplorerUrl": "https://explorer.1am.xyz/?network=preprod"
}
```

The separate `ada103…` value is the transaction hash displayed by 1AM
Explorer for the same successful deployment at block `1717550`. It is retained
under that surface-specific label and is not substituted for Aptor's finalized
transaction ID.

## Prepared, locally observed evidence

- Generated artifact fingerprint:
  `63301367e8c09bc4c2bfe25b94e2e12a2197940d309bd0644dd15a75add96749`.
- The official Preprod RPC returned a synced health response with peers during
  the release audit on 2026-07-18.
- The official v4 Preprod GraphQL indexer returned `Query` during the same
  audit.
- The installed Connector API is `4.0.1`; Aptor calls the wallet-provided
  `getProvingProvider` path and has no mocked public proving fallback.
- 1AM identified itself as `com.midnight.1am`, reported Connector API `4.0.0`
  and Preprod services, returned positive spendable DUST, and accepted Aptor's
  exact ZK key-material provider before deployment.
- A separate post-deployment `queryContractState` check returned the finalized
  contract at the recorded address.
- Local validation results belong below only after the final validation run.

## Real versus simulated boundary

| Area                             | Release implementation                     | Evidence state                             |
| -------------------------------- | ------------------------------------------ | ------------------------------------------ |
| Credential signature             | Real Jubjub Schnorr, browser-local         | Implemented and locally tested             |
| Vault/envelope crypto            | Real Web Crypto AES-GCM/PBKDF2/P-256 ECDH  | Implemented and locally tested             |
| LocalNet request/proof           | Real provider-backed LocalNet transactions | Existing milestone evidence                |
| Preprod wallet                   | Real 1AM Connector API v4                  | Observed and passed deployment preflight   |
| Preprod proof provider           | 1AM-returned proving provider              | Observed with exact Aptor key material     |
| Preprod deployment/request/proof | Real transactions only                     | Deployment complete; request/proof pending |
| Public delivery                  | Durable SQLite on Railway volume           | Pending deployment                         |

## Privacy inspection record

For the final scenario, capture evidence that the delivery database contains
only profiles, capability hashes, routing metadata, public request/transaction
fields, and encrypted envelope bytes. Inspect API payloads, production logs,
browser network traffic, IndexedDB, localStorage, URL history, both public
transactions, decoded contract state, indexer response, and Verifier receipt.

The server and public chain must not contain credential plaintext, exact private
duration or rating, private skill lists, holder secrets, issuer signing secrets,
vault passwords, or private encryption keys. Aptor does not claim to hide
routing, size, or timing metadata.

## Final validation ledger

Deployment evidence was observed at `2026-07-18T23:11:19.061Z`; the configured
production build and live contract preflight were revalidated on 2026-07-19.
Local transaction identifiers below are regression evidence only and are not
presented as Preprod evidence.

| Gate                                  | Result                  | Safe observed evidence                                                                                                                                                                                                                    |
| ------------------------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Database migration and health         | Pass                    | Production smoke migrated a temporary SQLite database; `/api/health` reported writable schema v1.                                                                                                                                         |
| Delivery/API tests                    | Pass                    | `npm run delivery:test`; both compiled test files passed, including authorization, expiry, ciphertext, replay, notification and health paths.                                                                                             |
| Browser crypto/provider tests         | Pass                    | `npm test --workspace @aptor/browser`; six compiled test files passed, including vault/envelope crypto, provider failures, artifact mismatch and 1AM prioritization.                                                                      |
| Compact simulator                     | Pass                    | `npm run contract:test`; 22/22 passed, including wrong holder, unmet predicates, replay and private/public boundary cases.                                                                                                                |
| LocalNet services                     | Pass                    | `npm run midnight:network:health`; node, v4 indexer and real HTTP proof server all reported healthy.                                                                                                                                      |
| Provider-backed LocalNet regression   | Pass                    | `npm run midnight:test:network`; real deployment/registration/fulfillment finalized, negative cases stopped before proof, and public-artifact privacy findings were 0.                                                                    |
| Three-profile Playwright workflow     | Pass                    | Fresh fixture plus `npm run test:e2e:local --workspace @aptor/web`; 9/9 passed in 3.1 minutes. Local request `aabeeb10…cdac` finalized registration `00b69704…e4d5` and fulfillment `006bd9f5…d1f63`; the Verifier updated automatically. |
| Browser storage and delivery privacy  | Pass locally            | Playwright observed two encrypted envelopes, zero localStorage secret keys, and no credential/private-key strings in captured request bodies or SQLite rows. Production inspection remains pending.                                       |
| Responsive checks                     | Pass locally            | Production-mode Chrome checks passed at 1280, 768, 414, 375 and 320 px; public-host device inspection remains pending.                                                                                                                    |
| Static gates                          | Pass                    | TypeScript, ESLint, Prettier, `git diff --check`, and `npm run security:scan` passed.                                                                                                                                                     |
| Production build and bundle           | Pass                    | Optimized Next.js Preprod build passed with contract `86577e…ecff4`, deployment mode disabled, and the exact artifact fingerprint; the bundle contained no Aptor LocalNet URLs or browser source maps and included all six ZK artifacts.  |
| Production runtime smoke              | Pass locally            | `npm run release:smoke`; role routes and health returned 200, deployment route/API returned 404, artifact MIME/cache headers passed, and normal preflight returned 200 after querying the deployed contract through the live indexer.     |
| Official Preprod endpoints            | Pass at validation time | RPC reported synced with peers; the v4 GraphQL indexer returned `Query` and subsequently returned the finalized Aptor contract at `86577e…ecff4`.                                                                                         |
| Production npm advisory audit         | Pass                    | `npm audit --omit=dev` completed against the npm advisory service on 2026-07-19 and reported zero vulnerabilities.                                                                                                                        |
| 1AM identity/network/DUST/proving     | Pass                    | 1AM `com.midnight.1am` exposed compatible Connector v4, reported Preprod and positive DUST, and accepted the fingerprint-bound proving-provider request.                                                                                  |
| Preprod deployment and state query    | Pass                    | Contract `86577e…ecff4` finalized at block `1717550`; Aptor recorded transaction `00c566…80f781`, and both deployment-time and independent indexer queries returned the contract.                                                         |
| Railway host and real public scenario | Pending                 | Requires Railway project access, an attached volume and public domain, then the three-profile public workflow and production privacy inspection.                                                                                          |
