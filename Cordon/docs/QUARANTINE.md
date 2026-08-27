# Disposable quarantine

## User-facing flow

Cordon creates and stores a deterministic execution plan automatically after static inspection. The user sees its purpose and consequences, confirms one deliberate run, then remains on the same report while Cordon prepares, executes, observes, cleans up, and combines evidence.

Priority is fixed:

1. suspicious lifecycle script;
2. installation lifecycle;
3. a supported existing script (`test`, `check`, `lint`, `build`, then `start`);
4. Cordon’s fixed metadata probe;
5. no supported action, with the static report preserved.

Package manager detection uses one compatible lockfile or `packageManager` declaration. Conflicting declarations are refused. The browser never accepts arbitrary commands. Exact argv and limits live under **Execution details**, not in the primary interface.

## Controlled image and bootstrap

[`docker/quarantine.Dockerfile`](../docker/quarantine.Dockerfile) builds `cordon-quarantine:0.1.0` from pinned `node:22.17.1-bookworm-slim`. The image carries `io.cordon.runtime.version=0.1.0`, runs as UID/GID 1000, and contains only the base Node tools plus Cordon’s entrypoint.

Automatic bootstrap:

1. checks the Docker server;
2. inspects the exact stable image tag;
3. verifies the expected Cordon label;
4. starts one bounded build when the image is missing;
5. verifies again before reporting ready.

Build failure is remembered and is retried only through an explicit readiness retry or setup. Ordinary users see ready, preparing, or unavailable—not raw Docker output. Static findings remain visible in every state.

## Isolation policy

Every attempt uses a fresh container and a worker-managed copy of the exact scanned commit. Cordon never trusts repository Dockerfiles or bind-mounts the repository. It omits the host project, home directory, Docker socket, application environment file, host PID/IPC namespaces, privileged mode, and host networking.

The adapter applies:

- non-root UID/GID `1000:1000`;
- all Linux capabilities dropped;
- `no-new-privileges`;
- fixed memory, CPU, PID, output, and timeout limits;
- bounded `noexec,nosuid,nodev` temporary storage;
- fake credential canaries only;
- network disabled by default;
- forced container removal and temporary-copy deletion in `finally` handling.

Install mode may use the disposable writable container layer for dependencies. Script and probe modes use the strictest supported read-only policy.

## Network policy

`disabled` maps to Docker `--network none`. It is the default and records supported connection attempts as blocked.

`allowlist` is install-only and requires an operator-enforced Docker network plus registry proxy. `CORDON_QUARANTINE_ALLOWLIST_ENFORCED=1` is an operator assertion, not evidence inferred from Docker. Cordon refuses a partial configuration and never promotes repository URLs into policy.

## Runs, retries, and recovery

Repeated starts return the active/latest run for the stored plan and do not launch another container. A deliberate retry is allowed only after failure, creates a new attempt, and preserves previous attempts. Refresh restores progress, events, results, and the latest attempt. A database-hydrated queued/running record after an application restart is marked interrupted; static findings remain and retry starts a new disposable container.

When `DATABASE_URL` is absent or a configured database operation fails, current state remains in process memory. That fallback is usable but not durable across process restart.

Developer verification commands remain available, but the product flow never requires them:

```bash
npm run quarantine:verify
npm run quarantine:smoke -- normal
npm run quarantine:smoke -- suspicious
npm run quarantine:smoke -- timeout
```
