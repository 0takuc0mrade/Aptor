"use client";

import type { AptorProfileV1 } from "@aptor/shared";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { inspectInvitation, redeemInvitation } from "@/lib/delivery-client";

import { useAptorAccount } from "./account-provider";
import { ProfileAccess } from "./profile-access";

export function InvitationLanding({ token }: Readonly<{ token: string }>) {
  const account = useAptorAccount();
  const router = useRouter();
  const [state, setState] = useState<
    "checking" | "active" | "expired" | "redeemed" | "invalid"
  >("checking");
  const [inviter, setInviter] = useState<AptorProfileV1 | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void inspectInvitation(token)
        .then((result) => {
          setState(result.state);
          setInviter(result.inviter ?? null);
        })
        .catch(() => setState("invalid"));
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [token]);

  return (
    <article className="invitation-page">
      <header className="invitation-hero">
        <p className="role-state">
          <span aria-hidden="true" className="role-state__marker" />
          Issuer invitation
        </p>
        <h1>
          {state === "active"
            ? `${inviter?.displayName ?? "A Professional"} invited you to issue a private work credential.`
            : "Review Aptor invitation"}
        </h1>
        <p>
          Aptor lets you sign bounded work facts for a Professional. The signed
          credential is encrypted to their profile and never published on
          Midnight.
        </p>
      </header>

      {state === "checking" ? (
        <p className="form-message" role="status">
          Checking this one-time invitation…
        </p>
      ) : null}
      {state === "invalid" ? (
        <p className="form-message form-message--error" role="alert">
          This invitation is invalid.
        </p>
      ) : null}
      {state === "expired" ? (
        <p className="form-message form-message--error" role="alert">
          This invitation has expired. Ask the Professional for a new link.
        </p>
      ) : null}
      {state === "redeemed" ? (
        <p className="form-message form-message--warning" role="status">
          This invitation has already been used.
        </p>
      ) : null}

      {state === "active" ? (
        <>
          <section className="invitation-explainer">
            <dl className="credential-spec">
              <div>
                <dt>Invited by</dt>
                <dd>{inviter?.displayName}</dd>
                <span>@{inviter?.handle}</span>
              </div>
              <div>
                <dt>What Aptor verifies</dt>
                <dd>Signature and proof rules</dd>
                <span>Cryptographic</span>
              </div>
              <div>
                <dt>What Aptor does not verify</dt>
                <dd>Legal employer identity</dd>
                <span>No external verification</span>
              </div>
            </dl>
          </section>
          {account.value === null ? (
            <ProfileAccess />
          ) : (
            <section className="invitation-accept">
              <header className="section-heading">
                <div>
                  <h2>Accept with @{account.value.profile.handle}</h2>
                  <p>
                    The Professional’s holder profile and public encryption key
                    will become available in the Issuer workspace.
                  </p>
                </div>
                <span className="section-heading__state">One-time action</span>
              </header>
              <button
                className="action-button"
                onClick={() => {
                  setError("");
                  void redeemInvitation(
                    account.value!.privateProfile.accessToken,
                    token,
                  )
                    .then(() => {
                      window.history.replaceState(null, "", "/issuer");
                      router.replace("/issuer");
                    })
                    .catch((redeemError: unknown) =>
                      setError(
                        redeemError instanceof Error
                          ? redeemError.message
                          : "The invitation could not be accepted.",
                      ),
                    );
                }}
                type="button"
              >
                Accept invitation
              </button>
              {error ? (
                <p className="form-message form-message--error" role="alert">
                  {error}
                </p>
              ) : null}
            </section>
          )}
        </>
      ) : null}
    </article>
  );
}
