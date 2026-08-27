import { NextResponse } from "next/server";

import { resetDemoInspections } from "@/lib/db/inspections";

export const runtime = "nodejs";

export async function POST() {
  if (process.env.CORDON_SUBMISSION_MODE !== "true") return NextResponse.json({ error: "Submission reset is unavailable." }, { status: 404 });
  const reset = await resetDemoInspections();
  return NextResponse.json({ reset, message: "Demonstration inspection state was reset. Security controls were not changed." });
}
