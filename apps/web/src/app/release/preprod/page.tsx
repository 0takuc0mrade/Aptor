import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PreprodReleaseConsole } from "@/components/preprod-release-console";
import { APTOR_PREPROD_DEPLOYMENT_ENABLED } from "@/lib/midnight-config";

export const metadata: Metadata = {
  title: "Preprod release gate",
  robots: { index: false, follow: false },
};

export default function PreprodReleasePage() {
  if (!APTOR_PREPROD_DEPLOYMENT_ENABLED) notFound();
  return <PreprodReleaseConsole />;
}
