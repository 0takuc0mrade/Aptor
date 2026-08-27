import { NextResponse } from "next/server";

import { getCombinedReport, getLatestExecutionPlan, getLatestQuarantineRun } from "@/lib/db/quarantine";
import { getScan } from "@/lib/db/scans";
import { publicExecutionPlan } from "@/lib/quarantine/planner";
import { buildCopyableSummary } from "@/lib/reports/receipt";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scan = await getScan(id);
  if (!scan) return NextResponse.json({ error: "The static report is not ready." }, { status: 409 });
  const [plan, run] = await Promise.all([getLatestExecutionPlan(id), getLatestQuarantineRun(id)]);
  const report = run ? await getCombinedReport(run.id) : null;
  return NextResponse.json({ summary: buildCopyableSummary({ scan, plan: plan ? publicExecutionPlan(plan) : null, run, report }) });
}
