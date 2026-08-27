import type { ExecutionPlan } from "./types";

export const QUARANTINE_RUNTIME_VERSION = "0.1.0";
export const QUARANTINE_IMAGE_LABEL = "io.cordon.runtime.version";
export const QUARANTINE_IMAGE = process.env.CORDON_RUNTIME_IMAGE ?? `cordon-quarantine:${QUARANTINE_RUNTIME_VERSION}`;

export const DEFAULT_QUARANTINE_LIMITS = {
  timeoutMs: 30_000,
  memoryLimitMb: 512,
  cpuLimit: 0.75,
  processLimit: 96,
  outputLimitBytes: 256_000,
} as const;

const INTERPOLATION = /[;&|`$()<>\n\r\\]/;

export function validateScriptName(name: string): string {
  if (!name || name.length > 100 || INTERPOLATION.test(name) || !/^[A-Za-z0-9@._:/-]+$/.test(name)) {
    throw new Error("The selected package script name contains unsupported shell or interpolation characters.");
  }
  return name;
}

export function configuredRegistryDomains(): string[] {
  return (process.env.CORDON_REGISTRY_ALLOWLIST ?? "registry.npmjs.org")
    .split(",")
    .map((domain) => domain.trim().toLowerCase())
    .filter((domain) => /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(domain));
}

export function validateExecutionPlan(plan: ExecutionPlan): void {
  if (!/^[0-9a-f-]{8,64}$/i.test(plan.id) || !/^[0-9a-f-]{8,64}$/i.test(plan.scanId)) throw new Error("Execution plan identifiers are invalid.");
  if (!plan.repositoryPath.startsWith("managed://scan/") && !plan.repositoryPath.startsWith("/")) throw new Error("Execution plans must use a worker-managed repository locator.");
  if (!plan.command.length || plan.command.some((part) => typeof part !== "string" || !part || part.includes("\0"))) throw new Error("Execution command arguments are invalid.");
  if (plan.timeoutMs < 1_000 || plan.timeoutMs > 120_000) throw new Error("Execution timeout is outside the supported range.");
  if (plan.memoryLimitMb < 128 || plan.memoryLimitMb > 2_048) throw new Error("Memory limit is outside the supported range.");
  if (plan.cpuLimit < 0.1 || plan.cpuLimit > 2) throw new Error("CPU limit is outside the supported range.");
  if (plan.processLimit < 16 || plan.processLimit > 256) throw new Error("Process limit is outside the supported range.");
  if (plan.outputLimitBytes < 16_384 || plan.outputLimitBytes > 1_048_576) throw new Error("Output limit is outside the supported range.");
  if (plan.networkPolicy === "allowlist" && plan.mode !== "install") throw new Error("The network allowlist is available only for dependency installation.");
  if (plan.networkPolicy === "allowlist" && plan.allowedDomains.length === 0) throw new Error("The registry allowlist has no configured domains.");
  if (plan.mode === "script") validateScriptName(plan.selectedScript ?? "");
}

export function dockerPolicyArguments(plan: ExecutionPlan, containerName: string): string[] {
  validateExecutionPlan(plan);
  const args = [
    "create",
    "--name", containerName,
    "--user", "1000:1000",
    "--workdir", "/workspace/repository",
    "--cap-drop", "ALL",
    "--security-opt", "no-new-privileges:true",
    "--memory", `${plan.memoryLimitMb}m`,
    "--memory-swap", `${plan.memoryLimitMb}m`,
    "--cpus", String(plan.cpuLimit),
    "--pids-limit", String(plan.processLimit),
    "--tmpfs", "/tmp:rw,nosuid,nodev,noexec,size=64m,mode=1777",
    "--env", "HOME=/home/cordon",
    "--env", "CI=1",
    "--env", "NPM_CONFIG_CACHE=/tmp/npm-cache",
    "--env", "XDG_CACHE_HOME=/tmp/xdg-cache",
    "--env", "CORDON_TELEMETRY=1",
    "--env", "NODE_OPTIONS=--require=/cordon/preload.cjs",
  ];

  if (plan.mode !== "install") args.push("--read-only");
  if (plan.networkPolicy === "disabled") {
    args.push("--network", "none");
  } else {
    const network = process.env.CORDON_QUARANTINE_NETWORK;
    const proxy = process.env.CORDON_REGISTRY_PROXY_URL;
    if (!network || !proxy || process.env.CORDON_QUARANTINE_ALLOWLIST_ENFORCED !== "1") {
      throw new Error("Registry allowlist execution requires an operator-enforced Docker network and proxy.");
    }
    args.push("--network", network, "--env", `HTTPS_PROXY=${proxy}`, "--env", `HTTP_PROXY=${proxy}`, "--env", "NO_PROXY=");
  }
  return args;
}

export function imageIsPinned(image: string): boolean {
  return image.includes("@sha256:") || /:[^/]+$/.test(image) && !image.endsWith(":latest");
}
