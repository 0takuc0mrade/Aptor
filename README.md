# Aptor

> **Prove the work. Protect the details.**

Aptor lets professionals prove confidential work experience without exposing client IP, private repositories, internal metrics, exact ratings, project names, or client identities.

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

The MVP supports all three roles as real, file-mediated browser workflows
inside one application.

## MVP journey

1. A professional creates an encrypted local identity and exports a public
   `.aptor-holder.json` profile.
2. An issuer imports that profile, signs a credential, and exports an encrypted
   `.aptor-credential` package.
3. The professional decrypts and verifies the credential into an encrypted
   IndexedDB vault.
4. A verifier imports public issuer profiles, registers one structured request,
   and exports `.aptor-request.json`.
5. The professional validates the registered request, selects a compatible
   private credential, and submits a real Midnight proof.
6. The verifier queries the public one-time fulfillment receipt. The credential,
   exact values, selected issuer, and holder secret remain private.

Expiry, revocation, legal issuer identity, public share links, and backend
recovery remain intentionally outside this MVP.

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
│   └── shared/               Strict shared TypeScript domain types
├── scripts/                  Repository automation notes
├── .env.example             Non-secret endpoint placeholders
├── PRODUCT.md               End-user product context
├── tokens.css               Shared Aptor design tokens
└── package.json             npm workspace orchestration
```

## What is real and what is simulated

| Area               | Implemented now                                                                    | Later target                                      |
| ------------------ | ---------------------------------------------------------------------------------- | ------------------------------------------------- |
| Domain model       | Runtime-validated holder, issuer, encrypted credential, request, and vault formats | Expiry and revocation formats                     |
| Frontend           | Responsive Issuer, Professional, and Verifier workflows                            | Public share links and account sync               |
| Credential signing | Real Jubjub Schnorr signing; encrypted issuer vault                                | Legal identity policy and key rotation            |
| Midnight contract  | Private issuer/skill membership and four request-bound predicates                  | Expiry, revocation, and multi-credential policies |
| Proof generation   | Real browser-triggered proofs and finalized LocalNet transactions                  | Public test-network deployment                    |
| Wallet             | Official DApp Connector discovery and connected wallet API                         | Submission-network wallet compatibility matrix    |
| Local storage      | AES-GCM/PBKDF2 IndexedDB vaults with backup, restore, lock, and delete             | Multi-device recovery                             |
| Proof results      | Product-facing registration, fulfillment, query, and replay states                 | Shareable public receipt links                    |

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

Browser proof actions require the public `NEXT_PUBLIC_APTOR_*` values described
in `.env.example`. The app uses the selected network and configured contract;
it does not invent a deployment. Milestone 5 was validated on LocalNet through
the official test adapter. No Preprod deployment is claimed.

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
- **Public Preview/Preprod deployment** — a separately funded remote test-network deployment; this has not been attempted unless explicitly recorded in the milestone report.

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

## Security baseline

Never commit wallet seeds, private keys, private credentials, private-state
databases, or local deployment state. Compiled Aptor ZK artifacts are generated
locally and copied to the web static boundary at build time; they contain no
credential witness data. `.env.example` contains public placeholders only.
Contract addresses and proof results must come from real deployments—not UI
fixtures.
