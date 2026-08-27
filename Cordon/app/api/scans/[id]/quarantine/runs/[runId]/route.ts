import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { getQuarantineRun } from "@/lib/db/quarantine";
import { identifierSchema } from "@/lib/quarantine/schema";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string; runId: string }> }) {
  try {
    const values = await params;
    const id = identifierSchema.parse(values.id);
    const runId = identifierSchema.parse(values.runId);
    const run = await getQuarantineRun(runId);
    if (!run || run.scanId !== id) return NextResponse.json({ error: "Quarantine run not found." }, { status: 404 });
    return NextResponse.json({ run });
  } catch (error) {
    const message = error instanceof ZodError ? error.issues[0]?.message : "Unable to read quarantine run.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
