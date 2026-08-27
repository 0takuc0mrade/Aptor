# Cordon

> Inspect unknown code before it reaches your machine.

Cordon is an evidence-first security product for unfamiliar public GitHub repositories. Paste a repository URL, follow real inspection progress, review Cordon’s static decision, approve its automatically selected quarantine action, and receive one combined static/runtime report.

The product does not ask users to operate Docker, select package managers, enter commands, copy scan IDs, or run worker scripts. Static inspection never executes repository code. Quarantine is a separate, deliberate action inside a disposable, non-root Docker container built from Cordon’s own pinned image—not from a repository Dockerfile.

## Product flow

```text
Paste a public GitHub URL
→ inspect the exact commit
→ receive a static decision and automatic recommendation
→ approve one quarantine run
→ follow structured runtime progress
→ review one evidence-backed report and receipt
```

Cordon labels evidence as statically detected, observed at runtime, blocked by policy, correlated, inferred, or inconclusive. A low-risk result is never presented as proof of safety.

## Local setup

Requirements: Node.js 22+, npm, and Docker Engine for runtime quarantine. PostgreSQL is optional.

```bash
npm run setup
npm run dev
```

Open `http://localhost:3000`. `npm run setup` validates or installs dependencies, generates Prisma, applies configured migrations, builds the pinned `cordon-quarantine:0.1.0` image when needed, verifies its Cordon label, and prints a clear readiness summary. If Docker is unavailable, static inspection still works and setup reports quarantine as unavailable.

Copy `.env.example` to `.env` only when configuration is needed. Without `DATABASE_URL`, Cordon uses process memory and state is lost on application restart. `GITHUB_TOKEN` is optional and only raises GitHub API limits.

For the built-in demonstration repositories:

```bash
CORDON_SUBMISSION_MODE=true npm run dev
```

Submission mode exposes normal/suspicious fixture actions and an intentional fixture-state reset. It does not weaken isolation or inject findings/events; both demonstrations use the same scanner, planner, quarantine, telemetry, persistence, and report pipeline as normal submissions.

## Runtime policy

The controlled image uses pinned `node:22.17.1-bookworm-slim`, UID/GID 1000, no host mounts, no Docker socket, dropped capabilities, `no-new-privileges`, fixed CPU/memory/PID/output/time limits, disposable fake credentials, and network disabled by default. Repository Dockerfiles are ignored.

Registry-only installation is available only when an operator independently configures and enforces all of:

```bash
CORDON_QUARANTINE_NETWORK=cordon-registry
CORDON_REGISTRY_PROXY_URL=http://registry-proxy:8080
CORDON_QUARANTINE_ALLOWLIST_ENFORCED=1
CORDON_REGISTRY_ALLOWLIST=registry.npmjs.org
```

Plain Docker cannot prove hostname enforcement, so Cordon refuses allowlist mode without that operator assertion. Static URLs never become allowlist entries.

## Quality commands

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run setup
```

Developer-only diagnostics remain available as `npm run quarantine:verify` and `npm run quarantine:smoke -- <scenario>`. They are not part of the user journey.

## Current boundaries

- Public GitHub repository roots only; no private-repository credentials.
- JavaScript/TypeScript and Node package execution only.
- Deterministic heuristic rules, not full AST/control-flow/taint analysis.
- No dependency-advisory aggregation or package-reputation service.
- Direct in-process jobs, not a durable distributed queue.
- Process-memory fallback is intentionally non-durable.
- Docker reduces exposure but is not a perfect security boundary; native binaries and instrumentation bypasses can evade Node preload telemetry.
- Runtime evidence covers one selected operation under one policy and environment.
- A low-risk result is not a safety guarantee.

See [Seamless flow](docs/SEAMLESS_FLOW.md), [three-minute demo](docs/DEMO_FLOW.md), [quarantine](docs/QUARANTINE.md), [runtime security](docs/RUNTIME_SECURITY.md), [submission checklist](docs/SUBMISSION_CHECKLIST.md), and [MVP scope](docs/MVP_SCOPE.md).

## Next milestone after submission

Harden the current single-host product for a controlled pilot: durable job ownership and restart recovery, stronger isolation evaluation, independently verified egress, retention controls, and operational observability. Authentication, private repositories, Kubernetes, billing, arbitrary commands/languages, advisory aggregation, and automated repair remain separate future decisions.
