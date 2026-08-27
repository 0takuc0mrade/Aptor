import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { getInspection, updateInspection } from "@/lib/db/inspections";
import { getLatestExecutionPlan, getLatestQuarantineRun, listQuarantineRuns, saveExecutionPlan } from "@/lib/db/quarantine";
import { getScan } from "@/lib/db/scans";
import { withInspectionRepositoryAtCommit } from "@/lib/inspection/source";
import { DockerRuntimeBootstrap, runtimeBootstrapFailure } from "@/lib/quarantine/bootstrap";
import { explanationAvailability } from "@/lib/quarantine/explanation";
import { createRecommendedExecutionPlan, publicExecutionPlan } from "@/lib/quarantine/planner";
import { identifierSchema } from "@/lib/quarantine/schema";

export const runtime = "nodejs";
export const maxDuration = 60;

async function scanForId(rawId: string) {
  const id = identifierSchema.parse(rawId);
  const scan = await getScan(id);
  if (!scan) throw new Error("Static inspection is not complete yet.");
  return scan;
}

async function ensureRecommendation(scan: Awaited<ReturnType<typeof scanForId>>) {
  const inspection = await getInspection(scan.id);
  let plan = await getLatestExecutionPlan(scan.id);
  let recommendation = inspection?.recommendation;
  if (!recommendation) {
    const planned = await withInspectionRepositoryAtCommit(scan.repository, (root) => createRecommendedExecutionPlan({
      scan,
      repositoryRoot: root,
      repositoryLocator: `managed://scan/${scan.id}/${scan.repository.commitHash}`,
    }));
    if (planned.plan) {
      plan = planned.plan;
      await saveExecutionPlan(planned.plan);
    }
    recommendation = planned.recommendation;
    if (inspection) await updateInspection(scan.id, { recommendation });
  }
  return { plan, recommendation };
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const scan = await scanForId(id);
    const [{ plan, recommendation }, readiness, latestRun, attempts] = await Promise.all([
      ensureRecommendation(scan),
      new DockerRuntimeBootstrap().ensure({ retry: new URL(request.url).searchParams.get("retry") === "1" }),
      getLatestQuarantineRun(scan.id),
      listQuarantineRuns(scan.id),
    ]);
    return NextResponse.json({
      readiness,
      recommendation,
      plan: plan ? publicExecutionPlan(plan) : null,
      latestRun,
      attempts,
      explanation: explanationAvailability(),
      troubleshooting: readiness.state === "unavailable" ? {
        instruction: "Run npm run setup from the Cordon repository, then retry readiness.",
        detail: process.env.NODE_ENV === "development" ? runtimeBootstrapFailure() : undefined,
      } : null,
    });
  } catch (error) {
    const message = error instanceof ZodError ? error.issues[0]?.message : error instanceof Error ? error.message : "Quarantine readiness failed.";
    return NextResponse.json({ error: message }, { status: /not complete/i.test(message ?? "") ? 409 : /not found/i.test(message ?? "") ? 404 : 422 });
  }
}

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const scan = await scanForId(id);
    const { plan, recommendation } = await ensureRecommendation(scan);
    if (!plan) return NextResponse.json({ recommendation, plan: null }, { status: 200 });
    return NextResponse.json({ recommendation, plan: publicExecutionPlan(plan) }, { status: 200 });
  } catch (error) {
    const message = error instanceof ZodError ? error.issues[0]?.message : error instanceof Error ? error.message : "Execution planning failed.";
    return NextResponse.json({ error: message }, { status: /not complete/i.test(message ?? "") ? 409 : 422 });
  }
}
