import type { Metadata } from "next";

import { AppShell } from "@/components/app-shell";
import { AptorAccountProvider } from "@/components/account-provider";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Aptor",
    template: "%s · Aptor",
  },
  description:
    "Prove confidential work experience without exposing the work itself.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <AptorAccountProvider>
          <AppShell>{children}</AppShell>
        </AptorAccountProvider>
      </body>
    </html>
  );
}
