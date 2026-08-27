import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { InspectionReport } from "@/components/inspection-report";
import { getInspection } from "@/lib/db/inspections";
import { getScan } from "@/lib/db/scans";
import { completeInspectionStages, initialInspectionStages } from "@/lib/inspection/stages";
import type { InspectionRecord } from "@/lib/inspection/types";

export const dynamic = "force-dynamic";

async function inspectionForId(id: string): Promise<InspectionRecord | null> {
  const inspection = await getInspection(id);
  if (inspection) return inspection;
  const scan = await getScan(id);
  if (!scan) return null;
  return completeInspectionStages({
    id: scan.id,
    submissionKey: scan.id,
    repositoryUrl: scan.repository.url,
    owner: scan.repository.owner,
    name: scan.repository.name,
    source: scan.repository.source ?? "github",
    demoKey: scan.repository.demoKey,
    status: "running",
    currentStage: "preparing-quarantine-options",
    stages: initialInspectionStages(),
    createdAt: scan.startedAt,
    updatedAt: scan.completedAt,
    startedAt: scan.startedAt,
    scan,
  }, scan.completedAt);
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const inspection = await inspectionForId(id);
  return { title: inspection ? `${inspection.owner}/${inspection.name} inspection` : "Inspection not found" };
}

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const inspection = await inspectionForId(id);
  if (!inspection) notFound();
  return <InspectionReport initialInspection={inspection} />;
}
