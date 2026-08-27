# Submission checklist

## Product journey

- [ ] Dashboard has one dominant **Inspect a repository** action.
- [ ] Invalid URL remains in the field with inline guidance.
- [ ] Successful submit opens its report automatically and repeated clicks remain idempotent.
- [ ] All six static stages reflect stored backend state and survive refresh.
- [ ] Static decision explains severity, quarantine rationale, and concrete next action.
- [ ] Automatic plan is deterministic, validated, stored, and human-readable.
- [ ] Docker readiness is automatic; static findings survive unavailable/build-failed states.
- [ ] One confirmation starts quarantine; duplicate starts reuse the same attempt.
- [ ] Runtime stages/events are live, structured, bounded, and restorable.
- [ ] Failed runs explain recovery and intentional retry creates a preserved new attempt.
- [ ] Final report combines verdict, guidance, attack path, static/runtime findings, timeline, policy, metadata, attempts, and limitations.
- [ ] Receipt downloads as redacted JSON and text summary copies without internal IDs.

## Demonstrations

- [ ] `CORDON_SUBMISSION_MODE=true` exposes both clearly labeled repositories and reset.
- [ ] Normal demo traverses the real pipeline and has no false critical finding.
- [ ] Suspicious demo traverses `postinstall → child → SSH canary → external attempt → blocked → critical`.
- [ ] No fixture finding or event is hardcoded into production UI/report state.
- [ ] Three-minute route in `docs/DEMO_FLOW.md` completes without terminal/Docker steps after setup.

## Security and recovery

- [ ] Exact scanned commit is rematerialized before runtime.
- [ ] Pinned/labeled Cordon image is verified; repository Dockerfiles are ignored.
- [ ] Non-root, dropped capabilities, no host mount/socket/network, fixed limits, fake canaries, cleanup.
- [ ] Invalid/private/not-found/oversized/archive/unsupported/Docker/image/timeout/worker/restart/database/duplicate conditions preserve the strongest completed evidence.
- [ ] Low-risk and inconclusive language retains explicit uncertainty.

## Release verification

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run setup
```

- [ ] Dashboard returns HTTP 200.
- [ ] GitHub scan API validates invalid and accepts supported public URLs.
- [ ] Normal and suspicious demo API/UI flows complete.
- [ ] Docker-unavailable and timeout recovery are verified.
- [ ] Refresh restoration and duplicate-run prevention are verified.
- [ ] JSON receipt headers/body and copyable summary are verified.
- [ ] Hallmark final detector and responsive visual review pass.
