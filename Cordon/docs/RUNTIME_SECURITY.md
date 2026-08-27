# Runtime security and telemetry

## Canary semantics

Each plan creates unique, unmistakably fake markers for dotenv, SSH, npm, GitHub, cloud, wallet, browser-session, and generic API credentials. They include `CORDON_FAKE_CANARY` and `INVALID`, cannot authenticate to real services, and replace their target paths only inside disposable storage.

Markers are never returned to the browser or receipt. Cordon redacts marker values and worker-managed host paths before persistence/export.

Cordon distinguishes:

- **accessed:** an instrumented read targeted a seeded path;
- **copied:** a marker reached a supported file write/copy;
- **prepared for transmission:** a marker entered supported request/socket/process data;
- **transmission attempted:** supported telemetry observed a request or connection;
- **transmission observed:** reserved for evidence of allowed successful transmission; the default no-network run does not claim this.

## Structured observation

Cordon injects a bounded Node preload observer into the selected npm-compatible process and supported descendant Node processes. It records structured process, filesystem, canary, network, output, policy, and exit events. Docker supplies exit, timeout/output termination, image, and cleanup results.

Live UI rows are evidence views, not a terminal. Each event is bounded, IDs are deduplicated, output is capped/redacted, and only the latest bounded event set is retained during progress. Runtime findings preserve useful process, command, file, destination, outcome, and source-event fields.

Child process creation alone is low or medium review context; it is not automatically critical. Critical combined risk requires stronger evidence such as a sensitive canary access/propagation, with correlated paths clearly separated from direct observation.

## Evidence language

- **Statically detected:** source evidence from the exact downloaded commit.
- **Observed at runtime:** supported telemetry recorded the event during this attempt.
- **Blocked by policy:** the selected isolation policy prevented or terminated the action.
- **Correlated:** evidence shares the commit/plan/run context; causality is not asserted.
- **Inferred:** a bounded conclusion from evidence, labeled as such.
- **Inconclusive:** observation could not establish a supported outcome.

## Known gaps

- Native binaries, direct syscalls, custom runtimes, workers that remove `NODE_OPTIONS`, and deliberate instrumentation bypasses can be incomplete or invisible.
- Parent/child and network attribution is available only where the observer has reliable values.
- `--network none` establishes the selected Docker policy; it does not make every attempted hostname observable.
- Install mode needs a disposable writable layer.
- Output and event bounds can omit evidence after forced termination.
- Docker is defense in depth, not a perfect security boundary.
- One run covers only one selected operation and set of conditions.
- No suspicious event is not proof of no suspicious behavior.
