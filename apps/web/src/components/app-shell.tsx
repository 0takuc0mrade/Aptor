"use client";

import type { AptorRole } from "@aptor/shared";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { useAptorAccount } from "./account-provider";

const roles: ReadonlyArray<{
  href: `/${AptorRole}`;
  label: string;
  role: AptorRole;
  sequence: string;
}> = [
  { href: "/issuer", label: "Issuer", role: "issuer", sequence: "01" },
  {
    href: "/professional",
    label: "Professional",
    role: "professional",
    sequence: "02",
  },
  { href: "/verifier", label: "Verifier", role: "verifier", sequence: "03" },
];

type AppShellProps = Readonly<{
  children: React.ReactNode;
}>;

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const account = useAptorAccount();
  const unread = account.notifications.filter(
    (notification) => notification.readAt === null,
  ).length;

  if (pathname === "/") {
    return (
      <div className="landing-shell">
        <a className="skip-link" href="#main-content">
          Skip to content
        </a>
        {children}
      </div>
    );
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>

      <header className="topbar">
        <div className="topbar__inner">
          <Link aria-label="Aptor home" className="brand" href="/">
            <span aria-hidden="true" className="brand__mark">
              A
            </span>
            <span>
              <strong className="brand__name">Aptor</strong>
              <small className="brand__tagline">
                Vol. 01 · Private work credentials
              </small>
            </span>
          </Link>

          <nav aria-label="Switch Aptor role" className="role-switcher">
            {roles.map(({ href, label, role, sequence }) => {
              const isActive = pathname === href;

              return (
                <Link
                  aria-current={isActive ? "page" : undefined}
                  className="role-switcher__link"
                  data-active={isActive ? "true" : "false"}
                  href={href}
                  key={role}
                >
                  <span aria-hidden="true">{sequence}</span>
                  {label}
                </Link>
              );
            })}
          </nav>

          <Link
            className="inbox-affordance"
            href="/professional"
            aria-label={`${unread} unread Aptor notifications`}
          >
            Inbox
            {unread > 0 ? <span>{unread}</span> : null}
          </Link>

          <div className="milestone-status" role="status">
            <span aria-hidden="true" className="milestone-status__dot" />
            Encrypted delivery
          </div>
        </div>
      </header>

      <main className="main" id="main-content">
        {children}
      </main>

      <footer className="footer">
        <p>
          Aptor 0.1 · Encrypted local vaults · Official Midnight wallet path ·
          No fabricated credentials or proof results
        </p>
        <p>Prove the work. Protect the details.</p>
      </footer>
    </div>
  );
}
