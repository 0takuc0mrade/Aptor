# Seamless inspection flow

## State model

```text
submission
  → queued inspection
  → real static stages
  → static decision + stored automatic plan
  → runtime readiness
  → deliberate quarantine attempt
  → real runtime stages/events
  → stored combined report + receipt
```

The dashboard sends one client-generated submission key with the URL. Repeated clicks reuse that key; the server returns the existing inspection. It immediately navigates to `/reports/:id`, whose polling reads stored stage state instead of simulating time.

Static stages are fetch, archive safety, package-script mapping, sensitive-behaviour scan, risk-report build, and quarantine-option preparation. A partially completed scan can be revisited. Failures state what stopped, what remains, and whether a new inspection is possible.

After scanning, Cordon stores the safest supported deterministic plan. The decision panel gives severity, rationale, and one next action. Unsupported Node package configuration leaves the complete static report intact.

Opening quarantine triggers image readiness automatically. One user confirmation claims an attempt; repeated starts reuse it. Runtime stages and important events are stored as they arrive. Refresh reads the active record. A failed attempt preserves static evidence and can be retried as a separate attempt with a new container.

Completion changes the page hierarchy to one report: verdict, summary, attack path, action, static evidence, runtime evidence, timeline, policy, metadata, attempt history, and limitation. JSON/text exports are generated server-side from redacted stored evidence.

## Failure contract

Every product failure should answer:

1. What failed?
2. What evidence remains available?
3. Is retry supported?
4. Will retry start a new disposable container?

Docker/image failure never hides static evidence. Runtime timeout and output-limit failures preserve bounded events and cleanup metadata. A restarted process marks database-restored active attempts interrupted and requires an intentional new attempt. Database failure degrades to explicitly non-durable process memory.

## Product boundaries

Users never choose an arbitrary command or package manager, supply a scan ID, manage a worker, or run Docker preparation commands. Technical argv, image, and limits remain available through progressive disclosure for expert review.
