import { getDeliveryHealth } from "@aptor/delivery";

import { serverReleaseConfigurationIssues } from "@/lib/server-release-config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET(): Response {
  const issues = serverReleaseConfigurationIssues({
    requireContractAddress: true,
  });
  try {
    const delivery = getDeliveryHealth();
    return Response.json(
      {
        status: issues.length === 0 ? "ok" : "misconfigured",
        delivery,
        configurationIssues: issues,
      },
      {
        status: issues.length === 0 ? 200 : 503,
        headers: { "cache-control": "no-store" },
      },
    );
  } catch {
    return Response.json(
      {
        status: "unhealthy",
        configurationIssues: issues,
        delivery: { status: "unavailable" },
      },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}
