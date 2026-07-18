import type { Metadata } from "next";

import { ProfessionalWorkspace } from "@/components/professional-workspace";

export const metadata: Metadata = {
  title: "Professional",
};

export default function ProfessionalPage() {
  return <ProfessionalWorkspace />;
}
