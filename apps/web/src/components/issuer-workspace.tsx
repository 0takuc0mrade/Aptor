"use client";

import {
  createIssuerVault,
  downloadPortableFile,
  encryptCredentialPackage,
  issueCredential,
  parseHolderFile,
  serializePortableFile,
  type AptorHolderProfileV1,
} from "@aptor/browser";
import { useMemo, useState } from "react";

import { useVaultSession } from "@/hooks/use-vault-session";

import { FileField } from "./file-field";
import { RoleWorkspace, WorkflowSequence } from "./role-placeholder";
import { VaultAccess, VaultToolbar } from "./vault-access";

type CredentialDraft = Readonly<{
  skills: string[];
  durationMonths: number;
  deliveredToProduction: boolean;
  clientRatingHundredths: number;
}>;

export function IssuerWorkspace() {
  const vault = useVaultSession("issuer");
  const [holder, setHolder] = useState<AptorHolderProfileV1 | null>(null);
  const [draft, setDraft] = useState<CredentialDraft | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const profile = vault.value?.profile ?? null;
  const issuanceCount = vault.value?.issuanceHistory.length ?? 0;
  const holderLabel = useMemo(
    () => (holder ? `${holder.profileId.slice(0, 12)}…` : "No holder loaded"),
    [holder],
  );

  const backup = async () => {
    const container = await vault.exportBackup();
    downloadPortableFile(
      "aptor-issuer-vault-backup.json",
      serializePortableFile(container),
    );
  };

  return (
    <RoleWorkspace
      description="Import a professional’s public holder profile, attest only to bounded work facts, review the credential, then sign and deliver it as an encrypted file."
      headline="Issue work without exposing it."
      privacyDetail="The issuer signing secret remains in the encrypted local vault. The professional receives an authenticated encrypted credential package; no credential is written to public state."
      privacyStages={[
        "Holder and work facts",
        "Local signature",
        "Public issuer key",
      ]}
      privacySummary="Credential details remain between issuer and professional."
      role="Issuer"
      status={
        vault.value
          ? `${issuanceCount} credential${issuanceCount === 1 ? "" : "s"} signed from this vault.`
          : "Issuer keys remain unavailable until the encrypted vault is unlocked."
      }
    >
      {vault.value === null ? (
        <VaultAccess
          busy={vault.busy}
          error={vault.error}
          exists={vault.exists}
          onCreate={async (password, displayName) => {
            await vault.create(password, createIssuerVault(displayName));
          }}
          onRestore={async (value, password) => {
            await vault.importBackup(value, password);
          }}
          onUnlock={vault.unlock}
          role="issuer"
        />
      ) : (
        <>
          <section className="issuer-flow" aria-labelledby="issuer-flow-title">
            <header className="section-heading">
              <div>
                <h2 id="issuer-flow-title">Issuer vault</h2>
                <p>Key custody and public identity for this browser profile.</p>
              </div>
              <span className="section-heading__state">Unlocked locally</span>
            </header>

            <dl className="credential-spec">
              <div>
                <dt>Display name</dt>
                <dd>{profile?.displayName ?? "Not set"}</dd>
                <span>Unverified metadata</span>
              </div>
              <div>
                <dt>Issuer key</dt>
                <dd className="mono-value" title={profile?.issuerPublicKey}>
                  {profile?.issuerPublicKey.slice(0, 28)}…
                </dd>
                <span>Public</span>
              </div>
              <div>
                <dt>Issuance history</dt>
                <dd>{issuanceCount}</dd>
                <span>Encrypted locally</span>
              </div>
            </dl>

            <p className="privacy-note">
              Aptor verifies possession of this issuer key. It does not
              independently verify the legal organisation behind it.
            </p>

            <div className="button-row">
              <button
                className="action-button"
                onClick={() => {
                  if (profile === null) return;
                  downloadPortableFile(
                    `${profile.displayName?.toLowerCase().replaceAll(/[^a-z0-9]+/gu, "-") || "issuer"}.aptor-issuer.json`,
                    serializePortableFile(profile),
                  );
                }}
                type="button"
              >
                Export issuer profile
              </button>
            </div>

            <VaultToolbar
              busy={vault.busy}
              onBackup={backup}
              onDelete={vault.deleteLocal}
              onLock={vault.lock}
            />
          </section>

          <section
            className="issuer-review"
            aria-labelledby="credential-create-title"
          >
            <header className="section-heading section-heading--compact">
              <div>
                <h2 id="credential-create-title">Create work credential</h2>
                <p>Only bounded evidence needed by Aptor is collected.</p>
              </div>
            </header>

            <FileField
              accept="application/json,.aptor-holder.json"
              help="Public holder profiles contain a commitment, never a holder secret."
              label="Professional holder profile"
              onText={(text) => {
                try {
                  setHolder(parseHolderFile(text));
                  setDraft(null);
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

            <p className="import-state">
              <strong>Holder:</strong> {holderLabel}
            </p>

            <form
              className="form-stack"
              onSubmit={(event) => {
                event.preventDefault();
                setError("");
                setSuccess("");
                if (holder === null) {
                  setError("Import the professional’s holder profile first.");
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
                const rating = Number(data.get("rating"));
                const durationMonths = Number(data.get("durationMonths"));
                if (!Number.isInteger(durationMonths)) {
                  setError("Duration must be a whole number of months.");
                  return;
                }
                setDraft({
                  skills,
                  durationMonths,
                  deliveredToProduction: data.get("production") === "on",
                  clientRatingHundredths: Math.round(rating * 100),
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
              <button className="action-button" type="submit">
                Review credential
              </button>
            </form>

            {draft !== null ? (
              <div className="review-sheet" aria-live="polite">
                <p className="eyebrow">Signing review</p>
                <h3>Confirm the complete private credential</h3>
                <dl>
                  <div>
                    <dt>Holder</dt>
                    <dd>{holderLabel}</dd>
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
                <form
                  className="form-stack"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (vault.value === null || holder === null) return;
                    const form = event.currentTarget;
                    const passphrase = String(
                      new FormData(form).get("transferPassphrase") ?? "",
                    );
                    setError("");
                    setSuccess("");
                    void (async () => {
                      const credential = issueCredential(vault.value!, {
                        holderProfile: holder,
                        ...draft,
                      });
                      const encrypted = await encryptCredentialPackage(
                        credential,
                        passphrase,
                      );
                      const nextVault = {
                        ...vault.value!,
                        issuanceHistory: [
                          ...vault.value!.issuanceHistory,
                          {
                            credentialId: credential.credential.credentialId,
                            holderProfileId: credential.holderProfileId,
                            issuedAt: credential.issuedAt,
                          },
                        ],
                      };
                      await vault.save(nextVault);
                      downloadPortableFile(
                        `${credential.credential.credentialId.slice(0, 12)}.aptor-credential`,
                        serializePortableFile(encrypted),
                      );
                      form.reset();
                      setDraft(null);
                      setSuccess(
                        "Credential signed and encrypted. Share the transfer passphrase outside Aptor.",
                      );
                    })().catch((signingError: unknown) => {
                      setError(
                        signingError instanceof Error
                          ? signingError.message
                          : "The credential could not be signed.",
                      );
                    });
                  }}
                >
                  <label className="field">
                    <span>Transfer passphrase</span>
                    <input
                      autoComplete="new-password"
                      minLength={12}
                      name="transferPassphrase"
                      required
                      type="password"
                    />
                    <small>
                      Share this separately with the professional. It is never
                      included in the credential file.
                    </small>
                  </label>
                  <button
                    className="action-button"
                    disabled={vault.busy}
                    type="submit"
                  >
                    {vault.busy
                      ? "Encrypting credential…"
                      : "Sign and download credential"}
                  </button>
                </form>
              </div>
            ) : null}

            {error ? (
              <p className="form-message form-message--error" role="alert">
                {error}
              </p>
            ) : null}
            {success ? (
              <p className="form-message form-message--success" role="status">
                {success}
              </p>
            ) : null}
          </section>

          <section
            className="issuer-history"
            aria-labelledby="issue-path-title"
          >
            <header className="section-heading section-heading--compact">
              <div>
                <h2 id="issue-path-title">Issue path</h2>
                <p>Each handoff is explicit and file-based.</p>
              </div>
            </header>
            <WorkflowSequence
              steps={[
                {
                  title: "Import holder",
                  detail: "Read the professional’s public commitment profile.",
                },
                {
                  title: "Review and sign",
                  detail:
                    "Confirm bounded work facts before using the issuer key.",
                },
                {
                  title: "Transfer securely",
                  detail:
                    "Download encrypted credential; share its passphrase separately.",
                },
              ]}
            />
          </section>
        </>
      )}
    </RoleWorkspace>
  );
}
