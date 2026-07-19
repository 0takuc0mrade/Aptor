import { runReleasePreflight } from "@/lib/release-preflight";
import { APTOR_PREPROD_DEPLOYMENT_ENABLED } from "@/lib/midnight-config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const deploymentModeRequested =
    new URL(request.url).searchParams.get("mode") === "deployment";
  if (deploymentModeRequested && !APTOR_PREPROD_DEPLOYMENT_ENABLED) {
    return Response.json(
      { ready: false, message: "The Preprod deployment gate is disabled." },
      { status: 404, headers: { "cache-control": "no-store" } },
    );
  }
  const checks = await runReleasePreflight(request.url, {
    requireContractAddress: !deploymentModeRequested,
  });
  const ready = checks.every(
    (check) => check.status === "pass" || check.status === "skip",
  );
  return Response.json(
    { ready, checks },
    {
      status: ready ? 200 : 503,
      headers: { "cache-control": "no-store" },
    },
  );
}
