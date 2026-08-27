import { NextResponse } from "next/server";

import { getInspection } from "@/lib/db/inspections";
import { getScan } from "@/lib/db/scans";
import { completeInspectionStages, initialInspectionStages } from "@/lib/inspection/stages";
import type { InspectionRecord } from "@/lib/inspection/types";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const inspection = await getInspection(id);
  if (inspection) return NextResponse.json({ inspection });

  const scan = await getScan(id);
  if (!scan) return NextResponse.json({ error: "Inspection not found." }, { status: 404 });
  const legacy: InspectionRecord = completeInspectionStages({
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
  return NextResponse.json({ inspection: legacy });
}
