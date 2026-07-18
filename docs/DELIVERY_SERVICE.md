# Aptor delivery service

## Purpose

The delivery service replaces manual file forwarding as Aptor's default role
handoff. It publishes public profiles, creates one-time invitations, routes
encrypted envelopes, emits privacy-safe notifications, and caches public
request status. It never proves a credential and is never the source of truth
for fulfillment; Midnight owns those responsibilities.

## Local database

Milestone 6 uses Node's built-in SQLite driver. This keeps local development and
automated tests durable without a paid service or native dependency. The
adapter enables foreign keys and WAL mode. Versioned migrations create:

- `profiles`;
- `invitations`;
- `encrypted_envelopes`;
- `notifications`;
- `request_tracking`;
- `rate_limits`;
- `schema_migrations`.

Run the migration from the repository root:

```bash
npm run delivery:migrate
```

The default database is `.aptor-delivery/aptor.sqlite` and is ignored by Git.
Set `APTOR_DELIVERY_DB_PATH` to isolate a test or deployment database.

## Authentication model

The browser creates a 256-bit access capability. The raw value stays inside the
encrypted account vault and is sent only in the `Authorization: Bearer` header.
The server stores its SHA-256 hash and an expiry time. Capabilities never appear
in links, query parameters, logs, notifications, or database plaintext.

This is a device-bound hackathon account. There is no recovery, capability
rotation, multi-device synchronization, email identity, OAuth, or legal
organization verification. A production system needs a complete identity and
recovery design.

## API boundary

The Next.js catch-all route delegates to a framework-neutral handler in
`@aptor/delivery`. The handler provides:

| Method           | Path                   | Authorization         | Purpose                                  |
| ---------------- | ---------------------- | --------------------- | ---------------------------------------- |
| `POST`           | `/profiles`            | public bootstrap      | register a public profile and token hash |
| `GET`            | `/profiles/:handle`    | public                | resolve public routing and role keys     |
| `POST`           | `/invitations`         | profile               | create a hashed, expiring capability     |
| `POST`           | `/invitations/inspect` | invitation capability | show explicit invite state               |
| `POST`           | `/invitations/redeem`  | profile + invitation  | redeem once                              |
| `GET`            | `/invitations?scope=…` | profile               | list sent or accepted relationships      |
| `POST`           | `/envelopes`           | sender                | route validated ciphertext               |
| `GET`            | `/envelopes`           | recipient             | list the authenticated inbox             |
| `PATCH`          | `/envelopes/:id`       | recipient             | mark a delivery received                 |
| `GET/PATCH`      | `/notifications`       | owner                 | list or mark privacy-safe notifications  |
| `POST/GET/PATCH` | `/request-tracking`    | participant           | cache public lifecycle status            |

Request bodies are streamed through a 400,000-byte limit. Envelope ciphertext
has an additional schema limit. Zod validates every boundary. The service uses
prepared queries, safe fixed error messages, sender/recipient authorization,
one-time invitation updates, idempotent content-digest handling, and durable
rate-limit counters for invitation creation/redemption and delivery.

## Stored data

Public profile rows contain the normalized handle, display name, public holder
profile, public Issuer profile, and P-256 public encryption key. Envelope rows
contain routing IDs, type, ciphertext, nonce, ephemeral public key, encryption
version, digest, timestamps, and delivery status. Tracking rows contain public
request, network, contract, and transaction metadata.

There is no plaintext credential column. Database and API tests inspect this
boundary directly.

## Hosting replacement

Public hosting should replace `DeliveryDatabase` with a managed PostgreSQL (or
compatible SQL) adapter, preserve parameterized queries and migrations, put
request-size enforcement at the reverse proxy as well as the application, and
move rate limits to a distributed durable store. The browser protocol and
authorization rules should not change.

The hosted service will still observe communication relationships, timing,
type, and approximate size. TLS protects transport, but Aptor does not claim
metadata or network-level anonymity.
