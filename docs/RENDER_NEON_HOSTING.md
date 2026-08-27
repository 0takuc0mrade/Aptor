# Render free + Neon hosting path

## Status

This is the selected no-cost alternative hosting design. It is not yet a claim
of deployment and does not replace the existing Railway path.

## Deployment choices

| Target            | Application service     | Delivery storage                           | Status                           |
| ----------------- | ----------------------- | ------------------------------------------ | -------------------------------- |
| Local development | Node/Next.js            | SQLite under `.aptor-delivery/`            | Implemented                      |
| Railway           | One Next.js service     | SQLite at `/data/aptor.sqlite` on a volume | Existing configuration preserved |
| Render free       | One Next.js web service | Neon Postgres through `DATABASE_URL`       | Postgres adapter required        |

Render free has an ephemeral filesystem and cannot attach a persistent disk.
Using the existing SQLite path there would lose profiles, invitations,
encrypted envelopes, notifications, and request tracking after a restart.

## Intended Render architecture

The same Next.js service hosts the UI and `/api/delivery/*` routes. A Neon
Postgres database stores the same delivery records currently stored by SQLite.
The browser continues to encrypt credential and request envelopes before they
reach the API. Neon must never receive credential plaintext, private keys,
holder secrets, or ZK witnesses.

The production adapter will be selected only when `DATABASE_URL` is set.
`APTOR_DELIVERY_DB_PATH` remains the SQLite selector for Railway and local
development. The Postgres migration must preserve prepared/parameterized
queries, authorization, uniqueness, rate limiting, and one-time invitation
redemption under concurrency.

## Readiness gates

Before Render is called end-to-end ready:

1. Implement and test the asynchronous Postgres delivery adapter.
2. Run the delivery API suite against an isolated Postgres database.
3. Add `render.yaml` with the existing production build/start commands.
4. Configure `DATABASE_URL`, the public Aptor URL, Midnight/HSK public values,
   and no private wallet keys in Render.
5. Run the complete three-profile browser scenario on the public URL.
6. Warm the free Render service before judging to account for cold starts.

Do not delete `railway.json` or the `/data` SQLite documentation when adding
this path.
