# Aptor

> **Prove the work. Protect the details.**

Aptor lets professionals prove confidential work experience without exposing client IP, private repositories, internal metrics, exact ratings, project names, or client identities.

This project is built on the Midnight Network.

## Public release status

The Aptor Compact contract is deployed and independently queryable on Midnight
Preprod. The one-time deployment used the real 1AM Connector v4 proving path
and the exact staged artifact fingerprint. Public Railway hosting and the real
request/fulfillment scenario remain at their human-action checkpoints.

| Release item      | Current value                                                                                                                     |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Live application  | Pending Railway project, volume, variables, and generated domain                                                                  |
| Preprod contract  | `86577ec2059e8e0ee13216e6e92d90dda54cae79d75118e1e8ed81beb8becff4`                                                                |
| Deployment block  | `1717550`                                                                                                                         |
| Midnight Explorer | [Preprod Explorer](https://preprod.midnightexplorer.com)                                                                          |
| 1AM deployment    | [Successful deployment transaction](https://explorer.1am.xyz/tx/ada1036389941b4cc87385300f0288c05746cec707648266599e1657cbdc5cf3) |
| Demo video        | Pending final public scenario                                                                                                     |

A previous client or employer issues a private work credential. A future employer creates a bounded proof request. The professional selects a credential and uses Midnight to prove that its private attributes satisfy the request. The verifier receives only the requested pass/fail results.

## The problem

Professionals often cannot show their strongest work because it belongs to a client or employer. Conventional references disclose too much, while a résumé asks a verifier to trust an unstructured claim. Aptor creates a middle path: an accepted issuer attests to structured work facts, and a zero-knowledge proof verifies only the facts a verifier asked about.

Aptor proves that a private credential was signed by an issuer within the
verifier's accepted issuer set. It does not reveal which accepted issuer signed
it, and it does not prove that the issuer's original statement was truthful.

## Roles

- **Issuer** — a previous client or employer who creates and signs a private project credential.
- **Professional** — the credential holder who stores credentials locally, chooses one for a request, and generates a selective proof.
- **Verifier** — a recruiter, client, or employer who creates a structured request and receives only verification results.

One encrypted Aptor profile can use all three role workspaces. In-app
invitations, encrypted inbox delivery, notifications, and automatic receipt
monitoring are the default. Versioned files remain an advanced portability
fallback.

## Default journey

Invite an employer, receive a private credential, receive a proof request, and
prove your experience.

1. A Professional creates one encrypted Aptor profile and sends a single-use
   Issuer invitation.
2. The Issuer accepts, signs bounded work facts locally, and encrypts the signed
   credential to the Professional's public encryption key.
3. The Professional decrypts, validates, and accepts the credential into the
   encrypted IndexedDB account vault.
4. A Verifier selects Aptor profiles, registers a structured request on
   Midnight, and sends its encrypted package to the Professional inbox.
5. Aptor matches compatible credentials locally. The Professional selects one
   and submits the real request-bound proof with explicit wallet approval.
6. The Verifier dashboard polls Midnight and automatically shows the fulfilled
   receipt. The source credential never reaches the Verifier or Aptor server.

Portable holder, Issuer, credential, and request files remain under Advanced.
Expiry, revocation, legal Issuer verification, multi-device sync, and account
recovery remain intentionally outside this milestone.

## Repository structure

```text
aptor/
├── apps/
│   └── web/                 Next.js application shell
├── contracts/               Compact source and generated-artifact boundary
│   └── aptor-credential/    Request-bound private capability contract package
├── docs/                    Architecture, privacy, scope, and build plan
├── packages/
│   ├── aptor-midnight/       Local provider stack, deployment API, and network test
│   ├── aptor-browser/        Browser crypto, vaults, files, wallet, and contract APIs
│   ├── aptor-delivery/       SQLite migrations, capability auth, encrypted routing
│   └── shared/               Strict shared TypeScript domain types
├── scripts/                  Repository automation notes
├── .env.example             Non-secret endpoint placeholders
├── PRODUCT.md               End-user product context
├── tokens.css               Shared Aptor design tokens
└── package.json             npm workspace orchestration
```

## What is real and what is simulated

| Area               | Implemented now                                                                                     | Later target                                       |
| ------------------ | --------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Domain model       | Runtime-validated profiles, invitations, envelopes, credentials, requests, and vaults               | Expiry and revocation formats                      |
| Frontend           | Responsive Issuer, Professional, and Verifier workflows                                             | Public share links and account sync                |
| Credential signing | Real Jubjub Schnorr signing; encrypted issuer vault                                                 | Legal identity policy and key rotation             |
| Midnight contract  | Private issuer/skill membership and four request-bound predicates                                   | Expiry, revocation, and multi-credential policies  |
| Proof generation   | Real browser-triggered LocalNet proofs; 1AM proving-provider and deployment verified on Preprod     | One real Preprod request proof                     |
| Wallet             | Official Connector API v4 and wallet-provided proving; 1AM release gate                             | Broader wallet compatibility matrix                |
| Local storage      | One AES-GCM/PBKDF2 IndexedDB account vault with every role state                                    | Multi-device recovery                              |
| Delivery service   | SQLite, hashed capabilities, ciphertext envelopes, notifications, status cache, Railway volume plan | Multi-instance SQL adapter and production identity |
| Proof results      | Automatic registration, proof-submitted, and fulfilled states from chain queries                    | Shareable public receipt links                     |

## Getting started

Requirements:

- Node.js 22 or newer
- npm 11 or compatible
- Docker with Compose v2 for the local Midnight proof milestone
- Compact devtools and a compiler version compatible with the chosen Midnight release

```bash
npm install
npm run delivery:migrate
npm run dev
```

Open `http://localhost:3000` for the Aptor landing page, then enter the Issuer,
Professional, or Verifier workspace from the role navigation.

Browser proof actions require the public `NEXT_PUBLIC_APTOR_*` values described
in `.env.example`. The app uses the selected network and configured contract;
it does not invent a deployment. Copy `.env.preprod.example` for the public
release and replace its contract, fingerprint, and host placeholders only with
observed values.

The public browser path uses the proving provider exposed by 1AM through DApp
Connector API v4. Aptor does not configure a hosted proof-server URL and never
falls back to mocked proving. LocalNet regression tests continue to use the
repository's pinned local proof server.

Compile and test the Compact contract:

```bash
npm install --prefix contracts/aptor-credential
npm run contract:compile
npm run contract:typecheck
npm run contract:test
```

Run the local Midnight milestone:

```bash
npm run midnight:network:up
npm run midnight:network:health
npm run midnight:test:network
npm run midnight:network:down
```

Or run the start, health, network-test, and cleanup lifecycle together:

```bash
npm run midnight:test:local
```

Run the complete three-browser LocalNet workflow:

```bash
npm run midnight:network:up
npm run browser:e2e:prepare
npm run test:e2e:local --workspace @aptor/web
npm run midnight:network:down
```

The local stack is pinned to the image versions recorded in
`packages/aptor-midnight/docker-compose.local.yml`. The network test uses the
local genesis-funded development wallet only. It never reads a production seed
or mnemonic.

## Integration status vocabulary

- **Compiled Compact circuit** — the handwritten Compact source compiled successfully.
- **Generated proving artifacts** — the compiler emitted the prover key, verifier key, ZKIR, and generated bindings.
- **Proof-server-generated ZK proof** — the HTTP proof provider invoked the running proof server for a real call transaction.
- **Locally finalized Midnight transaction** — the local node accepted the transaction and the indexer returned finalized public data.
- **Public Preprod deployment** — the finalized contract deployment recorded in
  `docs/PREPROD_EVIDENCE.md`; it does not by itself prove that the later
  request/fulfillment scenario has run.

## Public hosting model

`railway.json` defines one long-running Next.js service with a health check and
restart policy. Attach one Railway volume at `/data`; the SQLite delivery
database is stored at `/data/aptor.sqlite`, and migrations run inside the start
command where the volume is available. Keep one replica while Aptor uses
SQLite. Repository access, volume creation, domain generation, and any usage or
billing impact remain explicit human checkpoints. See
[production hosting](docs/PRODUCTION_HOSTING.md).

## Quality commands

```bash
npm run format:check
npm run lint
npm run typecheck
npm run build
npm run security:scan
```

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [MVP scope](docs/MVP_SCOPE.md)
- [Privacy model](docs/PRIVACY_MODEL.md)
- [Build plan](docs/BUILD_PLAN.md)
- [Contract milestone 1](docs/CONTRACT_MILESTONE_1.md)
- [Contract milestone 2](docs/CONTRACT_MILESTONE_2.md)
- [Contract milestone 3](docs/CONTRACT_MILESTONE_3.md)
- [Contract milestone 4](docs/CONTRACT_MILESTONE_4.md)
- [Product milestone 5](docs/PRODUCT_MILESTONE_5.md)
- [Product milestone 6](docs/PRODUCT_MILESTONE_6.md)
- [Delivery service](docs/DELIVERY_SERVICE.md)
- [Envelope encryption](docs/ENVELOPE_ENCRYPTION.md)
- [In-app user flow](docs/IN_APP_USER_FLOW.md)
- [Preprod deployment](docs/PREPROD_DEPLOYMENT.md)
- [Preprod evidence](docs/PREPROD_EVIDENCE.md)
- [Production hosting](docs/PRODUCTION_HOSTING.md)
- [Two-minute demo script](docs/DEMO_SCRIPT.md)
- [Submission checklist](docs/SUBMISSION_CHECKLIST.md)

## Security baseline

Never commit wallet seeds, private keys, private credentials, private-state
databases, or local deployment state. Compiled Aptor ZK artifacts are generated
locally and copied to the web static boundary at build time; they contain no
credential witness data. `.env.example` contains public placeholders only.
Contract addresses and proof results must come from real deployments—not UI
fixtures.

The local delivery database is ignored. It contains routing and timing metadata,
public profiles, request-tracking metadata, and encrypted envelope payloads. It
does not contain plaintext credentials, vault passwords, private encryption
keys, holder secrets, or Issuer signing keys.
