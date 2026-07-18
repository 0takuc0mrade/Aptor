"use client";

import {
  downloadPortableFile,
  encryptCredentialPackage,
  encryptEnvelopePayload,
  issueCredential,
  parseHolderFile,
  serializePortableFile,
  type AptorHolderProfileV1,
} from "@aptor/browser";
import type { AptorProfileV1 } from "@aptor/shared";
import { useEffect, useMemo, useState } from "react";

import {
  listInvitations,
  sendEnvelope,
  type AptorInvitationView,
} from "@/lib/delivery-client";

import { AccountToolbar, ProfileAccess } from "./profile-access";
import { useAptorAccount } from "./account-provider";
import { FileField } from "./file-field";
import { RoleWorkspace, WorkflowSequence } from "./role-placeholder";

type CredentialDraft = Readonly<{
  skills: string[];
  durationMonths: number;
  deliveredToProduction: boolean;
  clientRatingHundredths: number;
}>;

export function IssuerWorkspace() {
  const account = useAptorAccount();
  const [portableHolder, setPortableHolder] =
    useState<AptorHolderProfileV1 | null>(null);
  const [invitations, setInvitations] = useState<AptorInvitationView[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [draft, setDraft] = useState<CredentialDraft | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const acceptedInvitations = useMemo(
    () => invitations.filter((invitation) => invitation.state === "redeemed"),
    [invitations],
  );
  const recipient = useMemo(
    () =>
      acceptedInvitations.find(
        (invitation) => invitation.creator?.profileId === selectedProfileId,
      )?.creator ?? null,
    [acceptedInvitations, selectedProfileId],
  );

  useEffect(() => {
    if (account.value === null) return;
    const timeout = window.setTimeout(() => {
      void listInvitations(
        account.value!.privateProfile.accessToken,
        "received",
      )
        .then((items) => {
          setInvitations(items);
          setSelectedProfileId(
            (current) => current || items[0]?.creator?.profileId || "",
          );
        })
        .catch((requestError: unknown) => {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Invitations could not be loaded.",
          );
        });
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [account.value]);

  const createCredential = (
    professional: AptorProfileV1,
    credentialDraft: CredentialDraft,
  ) =>
    issueCredential(account.value!.issuer, {
      holderProfile: professional.holderProfile,
      ...credentialDraft,
    });

  return (
    <RoleWorkspace
      description="Review accepted invitations, attest to bounded work facts, and send a signed credential directly to the Professional's encrypted inbox."
      headline="Issue work without exposing it."
      privacyDetail="Aptor signs locally, encrypts to the recipient's public key with a fresh ephemeral key, and routes only ciphertext. Credential facts never reach the delivery service."
      privacyStages={["Work facts", "Local signature", "Encrypted delivery"]}
      privacySummary="Credential details remain between Issuer and Professional."
      role="Issuer"
      status={
        account.value
          ? `${acceptedInvitations.length} accepted invitation${acceptedInvitations.length === 1 ? "" : "s"} · ${account.value.issuer.issuanceHistory.length} issued`
          : "Unlock the shared Aptor profile to review invitations."
      }
    >
      {account.value === null ? (
        <ProfileAccess />
      ) : (
        <>
          <section
            className="issuer-flow"
            aria-labelledby="issuer-invitations-title"
          >
            <header className="section-heading">
              <div>
                <h2 id="issuer-invitations-title">Review invitations</h2>
                <p>
                  Choose the Professional who asked this Aptor profile to issue
                  a credential.
                </p>
              </div>
              <span className="section-heading__state">
                @{account.value.profile.handle}
              </span>
            </header>

            {acceptedInvitations.length === 0 ? (
              <div className="empty-state">
                <span aria-hidden="true" className="empty-state__mark">
                  —
                </span>
                <div>
                  <h3>No accepted invitation yet</h3>
                  <p>
                    Open a Professional’s Aptor invite link and accept it with
                    this profile.
                  </p>
                </div>
              </div>
            ) : (
              <div
                className="selection-list"
                role="radiogroup"
                aria-label="Select Professional invitation"
              >
                {acceptedInvitations.map((invitation) => (
                  <label key={invitation.invitationId}>
                    <input
                      checked={
                        selectedProfileId === invitation.creator?.profileId
                      }
                      name="recipient"
                      onChange={() =>
                        setSelectedProfileId(
                          invitation.creator?.profileId ?? "",
                        )
                      }
                      type="radio"
                    />
                    <span>
                      <strong>{invitation.creator?.displayName}</strong>
                      <small>
                        @{invitation.creator?.handle} · requested a private work
                        credential
                      </small>
                    </span>
                  </label>
                ))}
              </div>
            )}

            <p className="privacy-note">
              Signature verified means this Aptor profile signed the credential.
              Aptor does not verify the profile’s legal business identity.
            </p>
            <AccountToolbar />
          </section>

          <section
            className="issuer-review"
            aria-labelledby="credential-create-title"
          >
            <header className="section-heading section-heading--compact">
              <div>
                <h2 id="credential-create-title">Issue credential</h2>
                <p>
                  {recipient
                    ? `Encrypted for ${recipient.displayName} (@${recipient.handle}).`
                    : portableHolder
                      ? "Portable holder profile loaded. Export will require a transfer passphrase."
                      : "Select an accepted invitation or import a portable holder profile."}
                </p>
              </div>
            </header>

            <form
              className="form-stack"
              onSubmit={(event) => {
                event.preventDefault();
                setError("");
                setSuccess("");
                if (recipient === null && portableHolder === null) {
                  setError(
                    "Select an accepted invitation or import a portable holder profile first.",
                  );
                  return;
                }
                const data = new FormData(event.currentTarget);
                const skills = String(data.get("skills") ?? "")
                  .split(/[,\n]/u)
                  .map((skill) => skill.trim())
                  .filter(Boolean);
                if (skills.length === 0) {
                  setError("Enter at least one skill.");
                  return;
                }
                setDraft({
                  skills,
                  durationMonths: Number(data.get("durationMonths")),
                  deliveredToProduction: data.get("production") === "on",
                  clientRatingHundredths: Math.round(
                    Number(data.get("rating")) * 100,
                  ),
                });
              }}
            >
              <label className="field">
                <span>Skills</span>
                <textarea
                  name="skills"
                  placeholder="React, accessibility, TypeScript"
                  required
                  rows={3}
                />
                <small>Separate skills with commas or new lines.</small>
              </label>
              <div className="form-grid">
                <label className="field">
                  <span>Duration in months</span>
                  <input
                    inputMode="numeric"
                    max={65_535}
                    min={0}
                    name="durationMonths"
                    required
                    step={1}
                    type="number"
                  />
                </label>
                <label className="field">
                  <span>Client rating</span>
                  <input
                    inputMode="decimal"
                    max={5}
                    min={0}
                    name="rating"
                    required
                    step={0.01}
                    type="number"
                  />
                  <small>0.00 to 5.00</small>
                </label>
              </div>
              <label className="check-field">
                <input name="production" type="checkbox" />
                <span>Delivered to production</span>
              </label>
              <button
                className="action-button"
                disabled={recipient === null && portableHolder === null}
                type="submit"
              >
                Review credential
              </button>
            </form>

            {draft !== null &&
            (recipient !== null || portableHolder !== null) ? (
              <div className="review-sheet" aria-live="polite">
                <p className="eyebrow">Signing review</p>
                <h3>Confirm the complete private credential</h3>
                <dl>
                  <div>
                    <dt>Professional</dt>
                    <dd>
                      {recipient
                        ? `${recipient.displayName} · @${recipient.handle}`
                        : "Portable holder profile"}
                    </dd>
                  </div>
                  <div>
                    <dt>Skills</dt>
                    <dd>{draft.skills.join(", ")}</dd>
                  </div>
                  <div>
                    <dt>Duration</dt>
                    <dd>{draft.durationMonths} months</dd>
                  </div>
                  <div>
                    <dt>Production</dt>
                    <dd>{draft.deliveredToProduction ? "Yes" : "No"}</dd>
                  </div>
                  <div>
                    <dt>Rating</dt>
                    <dd>
                      {(draft.clientRatingHundredths / 100).toFixed(2)} / 5.00
                    </dd>
                  </div>
                </dl>
                {recipient ? (
                  <button
                    className="action-button"
                    disabled={account.busy}
                    onClick={() => {
                      setError("");
                      setSuccess("");
                      void (async () => {
                        const credential = createCredential(recipient, draft);
                        const envelope = await encryptEnvelopePayload(
                          credential,
                          account.value!.profile.profileId,
                          recipient.profileId,
                          "work_credential",
                          recipient.publicEncryptionKey,
                        );
                        await sendEnvelope(
                          account.value!.privateProfile.accessToken,
                          envelope,
                        );
                        await account.save({
                          ...account.value!,
                          issuer: {
                            ...account.value!.issuer,
                            issuanceHistory: [
                              ...account.value!.issuer.issuanceHistory,
                              {
                                credentialId:
                                  credential.credential.credentialId,
                                holderProfileId: credential.holderProfileId,
                                issuedAt: credential.issuedAt,
                              },
                            ],
                          },
                        });
                        setDraft(null);
                        setSuccess(
                          "Credential encrypted for recipient. Delivered to Professional inbox.",
                        );
                      })().catch((deliveryError: unknown) => {
                        setError(
                          deliveryError instanceof Error
                            ? deliveryError.message
                            : "The credential could not be delivered.",
                        );
                      });
                    }}
                    type="button"
                  >
                    {account.busy
                      ? "Encrypting and delivering…"
                      : "Sign and deliver credential"}
                  </button>
                ) : (
                  <p className="privacy-note">
                    Open Advanced below to export this signed credential as an
                    encrypted portable file.
                  </p>
                )}
              </div>
            ) : null}
          </section>

          <section
            className="issuer-history"
            aria-labelledby="issue-path-title"
          >
            <header className="section-heading section-heading--compact">
              <div>
                <h2 id="issue-path-title">Issue path</h2>
                <p>The default handoff stays inside Aptor.</p>
              </div>
            </header>
            <WorkflowSequence
              steps={[
                {
                  title: "Accept invitation",
                  detail:
                    "Use the Professional's public holder profile and encryption key.",
                },
                {
                  title: "Review and sign",
                  detail:
                    "Confirm bounded facts before using the local Issuer key.",
                },
                {
                  title: "Encrypt and deliver",
                  detail: "Send ciphertext directly to the Professional inbox.",
                },
              ]}
            />

            <details className="advanced-panel">
              <summary>Advanced · Portable backup and export</summary>
              <div className="import-panel">
                <FileField
                  accept="application/json,.aptor-holder.json"
                  help="Portable fallback for a Professional outside the in-app invitation flow."
                  label="Professional holder profile"
                  onText={(text) => {
                    try {
                      setPortableHolder(parseHolderFile(text));
                      setError("");
                    } catch (fileError) {
                      setError(
                        fileError instanceof Error
                          ? fileError.message
                          : "The holder profile could not be read.",
                      );
                    }
                  }}
                />
                <button
                  className="text-button"
                  onClick={() =>
                    downloadPortableFile(
                      `${account.value!.profile.handle}.aptor-issuer.json`,
                      serializePortableFile(account.value!.issuer.profile),
                    )
                  }
                  type="button"
                >
                  Export issuer profile
                </button>
                {draft !== null && portableHolder !== null ? (
                  <form
                    className="form-stack"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const form = event.currentTarget;
                      const passphrase = String(
                        new FormData(form).get("transferPassphrase") ?? "",
                      );
                      void (async () => {
                        const credential = issueCredential(
                          account.value!.issuer,
                          {
                            holderProfile: portableHolder,
                            ...draft,
                          },
                        );
                        const encrypted = await encryptCredentialPackage(
                          credential,
                          passphrase,
                        );
                        downloadPortableFile(
                          `${credential.credential.credentialId.slice(0, 12)}.aptor-credential`,
                          serializePortableFile(encrypted),
                        );
                      })().catch((portableError: unknown) =>
                        setError(
                          portableError instanceof Error
                            ? portableError.message
                            : "Portable export failed.",
                        ),
                      );
                    }}
                  >
                    <label className="field">
                      <span>Transfer passphrase</span>
                      <input
                        minLength={12}
                        name="transferPassphrase"
                        required
                        type="password"
                      />
                    </label>
                    <button
                      className="action-button action-button--secondary"
                      type="submit"
                    >
                      Export portable credential
                    </button>
                  </form>
                ) : null}
              </div>
            </details>
          </section>

          {error ? (
            <p
              className="workspace-message form-message form-message--error"
              role="alert"
            >
              {error}
            </p>
          ) : null}
          {success ? (
            <p
              className="workspace-message form-message form-message--success"
              role="status"
            >
              {success}
            </p>
          ) : null}
        </>
      )}
    </RoleWorkspace>
  );
}
