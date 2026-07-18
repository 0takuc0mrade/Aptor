import type { Metadata } from "next";

import { VerifierWorkspace } from "@/components/verifier-workspace";

export const metadata: Metadata = {
  title: "Verifier",
};

export default function VerifierPage() {
  return <VerifierWorkspace />;
}
