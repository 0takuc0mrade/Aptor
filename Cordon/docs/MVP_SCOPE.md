# MVP scope

## Included

- One dashboard action for public GitHub repository roots.
- Immediate navigation to a restorable, real backend-driven inspection.
- Safe, bounded, commit-pinned archive ingestion.
- Deterministic JavaScript/TypeScript lifecycle, process, sensitive-access, network, and obfuscation rules.
- Transparent scoring, static decisions, and labeled attack-path reasoning.
- Automatic deterministic runtime planning for Node packages.
- A repository-owned, pinned, labeled, non-root Cordon Docker image with automatic readiness/bootstrap.
- One-click disposable quarantine with fixed policy, canaries, bounded telemetry, cleanup, attempts, retries, and state restoration.
- One combined report with plain-language decision, static/runtime evidence, timeline, policy, metadata, concrete guidance, JSON receipt, and copyable summary.
- Optional PostgreSQL persistence with explicit in-memory fallback.
- Submission-only real normal/suspicious fixture flows and reset.
- Automated scanner, planning, policy, telemetry, persistence, redaction, fallback, and end-to-end tests.

## Explicitly excluded

- Durable distributed queues and remote worker hosts.
- MicroVMs and Kubernetes.
- Authentication, teams, billing, private repositories, and GitHub Apps.
- Browser extensions.
- Arbitrary commands, repository Dockerfiles, arbitrary-language execution, and host mounts.
- Full AST/control-flow/taint analysis.
- Dependency-advisory aggregation and reputation services.
- Automated code repair.
- AI-generated findings or decisions.

## Definition of done

A user can paste a public repository URL and remain inside Cordon through static inspection, a deterministic security decision, automatic runtime recommendation, deliberate quarantine, live structured observation, one combined report, and portable receipt. Repeated clicks remain idempotent, refresh restores state, failure preserves completed evidence, and demonstrations exercise real fixtures and the real pipeline.

The product exposes decisions and evidence rather than Docker, IDs, workers, database records, or API mechanics. No completed report calls a repository “safe.”
