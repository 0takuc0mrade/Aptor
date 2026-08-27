# Aptor HSK three-minute demo script

Use the hosted in-platform flow and a completed real HSK testnet scenario once
the organizer-assisted deployment is finalized. Until then, use the validated
Anvil rehearsal and label it clearly as local. Do not show file import/export,
repeat transactions, or substitute transaction IDs.

## 0:00–0:25 — The confidential-work problem

“A professional's strongest work is often confidential. Aptor lets that work
speak without revealing the client, repository, project, or exact private
values.” Show the Professional workspace and privacy boundary.

## 0:25–0:50 — Invite the previous client

Create an Issuer invitation from the Professional profile. Open the public
invite URL in the isolated Issuer profile and redeem it.

## 0:50–1:20 — Register and privately deliver a credential

Enter one skill, experience duration, production flag, and rating. Connect the
Issuer's HSK wallet and register only the Poseidon credential commitment. Aptor
then encrypts the credential and secret to the Professional. Switch to the
Professional inbox, decrypt, validate, and accept it. State that the server
routed ciphertext and metadata—not credential plaintext or the witness.

## 1:20–1:50 — Register a requirement

In the isolated Verifier profile, select the Professional and accepted Issuer,
define the skill/duration/production/rating threshold, connect the HSK wallet,
and show the already finalized registration receipt. Send the registered
request through Aptor.

## 1:50–2:30 — Prove privately

Open the request in the Professional inbox. Show the local compatible-credential
match and disclosure review. Connect the HSK wallet and show Aptor generating a
real Groth16 proof from the WASM and proving key in the browser. For the live
stage, keep a previously completed receipt ready in another tab in case proving
takes longer than expected.

## 2:30–3:00 — Verify the receipt

Return to the Verifier. Show **Request fulfilled**, the HSK transaction and
contract receipt, and the absence of credential files, exact work values, or
the credential secret. Close with the reusable issuer registry, request
contract, and browser proof flow—not merely content placed onchain.

End card: **Aptor — Prove the work. Protect the details.**
