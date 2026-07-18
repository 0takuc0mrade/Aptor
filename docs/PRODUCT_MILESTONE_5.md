# Product milestone 5: complete browser workflow

## Status

Milestone 5 connects Aptor's three role pages to real credential cryptography,
the official Midnight DApp Connector interface, and the existing Compact
contract. The validated browser path runs on Midnight LocalNet. Aptor has not
been deployed to Preprod.

The completed LocalNet browser run used three isolated browser contexts and
produced:

| Evidence                 | Value                                                                |
| ------------------------ | -------------------------------------------------------------------- |
| Contract                 | `adac8028afba1f7afe8cc45d65dfc8f42a3e20a263a00409567953a1f926b324`   |
| Deployment transaction   | `00ceb6b12c0973e19e9065131a37024715cbee7b11730969ebf47e9b0f94001ab6` |
| Deployment block         | `174`                                                                |
| Request ID               | `4aeda281416c06943e997c2d452996d83add999b5a9f2b710f4c0b5e584444d3`   |
| Registration transaction | `00b69e5e52a921c7f9c833d99627efab045dcefb96a87e5de45c5c565f648b5c21` |
| Fulfillment transaction  | `0053f09c32ef2ef09a5a989754d32d6211bba1a5b4c2da3be4a86513073239db99` |

These identifiers belong to an ephemeral local chain and are evidence, not
public-network links.

## 1. Browser architecture

```text
Issuer browser                 Professional browser              Verifier browser
  encrypted issuer vault         encrypted credential vault        public request form
  signing key + history          holder secret + credentials        accepted issuer set
          │                                │                                │
          ├─ .aptor-issuer.json ───────────┼───────────────────────────────>│
          │<─ .aptor-holder.json ──────────┤                                │
          ├─ .aptor-credential ───────────>│<─ .aptor-request.json ─────────┤
          │                                │                                │
          │                                └─ official wallet proof ───────>│ Midnight
          │                                                                 │ public receipt
```

`packages/aptor-browser` is the browser boundary. It owns runtime schemas,
Web Crypto containers, IndexedDB vault sessions, portable files, wallet
discovery, browser provider assembly, contract calls, public queries, and the
ephemeral private-state provider. `apps/web` owns user interaction only.
There are no server actions or API routes for credential data.

## 2. Wallet connection

The app discovers version-4 connectors from `window.midnight`, asks the selected
connector to connect to the configured network, and retains the connected API
in a client-side ref. It displays detection, permission, connected,
wrong-network, rejection, and connection-lost states, plus the shortened
unshielded address, network, and dust balance.

The app never asks for a mnemonic, seed, wallet password, or private key. The
required browser E2E uses `DAppConnectorWalletAdapter` from the official
testkit. Playwright bridges its real LocalNet wallet and proving methods into
three isolated browser profiles; that adapter is test-only and is not bundled
into the production application.

## 3. Provider assembly

Each proof action assembles:

- the official indexer public-data provider;
- `AptorFetchZkConfigProvider` for browser-served ZK artifacts;
- the connected wallet's official proving provider;
- wallet transaction balancing and submission adapters;
- `EphemeralPrivateStateProvider` for proof-scoped witness state;
- a logger provider with all log levels disabled.

The durable encrypted vault is the source of private data. A selected
credential is hydrated into the ephemeral provider only for the proof action.
The provider is disposed in `finally` paths after success or failure and on
vault lock. It cannot export private state or signing keys.

The browser fetch provider binds `fetch` to the browser global. A regression
test covers this because an unbound `window.fetch` fails with `Illegal
invocation` when verifier keys are first loaded.

## 4. Network selection

Browser configuration uses:

```text
NEXT_PUBLIC_APTOR_NETWORK
NEXT_PUBLIC_APTOR_CONTRACT_ADDRESS
NEXT_PUBLIC_APTOR_INDEXER_URL
NEXT_PUBLIC_APTOR_INDEXER_WS_URL
NEXT_PUBLIC_APTOR_ZK_ARTIFACTS_URL
```

