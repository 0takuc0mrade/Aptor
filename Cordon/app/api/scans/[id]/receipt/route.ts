import { NextResponse } from "next/server";

import { getCombinedReport, getLatestExecutionPlan, getLatestQuarantineRun } from "@/lib/db/quarantine";
import { getScan } from "@/lib/db/scans";
import { publicExecutionPlan } from "@/lib/quarantine/planner";
import { buildReportReceipt } from "@/lib/reports/receipt";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scan = await getScan(id);
  if (!scan) return NextResponse.json({ error: "The static report is not ready." }, { status: 409 });
  const [plan, run] = await Promise.all([getLatestExecutionPlan(id), getLatestQuarantineRun(id)]);
  const report = run ? await getCombinedReport(run.id) : null;
  const receipt = buildReportReceipt({ scan, plan: plan ? publicExecutionPlan(plan) : null, run, report });
  const filename = `cordon-${scan.repository.owner}-${scan.repository.name}-${scan.repository.commitHash.slice(0, 8)}.json`;
  return new NextResponse(`${JSON.stringify(receipt, null, 2)}\n`, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
