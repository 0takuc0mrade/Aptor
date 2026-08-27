# Exact three-minute demonstration

This route uses real fixtures and application state. No result, finding, or runtime event is pre-generated.

## Before the clock

```bash
npm run setup
CORDON_SUBMISSION_MODE=true npm run dev
```

Open `http://localhost:3000`. Setup has already built and verified the Cordon image, so the presentation requires no Docker commands.

## 0:00–0:35 — one entry point

1. Point out the single **Inspect a repository** workbench and the recent-inspection resume list.
2. Select **Inspect suspicious demo repository**.
3. Cordon navigates directly to its report and shows real stages: fetch, archive safety, package scripts, sensitive behaviour, risk report, and quarantine preparation.

## 0:35–1:10 — static decision

1. Read the top decision, not the raw findings first.
2. Show the detected `postinstall`, child-process, sensitive-path, and network surfaces.
3. Point out the one recommended action: **Run in quarantine**.
4. Expand **Execution details** briefly: deterministic install argv, fixed limits, Cordon image, and disabled network. Collapse it again.

## 1:10–2:05 — deliberate runtime observation

1. Select **Start quarantine run** once.
2. Follow the real runtime stages without leaving the report.
3. Watch concise activity rows record the install process, child process, seeded SSH-key access, outbound attempt, blocked policy decision, cleanup, and combined-report build.
4. Refresh once if useful: Cordon reconnects to the stored active/latest attempt rather than starting another container.

## 2:05–2:40 — one combined report

1. Read the **Critical risk** decision and **Do not run this repository on your primary machine** guidance.
2. Open the most important attack path: static lifecycle entry → observed child process → observed SSH canary read → blocked connection.
3. Point out evidence labels: statically detected, observed at runtime, blocked by policy, and correlated.
4. Show static findings, runtime findings, and the expandable complete timeline as parts of the same report.

## 2:40–3:00 — portable evidence and normal comparison

1. Select **Download JSON receipt**, then **Copy text summary**.
2. Return to the dashboard and select **Inspect normal demo repository**.
3. State the expected contrast: the same pipeline completes with low observed risk and no manufactured critical finding.
4. Close on the boundary shown in the report: absence of suspicious observations is not proof of safety.