Supported network identifiers are `mainnet`, `preview`, `preprod`, and the
LocalNet identifier `undeployed`. The app refuses proof actions without a
contract address and rejects imported requests whose network or address does
not match. No wallet secret is stored in environment variables.

## 5. Encrypted vault

Professional and issuer vaults are encrypted with AES-256-GCM. Keys are
derived from user passwords with PBKDF2-HMAC-SHA-256, a fresh random 32-byte
salt, and 310,000 iterations. Every write uses a fresh 12-byte IV and
authenticated context data. IndexedDB stores only the versioned encrypted
container.

The professional vault contains the holder secret, holder profile, verified
credentials, and registered request packages. The issuer vault contains the
Jubjub signing secret, public profile, and minimal issuance references. The UI
supports create, unlock, lock, encrypted backup, restore, and confirmed local
deletion. Aptor has no password recovery.

## 6. Credential transfer

The issuer signs the existing `WorkCredentialV1` using the production Jubjub
Schnorr implementation. The signed credential is wrapped in an
`.aptor-credential` AES-GCM container protected by a separate transfer
passphrase. The passphrase is never written to the file and must be shared
outside Aptor.

On import, the professional decrypts the package, validates every runtime
field, verifies the issuer signature, verifies holder binding, reconstructs
the skill data, and only then saves it into the encrypted vault. Altered
ciphertext and incorrect passphrases are rejected by authenticated
decryption.

## 7. Request transfer

The verifier exports `.aptor-request.json` only after the request has been
registered and finalized. It contains the public criteria, accepted issuer
profiles, issuer-root commitment, request commitment, contract address,
network, and real registration transaction ID. It contains no issuer signing
key, credential, holder secret, or witness path.

The professional recomputes the request commitment, verifies network and
contract binding, queries registration state, checks issuer compatibility,
and excludes already fulfilled requests before enabling proof generation.

## 8. Issuer workflow

1. Create or unlock the encrypted issuer vault.
2. Export the public issuer profile.
3. Import a professional's public holder profile.
4. Enter skills, duration, production delivery, and rating.
5. Review the complete private credential.
6. Sign it with the vault-held Jubjub key.
7. Encrypt and download the credential package.

The display name is unverified metadata. Aptor proves possession of the issuer
key; it does not verify the legal organisation behind the name.

## 9. Professional workflow

1. Create or unlock the encrypted professional vault.
2. Export the public holder profile.
3. Import and decrypt a credential package.
4. Verify signature and holder binding locally.
5. Import and validate a registered request package.
6. Select one compatible private credential.
7. Review what is requested, public, and private.
8. Connect an official Midnight wallet.
9. Generate and submit the real request-bound proof.
10. Display the finalized public receipt and transaction ID.

## 10. Verifier workflow

1. Import one or more public issuer profiles.
2. Set one required skill and optional duration, production, and rating rules.
3. Review the complete public request.
4. Connect an official Midnight wallet.
5. Register and finalize the request.
6. download or copy the public package.
7. Query later by package or request ID.
8. Inspect registered, pending, fulfilled, mismatch, wrong-network, or
   not-found results.

## 11. Public and private fields

| Surface         | Public                                                                   | Private                                            |
| --------------- | ------------------------------------------------------------------------ | -------------------------------------------------- |
| Holder file     | profile ID, holder commitment, creation time                             | holder secret, credentials                         |
| Issuer file     | issuer public key, optional display name, creation time                  | issuer signing key, issuance vault                 |
| Credential file | encrypted-container metadata and ciphertext                              | every credential field and signature plaintext     |
| Request file    | criteria, request/issuer commitments, network, contract, registration ID | selected issuer, credential values, paths          |
| Ledger          | request commitment, fulfilled request ID                                 | credential, holder secret, signature, exact values |

## 12. Real versus simulated

