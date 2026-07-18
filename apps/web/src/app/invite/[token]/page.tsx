import type { Metadata } from "next";

import { InvitationLanding } from "@/components/invitation-landing";

export const metadata: Metadata = { title: "Issuer invitation" };

export default async function InvitationPage({
  params,
}: Readonly<{ params: Promise<{ token: string }> }>) {
  const { token } = await params;
  return <InvitationLanding token={token} />;
}
