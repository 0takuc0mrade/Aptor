import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { getLatestQuarantineRun, listQuarantineRuns } from "@/lib/db/quarantine";
import { getScan } from "@/lib/db/scans";
import { identifierSchema, startRunRequestSchema } from "@/lib/quarantine/schema";
import { quarantineWorker } from "@/workers/quarantine-worker";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: rawId } = await params;
    const id = identifierSchema.parse(rawId);
    if (!await getScan(id)) return NextResponse.json({ error: "Scan report not found." }, { status: 404 });
    return NextResponse.json({ run: await getLatestQuarantineRun(id), attempts: await listQuarantineRuns(id) });
  } catch (error) {
    const message = error instanceof ZodError ? error.issues[0]?.message : error instanceof Error ? error.message : "Unable to read quarantine runs.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: rawId } = await params;
    const id = identifierSchema.parse(rawId);
    if (!await getScan(id)) return NextResponse.json({ error: "Scan report not found." }, { status: 404 });
    const { planId, retry } = startRunRequestSchema.parse(await request.json());
    const run = await quarantineWorker.start(id, planId, { retry });
    return NextResponse.json({ run }, { status: run.status === "queued" ? 202 : 200 });
  } catch (error) {
    const message = error instanceof ZodError ? error.issues[0]?.message : error instanceof Error ? error.message : "Unable to start quarantine.";
    return NextResponse.json({ error: message }, { status: /not found/i.test(message ?? "") ? 404 : 422 });
  }
}