| Component                                   | Status                                                 |
| ------------------------------------------- | ------------------------------------------------------ |
| Professional identity and holder commitment | Real                                                   |
| Issuer Jubjub key and credential signature  | Real                                                   |
| Credential AES-GCM transfer                 | Real                                                   |
| IndexedDB vault encryption                  | Real                                                   |
| Runtime file validation                     | Real                                                   |
| Official browser connector API              | Real; test run uses the official LocalNet test adapter |
| Request registration transaction            | Real LocalNet transaction                              |
| Request-bound ZK proof                      | Real Compact proof                                     |
| Fulfillment transaction and public query    | Real LocalNet transaction/query                        |
| Replay rejection                            | Real pre-proof ledger check and contract protection    |
| Legal identity verification                 | Not implemented                                        |
| Preprod deployment                          | Not attempted                                          |
| Backend account recovery or share links     | Not implemented                                        |

There are no fabricated credentials, transaction identifiers, fulfillment
states, analytics, or hidden cross-role data transfers.

## 13. LocalNet and Preprod status

The completed and tested target is LocalNet. The browser E2E deploys a fresh
contract, builds a production Next.js bundle with that address, starts an
isolated server, and drives the real workflow. Preprod remains a final delivery
milestone and no Preprod address or transaction is claimed here.

## 14. Browser test results

All eight Playwright tests passed in 2.7 minutes with three separate browser
contexts. The suite covered vault
creation and encrypted IndexedDB inspection, public profile downloads,
credential encryption/import, official connector discovery and connection,
real request registration, real proof fulfillment, public receipt query,
replay rejection, and absence of `localStorage` keys. Role entry pages are
checked at 320, 375, 414, 768, and 1440 pixels for horizontal overflow and
clipped actions.

## 15. Security inspection

- IndexedDB was inspected and contained ciphertext metadata, not
  `holderSecret` or plaintext credentials.
- `localStorage` contained no keys after proof fulfillment.
- public holder, issuer, and request files were inspected for private fields.
- request URLs contain no private query parameters.
- there are no credential upload routes, analytics integrations, or server
  actions receiving decrypted data.
- wallet and provider objects remain in refs/closures rather than serializable
  React state.
- proof-private state is disposed on success, failure, and vault lock.
- production static assets contain real ZK artifacts, not private test
  fixtures.

The repository scan detects known dangerous secret sinks and literal private
material patterns. It cannot prove the absence of browser extensions,
compromised dependencies, memory-scraping malware, or secrets introduced after
the scan.

## 16. Known limitations

- issuer legal identity is not verified;
- transfer passphrases must be shared through another channel;
- forgotten vault passwords cannot be recovered;
- expiry and revocation are not implemented;
- public share links are not implemented;
- a request asks for one skill;
- no production backend or account sync exists;
- LocalNet is validated; Preprod is not deployed;
- the approximately 11 MB `proveAgainstRequest` prover key can make first proof
  loading visibly slower.

## 17. Reproduction

Requirements are Node.js 22+, npm, Docker Compose v2, and the pinned Compact
toolchain.

```bash
npm install
npm run contract:compile
npm run midnight:network:up
npm run browser:e2e:prepare
npm run test:e2e:local --workspace @aptor/web
npm run midnight:network:down
```

`browser:e2e:prepare` compiles the contract and browser packages, deploys a
fresh contract, and writes ignored local deployment metadata under
`.midnight/browser-e2e/`. Playwright builds and serves an isolated production
app from `.next-playwright` so it does not interfere with a developer's port
3000 session.

## 18. Demo instructions

For a manual demo, start LocalNet, deploy Aptor, and place the deployment's
public values into the `NEXT_PUBLIC_APTOR_*` variables before starting the web
app. Use three browser profiles. Move only the downloaded Aptor files between
profiles. Use a LocalNet-compatible official connector or run the automated
official test-adapter path. Show the verifier's fulfilled receipt last, then
explain that the credential, exact values, and chosen issuer never became
public.
