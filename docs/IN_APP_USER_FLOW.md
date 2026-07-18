# In-app user flow

## One profile, three workspaces

An Aptor profile has one public handle and one encrypted local account vault.
It can act as Professional, Issuer, and Verifier. The header role switcher
changes the workspace, not the signed-in profile. Wallet approval is requested
only for Verifier registration and Professional proof submission.

## Professional invites an Issuer

1. Unlock or create the Aptor profile in `/professional`.
2. Select **Create Issuer invite**.
3. Copy the single-use link. It contains an invitation capability, never the
   account access capability or holder secret.
4. The link expires after seven days.
5. The Issuer sees who invited them and the limits of Aptor verification.
6. The Issuer creates or unlocks a profile and accepts once.
7. The raw invitation token is replaced out of browser history after success.

Invalid, expired, and already-used invitations have different states. Aptor
uses “Signature verified” and “Credential issued by this Aptor profile”; it
does not claim “Verified employer.”

## Issuer signs and delivers

1. Open `/issuer` and select an accepted Professional invitation.
2. Review the public holder profile and recipient handle.
3. Enter bounded skills, duration, production, and rating facts.
4. Review the complete private credential.
5. Sign with the Issuer key inside the encrypted account vault.
6. Encrypt the signed credential to the Professional public encryption key.
7. Send the ciphertext envelope.
8. See **Credential encrypted for recipient. Delivered to Professional
   inbox.**

No file, transfer passphrase, or manual forwarding is required.

## Professional accepts a credential

1. The shared inbox shows an encrypted credential without private preview
   fields.
2. Select **Verify and save** after unlocking the profile.
3. Aptor decrypts locally and verifies envelope integrity, schema, Issuer
   signature, and holder binding.
4. The credential enters the encrypted local vault.
5. The server records only that the envelope was received.

## Verifier creates and sends a request

1. Unlock `/verifier`.
2. Add trusted Issuer Aptor profiles by handle.
3. Select the Professional by handle.
4. Define the existing structured requirements and review public criteria.
5. Connect a LocalNet testkit wallet.
6. Approve registration and wait for finalization.
7. Aptor encrypts and sends the validated registered request package.
8. The active-request dashboard starts at **Registered — awaiting proof**.

## Professional proves

1. Select **Review request** in the inbox.
2. Aptor decrypts the package and checks registered Midnight state.
3. Local vault matching shows **Compatible credentials: N**. The list and
   count never reach the server.
4. Select one credential and review the public/private disclosure boundary.
5. Connect the LocalNet wallet and approve proof submission.
6. Aptor creates the real request-bound proof, submits it, waits for
   finalization, clears ephemeral witness state, and reports the public
   transaction ID to request tracking.

## Verifier monitors

The active dashboard moves through registered, proof submitted, and fulfilled.
It polls the existing Midnight public-query boundary with exponential backoff,
stops automatic polling after ten minutes, refreshes on window focus, and
offers manual retry. Cached delivery status improves UX but never overrides
contract state.

## Portability fallback

Advanced panels preserve encrypted account backup, holder profile export,
Issuer profile import/export, transfer-passphrase credential files, and
registered request package export/import. They are interoperable fallbacks,
not the primary onboarding journey.
