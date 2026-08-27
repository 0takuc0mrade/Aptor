import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

import { listRecentInspections } from "@/lib/db/inspections";
import { persistenceReadiness } from "@/lib/db/fallback";
import { githubRepositoryUrlSchema } from "@/lib/github/schema";
import { submitInspection } from "@/lib/inspection/worker";

export const runtime = "nodejs";

const submissionSchema = z.object({
  repositoryUrl: z.string().optional(),
  submissionKey: z.string().uuid().optional(),
  demo: z.enum(["normal", "suspicious"]).optional(),
}).refine((value) => Boolean(value.repositoryUrl) !== Boolean(value.demo), "Choose one repository URL or demonstration repository.");

export async function GET() {
  return NextResponse.json({ inspections: await listRecentInspections(), persistence: persistenceReadiness() });
}

export async function POST(request: Request) {
  try {
    const body = submissionSchema.parse(await request.json());
    const submissionKey = body.submissionKey ?? crypto.randomUUID();
    if (body.demo) {
      if (process.env.CORDON_SUBMISSION_MODE !== "true") return NextResponse.json({ error: "Demonstration repositories are available only in submission mode." }, { status: 404 });
      const name = body.demo === "normal" ? "normal-repository" : "suspicious-repository";
      const result = await submitInspection({
        submissionKey,
        repositoryUrl: `https://github.com/cordon-demo/${name}`,
        owner: "cordon-demo",
        name,
        source: "demo",
        demoKey: body.demo,
      });
      return NextResponse.json(result, { status: result.created ? 202 : 200 });
    }

    const repository = githubRepositoryUrlSchema.parse(body.repositoryUrl);
    const result = await submitInspection({
      submissionKey,
      repositoryUrl: repository.url,
      owner: repository.owner,
      name: repository.name,
    });
    return NextResponse.json(result, { status: result.created ? 202 : 200 });
  } catch (error) {
    if (error instanceof ZodError) return NextResponse.json({ error: error.issues[0]?.message ?? "Enter a valid public GitHub repository URL." }, { status: 400 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Cordon could not start the inspection." }, { status: 500 });
  }
}
