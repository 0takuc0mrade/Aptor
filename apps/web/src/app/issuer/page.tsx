import type { Metadata } from "next";

import { IssuerWorkspace } from "@/components/issuer-workspace";

export const metadata: Metadata = {
  title: "Issuer",
};

export default function IssuerPage() {
  return <IssuerWorkspace />;
}
