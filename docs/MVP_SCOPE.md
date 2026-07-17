# MVP scope

## Required MVP

- One application with Issuer, Professional, and Verifier roles.
- A bounded `WorkCredential` with the fields defined in `@aptor/shared`.
- A real issuer authorization over an unmodified credential or credential commitment.
- Local private credential storage for the professional.
- A bounded `ProofRequest` supporting skill, duration, production delivery, and minimum rating.
- Accepted-issuer verification.
- Holder binding and expiry verification.
- A real Compact proof that selectively discloses only requested pass/fail results.
- A valid-credential success path.
- A deterministic altered-credential failure test.
- Clear separation of local pre-checks, proof generation, and verified results.
- A repeatable local development flow and submission documentation.

## Stretch goals

- Multiple credentials and a privacy-preserving local match recommendation.
- Credential revocation or status lists.
- Single-use requests with nullifiers and explicit expiry.
- QR or deep-link request handoff.
- Encrypted credential export and recovery.
- Issuer organizations with delegated signing keys.
- Public testnet deployment after the local flow is stable.
- Shareable verifier receipts that reveal no additional credential data.

## Explicitly out of scope

- Proving that an issuer's claim is truthful.
- Arbitrary natural-language policy parsing in Compact.
- Publishing raw credentials or private fields to ledger state.
- Revealing the previous client, project, repository, exact rating, or internal metrics.
- Production company-domain verification or full issuer onboarding.
- A marketplace, token, payments, reputation score, or public professional profile.
- Three separate frontend applications.
- Fake analytics, fictional results, or invented blockchain transaction hashes.
- A production-grade recovery, key rotation, or revocation service in the hackathon MVP.
