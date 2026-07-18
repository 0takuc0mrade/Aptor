"use client";

import {
  downloadPortableFile,
  parseImportedJson,
  serializePortableFile,
} from "@aptor/browser";
import { useRef, useState } from "react";

import { useAptorAccount } from "./account-provider";
import { FileField } from "./file-field";

export function ProfileAccess() {
  const account = useAptorAccount();
  const backup = useRef<unknown>(null);
  const [localError, setLocalError] = useState("");

  return (
    <section
      className="vault-access profile-access"
      aria-labelledby="profile-access-title"
    >
      <header className="section-heading">
        <div>
          <h2 id="profile-access-title">
            {account.exists ? "Unlock Aptor profile" : "Create Aptor profile"}
          </h2>
          <p>
            One encrypted profile opens every role workspace on this device.
            Aptor cannot recover its password or private encryption key.
          </p>
        </div>
        <span className="section-heading__state">
          {account.exists ? "Device locked" : "Device not set up"}
        </span>
      </header>

      {account.exists ? (
        <form
          className="form-stack"
          onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const password = String(new FormData(form).get("password") ?? "");
            void account
              .unlock(password)
              .then(() => form.reset())
              .catch(() => undefined);
          }}
        >
          <label className="field">
            <span>Profile vault password</span>
            <input
              autoComplete="current-password"
              minLength={12}
              name="password"
              required
              type="password"
            />
          </label>
          <button
            className="action-button"
            disabled={account.busy}
            type="submit"
          >
            {account.busy ? "Unlocking profile…" : "Unlock Aptor profile"}
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
            if (password !== String(data.get("confirmation") ?? "")) {
              setLocalError("The two profile vault passwords do not match.");
              return;
            }
            void account
              .create(
                password,
                String(data.get("handle") ?? ""),
                String(data.get("displayName") ?? ""),
              )
              .then(() => form.reset())
              .catch(() => undefined);
          }}
        >
          <div className="form-grid">
            <label className="field">
              <span>Aptor handle</span>
              <input
                autoCapitalize="none"
                autoComplete="username"
                maxLength={32}
                minLength={3}
                name="handle"
                pattern="[A-Za-z0-9][A-Za-z0-9 _-]{1,30}[A-Za-z0-9]"
                placeholder="maya-chen"
                required
                type="text"
              />
              <small>Public and unique. Spaces become hyphens.</small>
            </label>
            <label className="field">
              <span>Display name</span>
              <input
                autoComplete="name"
                maxLength={120}
                name="displayName"
                required
                type="text"
              />
              <small>Public, but not independently verified.</small>
            </label>
          </div>
          <div className="form-grid">
            <label className="field">
              <span>Profile vault password</span>
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
          <button
            className="action-button"
            disabled={account.busy}
            type="submit"
          >
            {account.busy ? "Creating profile…" : "Create Aptor profile"}
          </button>
        </form>
      )}

      <details className="restore-panel">
        <summary>Advanced · Restore encrypted profile backup</summary>
        <form
          className="form-stack"
          onSubmit={(event) => {
            event.preventDefault();
            if (backup.current === null) {
              setLocalError("Choose an encrypted Aptor profile backup first.");
              return;
            }
            const form = event.currentTarget;
            void account
              .importBackup(
                backup.current,
                String(new FormData(form).get("backupPassword") ?? ""),
              )
              .then(() => form.reset())
              .catch(() => undefined);
          }}
        >
          <FileField
            accept="application/json,.json"
            help="The file stays encrypted until you enter its password."
            label="Encrypted profile backup"
            onText={(text) => {
              backup.current = parseImportedJson(text);
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
          <button
            className="action-button action-button--secondary"
            disabled={account.busy}
            type="submit"
          >
            Restore encrypted profile
          </button>
        </form>
      </details>

      {localError || account.error ? (
        <p className="form-message form-message--error" role="alert">
          {localError || account.error}
        </p>
      ) : null}
    </section>
  );
}

export function AccountToolbar() {
  const account = useAptorAccount();
  return (
    <div className="vault-toolbar">
      <button
        className="text-button"
        disabled={account.busy}
        onClick={() => {
          void account.exportBackup().then((backup) => {
            downloadPortableFile(
              "aptor-profile-backup.json",
              serializePortableFile(backup),
            );
          });
        }}
        type="button"
      >
        Export encrypted profile backup
      </button>
      <button className="text-button" onClick={account.lock} type="button">
        Lock Aptor profile
      </button>
    </div>
  );
}
