import { Dashboard } from "@/components/dashboard";
import { listRecentInspections } from "@/lib/db/inspections";

export const dynamic = "force-dynamic";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ repository?: string }> }) {
  const query = await searchParams;
  const recentInspections = await listRecentInspections();
  return <Dashboard initialInspections={recentInspections} submissionMode={process.env.CORDON_SUBMISSION_MODE === "true"} initialRepositoryUrl={query.repository ?? ""} />;
}
