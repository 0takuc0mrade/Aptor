"use client";

import { parseImportedJson } from "@aptor/browser";
import { useRef, useState } from "react";

import { FileField } from "./file-field";

type VaultAccessProps = Readonly<{
  busy: boolean;
  error: string;
  exists: boolean;
  role: "issuer" | "professional";
  onCreate: (password: string, displayName?: string) => Promise<void>;
  onRestore: (backup: unknown, password: string) => Promise<void>;
  onUnlock: (password: string) => Promise<unknown>;
}>;

export function VaultAccess({
  busy,
  error,
  exists,
  role,
  onCreate,
  onRestore,
  onUnlock,
}: VaultAccessProps) {
  const encryptedBackup = useRef<unknown>(null);
  const [localError, setLocalError] = useState("");

  return (
    <section className="vault-access" aria-labelledby="vault-access-title">
      <header className="section-heading">
        <div>
          <h2 id="vault-access-title">
            {exists ? "Unlock encrypted vault" : "Create encrypted vault"}
          </h2>
          <p>
            Secrets are encrypted in this browser. Aptor cannot recover a
            forgotten vault password.
          </p>
        </div>
        <span className="section-heading__state">
          {exists ? "Locked" : "No local vault"}
        </span>
      </header>

      {exists ? (
        <form
          className="form-stack"
          onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const data = new FormData(form);
            const password = String(data.get("password") ?? "");
            void onUnlock(password)
              .then(() => form.reset())
              .catch(() => undefined);
          }}
        >
          <label className="field">
            <span>Vault password</span>
            <input
              autoComplete="current-password"
              minLength={12}
              name="password"
              required
              type="password"
            />
          </label>
          <button className="action-button" disabled={busy} type="submit">
            {busy ? "Unlocking vault…" : "Unlock vault"}
          </button>
        </form>
      ) : (
        <form
          className="form-stack"
          onSubmit={(event) => {
            event.preventDefault();
            setLocalError("");
            const form = event.currentTarget;
            const data = new FormData(form);
            const password = String(data.get("password") ?? "");
            const confirmation = String(data.get("confirmation") ?? "");
            if (password !== confirmation) {
              setLocalError("The two vault passwords do not match.");
              return;
            }
            const displayName = String(data.get("displayName") ?? "");
            void onCreate(password, displayName)
              .then(() => form.reset())
              .catch(() => undefined);
          }}
        >
          {role === "issuer" ? (
            <label className="field">
              <span>
                Display name <small>Optional, unverified</small>
              </span>
              <input
                autoComplete="organization"
                maxLength={120}
                name="displayName"
                type="text"
              />
            </label>
          ) : null}
          <div className="form-grid">
            <label className="field">
              <span>Vault password</span>
              <input
                autoComplete="new-password"
                minLength={12}
                name="password"
                required
                type="password"
              />
            </label>
            <label className="field">
              <span>Confirm password</span>
              <input
                autoComplete="new-password"
                minLength={12}
                name="confirmation"
                required
                type="password"
              />
            </label>
          </div>
          <button className="action-button" disabled={busy} type="submit">
            {busy ? "Creating vault…" : `Create ${role} vault`}
          </button>
        </form>
      )}

      <details className="restore-panel">
        <summary>Restore an encrypted backup</summary>
        <form
          className="form-stack"
          onSubmit={(event) => {
            event.preventDefault();
            if (encryptedBackup.current === null) {
              setLocalError("Choose an Aptor vault backup first.");
              return;
            }
            const form = event.currentTarget;
            const password = String(
              new FormData(form).get("backupPassword") ?? "",
            );
            void onRestore(encryptedBackup.current, password)
              .then(() => form.reset())
              .catch(() => undefined);
          }}
        >
          <FileField
            accept="application/json,.json"
            help="The backup remains encrypted until you enter its password."
            label="Encrypted vault backup"
            onText={(text) => {
              encryptedBackup.current = parseImportedJson(text);
              setLocalError("");
            }}
          />
          <label className="field">
            <span>Backup password</span>
            <input
              autoComplete="current-password"
              minLength={12}
              name="backupPassword"
              required
              type="password"
            />
          </label>
          <button className="action-button" disabled={busy} type="submit">
            Restore encrypted backup
          </button>
        </form>
      </details>

      {localError || error ? (
        <p className="form-message form-message--error" role="alert">
          {localError || error}
        </p>
      ) : null}
    </section>
  );
}

type VaultToolbarProps = Readonly<{
  busy: boolean;
  onBackup: () => Promise<void>;
  onDelete: () => Promise<void>;
  onLock: () => void;
}>;

export function VaultToolbar({
  busy,
  onBackup,
  onDelete,
  onLock,
}: VaultToolbarProps) {
  const dialog = useRef<HTMLDialogElement>(null);

  return (
    <div className="vault-toolbar">
      <button
        className="text-button"
        disabled={busy}
        onClick={() => void onBackup()}
        type="button"
      >
        Export encrypted backup
      </button>
      <button className="text-button" onClick={onLock} type="button">
        Lock vault
      </button>
      <button
        className="text-button text-button--danger"
        onClick={() => dialog.current?.showModal()}
        type="button"
      >
        Delete local vault
      </button>
      <dialog className="confirm-dialog" ref={dialog}>
        <h2>Delete this local vault?</h2>
        <p>
          This permanently deletes the encrypted browser copy. Export a backup
          first if you need to restore it later.
        </p>
        <div className="button-row">
          <button
            className="action-button action-button--danger"
            disabled={busy}
            onClick={() => {
              void onDelete().then(() => dialog.current?.close());
            }}
            type="button"
          >
            Delete local vault
          </button>
          <button
            className="action-button action-button--secondary"
            onClick={() => dialog.current?.close()}
            type="button"
          >
            Keep vault
          </button>
        </div>
      </dialog>
    </div>
  );
}
