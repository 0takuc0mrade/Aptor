import { NextResponse } from "next/server";

import { getCombinedReport, getQuarantineRun } from "@/lib/db/quarantine";
import { identifierSchema } from "@/lib/quarantine/schema";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string; runId: string }> }) {
  try {
    const values = await params;
    const id = identifierSchema.parse(values.id);
    const runId = identifierSchema.parse(values.runId);
    const run = await getQuarantineRun(runId);
    if (!run || run.scanId !== id) return NextResponse.json({ error: "Quarantine run not found." }, { status: 404 });
    const report = await getCombinedReport(runId);
    if (!report) return NextResponse.json({ error: "Combined report is not ready.", status: run.status }, { status: 409 });
    return NextResponse.json({ report });
  } catch {
    return NextResponse.json({ error: "Invalid quarantine report identifier." }, { status: 400 });
  }
}
