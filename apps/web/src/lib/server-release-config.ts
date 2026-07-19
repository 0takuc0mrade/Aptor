import { isAbsolute, resolve } from "node:path";

import {
  APTOR_NETWORK,
  releaseConfigurationIssues,
  type ReleaseConfigurationIssue,
} from "./midnight-config";

export const APTOR_DELIVERY_DB_PATH =
  process.env.APTOR_DELIVERY_DB_PATH ??
  resolve(process.cwd(), ".aptor-delivery", "aptor.sqlite");
export const APTOR_PUBLIC_URL = process.env.APTOR_PUBLIC_URL?.trim() ?? "";

function isPublicHttpsOrigin(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.username.length === 0 &&
      url.password.length === 0 &&
      url.pathname === "/" &&
      url.search.length === 0 &&
      url.hash.length === 0 &&
      (value === url.origin || value === `${url.origin}/`)
    );
  } catch {
    return false;
  }
}

export function serverReleaseConfigurationIssues(
  options: Readonly<{
    requireContractAddress?: boolean;
    requireHosting?: boolean;
  }> = {},
): ReleaseConfigurationIssue[] {
  const issues = releaseConfigurationIssues(options);
  if (APTOR_NETWORK !== "preprod" || options.requireHosting === false) {
    return issues;
  }
  if (!isAbsolute(APTOR_DELIVERY_DB_PATH)) {
    issues.push({
      field: "APTOR_DELIVERY_DB_PATH",
      message: "Use an absolute path on the host's persistent disk.",
    });
  }
  if (!isPublicHttpsOrigin(APTOR_PUBLIC_URL)) {
    issues.push({
      field: "APTOR_PUBLIC_URL",
      message: "Set the final public HTTPS origin without a path or query.",
    });
  }
  return issues;
}
