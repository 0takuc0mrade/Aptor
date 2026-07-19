# Aptor submission checklist

Unchecked items are required; do not convert them to claims without direct
evidence.

## Release authority

- [x] User approves one contract deployment in 1AM.
- [x] Deployment finalizes and the Preprod indexer reads the contract.
- [x] Evidence JSON is copied into `PREPROD_EVIDENCE.md`.
- [x] Contract address is configured and the app is rebuilt.
- [ ] User connects Railway, attaches the volume, and approves any usage cost.
- [ ] Public HTTPS URL and HTTP-200 health check are recorded.

## Real scenario

- [ ] Three isolated browser profiles are used.
- [ ] Professional invitation and Issuer redemption work publicly.
- [ ] Credential is signed, encrypted, routed, decrypted and accepted.
- [ ] One request is registered with real 1AM approval.
- [ ] One compatible private proof is generated and finalized.
- [ ] Verifier automatically observes **Request fulfilled**.
- [ ] Direct contract query agrees with the UI.
- [ ] Transaction IDs, request ID, commitments, heights and explorer links are recorded.

## Privacy and resilience

- [ ] Production SQLite is on `/data` and survives restart/redeploy.
- [ ] Database, logs and API bodies contain no credential plaintext or secrets.
- [ ] Network captures, IndexedDB, localStorage and URL history are inspected.
- [ ] Registration/fulfillment transactions and decoded state reveal only intended public data.
- [ ] Desktop and mobile layouts pass on all role pages and invite/release flows.

## Quality gates

- [x] Database migration
- [x] Delivery/API tests
- [x] Browser cryptography/provider tests
- [x] Compact simulator tests
- [x] Provider-backed LocalNet regression
- [x] Playwright LocalNet workflow
- [x] TypeScript and ESLint
- [x] Prettier
- [x] Security scan
- [x] Production npm audit
- [x] Next.js production build
- [ ] Public direct-route and recovery smoke tests

## Submission assets

- [ ] README live URL, contract, explorer and demo fields replace `Pending`.
- [ ] Architecture/privacy statements match observed behavior.
- [ ] Screenshots show real states and redact no required public evidence.
- [ ] Two-minute demo follows `DEMO_SCRIPT.md`.
- [ ] Local commit is exactly `feat: release Aptor on Midnight Preprod`.
- [ ] No push occurs until the user provides/approves a repository destination.

Only after all release items pass: publish the repository, record the final
two-minute demo, complete the Devpost submission and run one final submission
smoke test.
