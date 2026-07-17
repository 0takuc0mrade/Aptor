# Aptor

> **Prove the work. Protect the details.**

Aptor lets professionals prove confidential work experience without exposing client IP, private repositories, internal metrics, exact ratings, project names, or client identities.

A previous client or employer issues a private work credential. A future employer creates a bounded proof request. The professional selects a credential and uses Midnight to prove that its private attributes satisfy the request. The verifier receives only the requested pass/fail results.

## The problem

Professionals often cannot show their strongest work because it belongs to a client or employer. Conventional references disclose too much, while a résumé asks a verifier to trust an unstructured claim. Aptor creates a middle path: an accepted issuer attests to structured work facts, and a zero-knowledge proof verifies only the facts a verifier asked about.

Aptor does **not** determine whether the issuer told the truth. It proves that an accepted issuer attested to an unmodified, unexpired credential owned by the professional and that the private credential satisfies a structured request.

## Roles

- **Issuer** — a previous client or employer who creates and signs a private project credential.
- **Professional** — the credential holder who stores credentials locally, chooses one for a request, and generates a selective proof.
- **Verifier** — a recruiter, client, or employer who creates a structured request and receives only verification results.

The MVP supports all three roles inside one application.

## MVP journey

1. An issuer creates and signs a credential for a professional.
2. The professional receives and stores its private attributes.
3. A verifier creates a bounded proof request.
4. The professional selects a credential that should satisfy the request.
5. Midnight checks issuer acceptance, integrity, ownership, expiry, and requested conditions.
6. The verifier receives a pass/fail result for each requested condition.
7. An altered or fake credential fails verification.

## Repository structure

```text
aptor/
├── apps/
│   └── web/                 Next.js application shell
├── contracts/               Compact source and generated-artifact boundary
│   └── aptor-credential/    Private duration threshold contract package
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

| Area               | Foundation milestone                                          | MVP target                                                                             |
| ------------------ | ------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Domain model       | Real shared strict TypeScript types                           | Same types drive contract and UI adapters                                              |
| Frontend           | Real responsive role shell and routes                         | Real credential and proof workflow                                                     |
| Credential signing | Designed, not implemented                                     | Real issuer signature or equivalent issuer-authorized commitment verified by the proof |
| Midnight contract  | Real duration-threshold primitive and provider API            | Full credential integrity and bounded predicate policy                                 |
| Proof generation   | Real proof-server generation and finalized local transactions | Repeatable proof generation through supported providers                                |
| Wallet             | Not connected                                                 | Official supported wallet/DApp connector flow                                          |
| Issuer onboarding  | Not implemented                                               | Company-domain checks may be clearly simulated for the hackathon                       |
| Proof results      | No fictional results                                          | Results come only from a verified proof                                                |

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

## Security baseline

Never commit wallet seeds, private keys, private credentials, private-state databases, deployment state, or generated proving keys. `.env.example` contains placeholders only. Public identifiers, contract addresses, and proof results must be sourced from real deployments—not invented for UI demos.
