# Cordon architecture

## Boundaries

```text
Dashboard / combined report UI
        │ scan IDs, plan choices, public execution plan
Next.js route handlers
        ├── ScanJobExecutor
        └── QuarantineWorker
Direct local workers (two queue seams)
        │
GitHub ingestion ── temporary repository root
        ├── Modular scanner rules ── static scoring / paths
        └── commit re-materialization ── QuarantineRunner ── Docker adapter
                                             │
                                  telemetry / canaries / verdict
                                             │
                              combined attack-path correlation
                                             │
                                  Prisma repository / memory
```

The scanner under `lib/scanner` has no frontend or Next.js dependency. It accepts a filesystem root plus repository metadata and returns one `ScanResult`. Each rule implements `ScannerRule`, consumes normalized `SourceFile` values, and emits shared `Finding` values.

## Request flow

`POST /api/scans` validates the URL, delegates to `ScanJobExecutor`, downloads and extracts a commit-pinned archive, scans it, persists the result, and returns it. The current direct executor deliberately matches the future queue contract; replacing it with a producer does not require scanner or UI changes.

`GET /api/scans` lists recent reports. `GET /api/scans/:id` and `/reports/:id` retrieve one result. PostgreSQL is authoritative when configured. The memory fallback exists only to keep local evaluation possible without a database.

Quarantine planning re-downloads the exact scanned commit and parses only root npm-compatible metadata. The persisted plan stores a worker-managed locator. The public plan omits that locator and every canary marker. Starting a plan claims one unique run record before scheduling work, so repeated browser requests do not launch duplicate containers.

The local worker re-materializes the same commit, replaces the locator with a temporary server-owned path, invokes `QuarantineRunner`, persists events/findings/results, builds the combined report, and cleans the archive root. API routes never build Docker commands.

## Data model

- `Repository`: normalized owner, name, URL, and default branch.
- `Scan`: commit, timestamps, status, file/rule counts, totals, score, verdict, attack paths, and the canonical serialized result.
- `Finding`: normalized rule output for indexing and future querying.
- `QuarantinePlan`: exact command array, package manager, lifecycle preview, network policy, limits, and fake canary definitions.
- `QuarantineRun`: status, termination reason, bounded result, container metadata, network policy, and optional explanation.
- `RuntimeEvent` and `RuntimeFinding`: normalized observed evidence.
- `RuntimeAttackPathNode` and `RuntimeAttackPathEdge`: evidence-labeled combined graph material.

## Extension points

- Add a rule by implementing `ScannerRule` and registering it in `DEFAULT_RULES`.
- Add AST parsing behind `lib/scanner/parsers` without changing the finding contract.
- Replace `DirectScanJobExecutor` with a queue producer/worker implementation.
- Replace `DirectQuarantineWorker` without changing `QuarantineRunner`.
- Add a stronger runtime adapter behind `QuarantineRunner` without changing planning or report contracts.
- Add new persistence queries without coupling them to scanner execution.
