# Aptor production hosting

## Decision

Use one Railway persistent service built from this repository, with one Railway
volume mounted at `/data`. This keeps Aptor's Next.js delivery API and Node
SQLite adapter together without changing the product data model.

`railway.json` pins the Railpack build, production start command, `/api/health`
readiness check and restart policy. Railway injects `PORT`; Next.js reads it at
runtime. The service must have a generated Railway domain or a custom HTTPS
domain before release validation.

## Durable storage

- Volume mount: `/data`
- SQLite path: `/data/aptor.sqlite`
- Migration/start command: `npm run start:production`
- Health route: `/api/health`
- Service instances: one while the SQLite adapter is in use

Attach the volume to the Aptor service in Railway before the production
deployment. Railway volumes are mounted only when the service starts, so the
database migration remains part of the start command rather than a build or
pre-deploy command. SQLite enables foreign keys and WAL. The health route
performs a write-lock check and reports the applied schema version without
revealing the database path or contents.

## Railway service setup

1. Create a Railway project from the `0takuc0mrade/Aptor` GitHub repository.
2. Use the repository root; Railway will read `/railway.json` automatically.
3. Open **Networking** and generate a Railway public domain.
4. Attach one volume to the Aptor service and set its mount path to `/data`.
5. Open **Variables**, use the Raw Editor, and add the values below.
6. Review the staged Railway changes, then deploy one service instance.

```dotenv
NEXT_PUBLIC_APTOR_NETWORK=preprod
NEXT_PUBLIC_APTOR_CONTRACT_ADDRESS=86577ec2059e8e0ee13216e6e92d90dda54cae79d75118e1e8ed81beb8becff4
NEXT_PUBLIC_APTOR_RPC_URL=https://rpc.preprod.midnight.network
NEXT_PUBLIC_APTOR_INDEXER_URL=https://indexer.preprod.midnight.network/api/v4/graphql
NEXT_PUBLIC_APTOR_INDEXER_WS_URL=wss://indexer.preprod.midnight.network/api/v4/graphql/ws
NEXT_PUBLIC_APTOR_EXPLORER_URL=https://preprod.midnightexplorer.com
NEXT_PUBLIC_APTOR_1AM_EXPLORER_URL=https://explorer.1am.xyz/?network=preprod
NEXT_PUBLIC_APTOR_ZK_ARTIFACTS_URL=/zk/aptor
NEXT_PUBLIC_APTOR_ARTIFACT_FINGERPRINT=63301367e8c09bc4c2bfe25b94e2e12a2197940d309bd0644dd15a75add96749
NEXT_PUBLIC_APTOR_ENABLE_PREPROD_DEPLOYMENT=false
APTOR_DELIVERY_DB_PATH=/data/aptor.sqlite
APTOR_PUBLIC_URL=https://${{RAILWAY_PUBLIC_DOMAIN}}
```

The `NEXT_PUBLIC_*` values are public release configuration and are available
during Railway's build as well as runtime. `APTOR_PUBLIC_URL` uses Railway's
same-service reference variable so it follows the generated or custom public
domain. No wallet, vault, profile, credential or encryption secret belongs in
Railway variables.

## Human checkpoint

Connecting GitHub, creating a Railway project, attaching storage, generating a
domain and accepting any usage or billing impact require the user's account and
approval. Keep the service at one replica: a single SQLite database on one
volume is not a horizontally scalable architecture.

## Backup and operational limits

Use Railway volume backups appropriate to the account plan and test a restore
before relying on them. SQLite backup/restore must preserve database
consistency; copying a live WAL database is not a backup procedure. A
volume-backed service can have brief downtime during deployments because the
old and new deployments cannot mount the same volume concurrently. Aptor's MVP
does not claim high availability or multi-region delivery.

Railway references:

- [Config as code](https://docs.railway.com/config-as-code)
- [Volumes](https://docs.railway.com/volumes)
- [Health checks](https://docs.railway.com/deployments/healthchecks)
- [Service variables](https://docs.railway.com/variables)

## Public smoke test

1. Confirm `/api/health` is HTTPS and returns HTTP 200.
2. Confirm `/api/release/preflight` passes with the configured contract.
3. Load `/`, `/issuer`, `/professional`, `/verifier`, and an invite route directly.
4. Create an account and recover the session after refresh.
5. Redeem one invitation and deliver/decrypt one credential envelope.
6. Confirm notification polling and receipt monitoring survive refresh.
7. Detect 1AM from the hosted origin and verify Preprod/proving readiness.
8. Restart or redeploy once and confirm the profile/delivery records remain.
9. Inspect served JavaScript/source maps for LocalNet endpoints and secrets.
