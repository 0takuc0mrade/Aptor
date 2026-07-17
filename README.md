# Aptor

> **Prove the work. Protect the details.**

Aptor lets professionals prove confidential work experience without exposing client IP, private repositories, internal metrics, exact ratings, project names, or client identities.

A previous client or employer issues a private work credential. A future employer creates a bounded proof request. The professional selects a credential and uses Midnight to prove that its private attributes satisfy the request. The verifier receives only the requested pass/fail results.

## The problem

Professionals often cannot show their strongest work because it belongs to a client or employer. Conventional references disclose too much, while a résumé asks a verifier to trust an unstructured claim. Aptor creates a middle path: an accepted issuer attests to structured work facts, and a zero-knowledge proof verifies only the facts a verifier asked about.

Aptor verifies that an accepted issuer signed the private credential and that
the credential satisfies a requested threshold. Aptor does not prove that the
issuer's original claim was truthful.

## Roles

- **Issuer** — a previous client or employer who creates and signs a private project credential.
- **Professional** — the credential holder who stores credentials locally, chooses one for a request, and generates a selective proof.
- **Verifier** — a recruiter, client, or employer who creates a structured request and receives only verification results.

The MVP supports all three roles inside one application.

## MVP journey

1. An issuer creates and signs a credential bound to the professional's secret.
2. The professional receives its private credential and issuer signature.
3. A verifier requests a public minimum duration.
4. The professional proves the signed private duration meets that minimum.
5. Midnight checks the issuer signature, holder-secret binding, and threshold.
6. The public state records only the accepted issuer key and a temporary success counter.
7. An altered credential, wrong holder, unaccepted issuer, or failing threshold is rejected.

Skills, ratings, production delivery, expiry, revocation, structured request
receipts, browser-wallet binding, and frontend activation remain later work.

## Repository structure

```text
aptor/
├── apps/
│   └── web/                 Next.js application shell
├── contracts/               Compact source and generated-artifact boundary
│   └── aptor-credential/    Authenticated private-duration contract package
├── docs/                    Architecture, privacy, scope, and build plan
├── packages/
│   ├── aptor-midnight/       Local provider stack, deployment API, and network test
│   └── shared/               Strict shared TypeScript domain types
├── scripts/                  Repository automation notes
├── .env.example             Non-secret endpoint placeholders
├── PRODUCT.md               End-user product context
├── tokens.css               Shared Aptor design tokens
└── package.json             npm workspace orchestration
```

## What is real and what is simulated

| Area               | Implemented now                                                   | Later target                                             |
| ------------------ | ----------------------------------------------------------------- | -------------------------------------------------------- |
| Domain model       | Strict signed/private/public credential types                     | Shared request and frontend adapters                     |
| Frontend           | Responsive role shell and routes; no credential flow              | Issuance, storage, request, and proof workflows          |
| Credential signing | Real Jubjub Schnorr signing with secure ephemeral keys            | Durable issuer key management and rotation               |
| Midnight contract  | Verifies issuer signature, holder secret, and duration threshold  | More predicates, expiry, revocation, and request binding |
| Proof generation   | Real proof-server generation and finalized local transactions     | Supported browser provider flow                          |
| Wallet             | Local genesis-funded development wallet in network tests only     | Official browser wallet/DApp connector                   |
| Issuer onboarding  | Not implemented                                                   | Explicit trust and issuer-management policy              |
| Proof results      | Temporary public success counter backed by finalized transactions | Structured, request-bound verification receipts          |

## Getting started

Requirements:

- Node.js 22 or newer
- npm 11 or compatible
- Docker with Compose v2 for the local Midnight proof milestone
- Compact devtools and a compiler version compatible with the chosen Midnight release

```bash
npm install
npm run dev
```

Open `http://localhost:3000` for the Aptor landing page, then enter the Issuer,
Professional, or Verifier workspace from the role navigation.

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

The local stack is pinned to the image versions recorded in
`packages/aptor-midnight/docker-compose.local.yml`. The network test uses the
local genesis-funded development wallet only. It never reads a production seed
or mnemonic.

## Integration status vocabulary

- **Compiled Compact circuit** — the handwritten Compact source compiled successfully.
- **Generated proving artifacts** — the compiler emitted the prover key, verifier key, ZKIR, and generated bindings.
- **Proof-server-generated ZK proof** — the HTTP proof provider invoked the running proof server for a real call transaction.
- **Locally finalized Midnight transaction** — the local node accepted the transaction and the indexer returned finalized public data.
- **Public Preview/Preprod deployment** — a separately funded remote test-network deployment; this has not been attempted unless explicitly recorded in the milestone report.

## Quality commands

```bash
npm run format:check
npm run lint
npm run typecheck
npm run build
```

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [MVP scope](docs/MVP_SCOPE.md)
- [Privacy model](docs/PRIVACY_MODEL.md)
- [Build plan](docs/BUILD_PLAN.md)
- [Contract milestone 1](docs/CONTRACT_MILESTONE_1.md)
- [Contract milestone 2](docs/CONTRACT_MILESTONE_2.md)
- [Contract milestone 3](docs/CONTRACT_MILESTONE_3.md)

## Security baseline

Never commit wallet seeds, private keys, private credentials, private-state databases, deployment state, or generated proving keys. `.env.example` contains placeholders only. Public identifiers, contract addresses, and proof results must be sourced from real deployments—not invented for UI demos.
