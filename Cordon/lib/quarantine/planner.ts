import { access, readFile } from "node:fs/promises";
import path from "node:path";

import { createCanaries } from "./canaries";
import { configuredRegistryDomains, DEFAULT_QUARANTINE_LIMITS, validateExecutionPlan, validateScriptName } from "./policy";
import type { ExecutionMode, ExecutionOptions, ExecutionPlan, NetworkPolicy, PackageManager, PublicExecutionPlan } from "./types";
import type { ExecutionRecommendation } from "../inspection/types";
import type { ScanResult } from "../scanner/types";

type PackageJson = {
  packageManager?: unknown;
  scripts?: unknown;
};

const LIFECYCLE_NAMES = ["preinstall", "install", "postinstall", "prepare", "prepublishOnly"] as const;

async function exists(target: string): Promise<boolean> {
  try {
    await access(target);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

async function readPackageJson(repositoryRoot: string): Promise<PackageJson> {
  const target = path.join(repositoryRoot, "package.json");
  const raw = await readFile(target, "utf8");
  if (Buffer.byteLength(raw) > 1_000_000) throw new Error("package.json exceeds the quarantine planning limit.");
  const value = JSON.parse(raw) as unknown;
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("package.json must contain an object.");
  return value as PackageJson;
}

function packageScripts(manifest: PackageJson): Record<string, string> {
  if (manifest.scripts === undefined) return {};
  if (!manifest.scripts || typeof manifest.scripts !== "object" || Array.isArray(manifest.scripts)) throw new Error("package.json scripts must be an object of string commands.");
  const scripts: Record<string, string> = {};
  for (const [name, command] of Object.entries(manifest.scripts)) {
    if (typeof command !== "string") throw new Error(`Package script ${name} is not a string and cannot be planned safely.`);
    scripts[name] = command;
  }
  return scripts;
}

export async function detectPackageManager(repositoryRoot: string, manifest?: PackageJson): Promise<PackageManager> {
  const locks = await Promise.all([
    exists(path.join(repositoryRoot, "package-lock.json")),
    exists(path.join(repositoryRoot, "pnpm-lock.yaml")),
    exists(path.join(repositoryRoot, "yarn.lock")),
  ]);
  const detected = (["npm", "pnpm", "yarn"] as PackageManager[]).filter((_, index) => locks[index]);
  if (detected.length > 1) throw new Error("Multiple package-manager lockfiles make this repository ambiguous.");

  const packageManagerField = manifest?.packageManager;
  let declared: PackageManager | undefined;
  if (typeof packageManagerField === "string") {
    const name = packageManagerField.split("@")[0];
    if (name === "npm" || name === "pnpm" || name === "yarn") declared = name;
    else throw new Error("The declared package manager is not supported by this quarantine runtime.");
  } else if (packageManagerField !== undefined) {
    throw new Error("packageManager must be a string when present.");
  }
  if (declared && detected[0] && declared !== detected[0]) throw new Error("The packageManager field conflicts with the repository lockfile.");
  return declared ?? detected[0] ?? "npm";
}

export async function inspectExecutionOptions(repositoryRoot: string): Promise<ExecutionOptions> {
  const manifest = await readPackageJson(repositoryRoot);
  const scripts = packageScripts(manifest);
  const packageManager = await detectPackageManager(repositoryRoot, manifest);
  return {
    packageManager,
    scripts: Object.keys(scripts).sort(),
    lifecycleScripts: LIFECYCLE_NAMES.filter((name) => scripts[name]).map((name) => ({ name, command: scripts[name] })),
    supportedModes: ["install", "script", "probe"],
  };
}

function registryAllowlistReady(): boolean {
  return Boolean(process.env.CORDON_QUARANTINE_NETWORK && process.env.CORDON_REGISTRY_PROXY_URL && process.env.CORDON_QUARANTINE_ALLOWLIST_ENFORCED === "1");
}

function confirmationForPlan(plan: PublicExecutionPlan): string[] {
  const operation = plan.mode === "install"
    ? "Cordon will install dependencies inside quarantine."
    : plan.mode === "script"
      ? `Cordon will run the repository’s “${plan.selectedScript}” package script inside quarantine.`
      : "Cordon will inspect package metadata with its fixed, non-networked probe.";
  const lifecycle = plan.mode === "install" && plan.lifecycleScripts.length
    ? `During installation, ${plan.lifecycleScripts.map((script) => `“${script.name}”`).join(", ")} ${plan.lifecycleScripts.length === 1 ? "will" : "may"} run.`
    : "Repository lifecycle scripts will not run automatically for this operation.";
  const network = plan.networkPolicy === "allowlist"
    ? "Network access will be restricted to the operator-approved package registries."
    : "Network access will be disabled and attempted connections will be recorded as blocked.";
  return [
    operation,
    lifecycle,
    network,
    "Fake credentials will be placed inside the environment to detect secret access.",
    `The run will stop after ${Math.round(plan.timeoutMs / 1_000)} seconds.`,
  ];
}

export async function createRecommendedExecutionPlan(input: {
  scan: ScanResult;
  repositoryRoot: string;
  repositoryLocator: string;
}): Promise<{ plan: ExecutionPlan | null; recommendation: ExecutionRecommendation }> {
  if (!await exists(path.join(input.repositoryRoot, "package.json"))) {
    return {
      plan: null,
      recommendation: {
        supported: false,
        action: "manual-review",
        title: "Static inspection is complete",
        rationale: "Cordon did not find a supported Node.js package entry point for controlled runtime observation. The static report remains available for manual review.",
        confirmation: [],
      },
    };
  }

  const options = await inspectExecutionOptions(input.repositoryRoot);
  const suspiciousLifecycle = input.scan.findings.some((finding) => finding.category === "lifecycle-script" && (finding.severity === "high" || finding.severity === "critical"));
  let mode: ExecutionMode;
  let scriptName: string | undefined;
  let rationale: string;

  if (suspiciousLifecycle) {
    mode = "install";
    rationale = "Static inspection found a review-worthy lifecycle script. Quarantine can show whether installation accesses seeded credentials, starts child processes, or attempts external communication.";
  } else if (options.lifecycleScripts.length) {
    mode = "install";
    rationale = "The repository declares installation lifecycle behaviour. Cordon recommends observing that automatic execution path before local installation.";
  } else {
    const priority = ["test", "check", "lint", "build", "start"];
    scriptName = priority.find((name) => options.scripts.includes(name));
    if (scriptName) {
      mode = "script";
      rationale = `Cordon selected the existing “${scriptName}” script as the safest useful repository-defined operation available for observation.`;
    } else {
      mode = "probe";
      rationale = "No installation lifecycle or supported review script was found. Cordon recommends a fixed metadata probe that does not execute repository scripts.";
    }
  }

  const networkPolicy: NetworkPolicy = mode === "install" && registryAllowlistReady() ? "allowlist" : "disabled";
  const plan = await createExecutionPlan({
    scanId: input.scan.id,
    repositoryRoot: input.repositoryRoot,
    repositoryLocator: input.repositoryLocator,
    mode,
    scriptName,
    networkPolicy,
  });
  const publicPlan = publicExecutionPlan(plan);
  return {
    plan,
    recommendation: {
      planId: plan.id,
      supported: true,
      action: "quarantine",
      title: input.scan.verdict === "low-risk" ? "Quarantine can reduce the remaining uncertainty" : "Run this repository in quarantine",
      rationale,
      confirmation: confirmationForPlan(publicPlan),
      plan: publicPlan,
    },
  };
}

async function installCommand(repositoryRoot: string, manager: PackageManager): Promise<string[]> {
  if (manager === "npm") return await exists(path.join(repositoryRoot, "package-lock.json"))
    ? ["npm", "ci", "--no-audit", "--no-fund"]
    : ["npm", "install", "--no-audit", "--no-fund"];
  if (manager === "pnpm") return ["pnpm", "install", "--frozen-lockfile"];
  return ["yarn", "install", "--immutable"];
}

function scriptCommand(manager: PackageManager, scriptName: string): string[] {
  if (manager === "npm") return ["npm", "run", scriptName, "--"];
  return [manager, "run", scriptName];
}

export async function createExecutionPlan(input: {
  scanId: string;
  repositoryRoot: string;
  repositoryLocator: string;
  mode: ExecutionMode;
  scriptName?: string;
  networkPolicy?: NetworkPolicy;
}): Promise<ExecutionPlan> {
  const manifest = await readPackageJson(input.repositoryRoot);
  const scripts = packageScripts(manifest);
  const packageManager = await detectPackageManager(input.repositoryRoot, manifest);
  const planId = crypto.randomUUID();
  const networkPolicy = input.networkPolicy ?? "disabled";
  let command: string[];
  let selectedScript: string | undefined;
  if (input.mode === "install") {
    command = await installCommand(input.repositoryRoot, packageManager);
  } else if (input.mode === "probe") {
    command = ["node", "/cordon/probe.cjs"];
  } else {
    selectedScript = validateScriptName(input.scriptName ?? "");
    if (!Object.hasOwn(scripts, selectedScript)) throw new Error("The selected script is not present in this repository's package.json.");
    command = scriptCommand(packageManager, selectedScript);
  }

  const plan: ExecutionPlan = {
    id: planId,
    scanId: input.scanId,
    repositoryPath: input.repositoryLocator,
    runtime: "node",
    mode: input.mode,
    packageManager,
    command,
    ...DEFAULT_QUARANTINE_LIMITS,
    networkPolicy,
    allowedDomains: networkPolicy === "allowlist" ? configuredRegistryDomains() : [],
    canaries: createCanaries(planId),
    selectedScript,
    lifecycleScripts: LIFECYCLE_NAMES.filter((name) => scripts[name]).map((name) => ({ name, command: scripts[name] })),
    createdAt: new Date().toISOString(),
  };
  validateExecutionPlan(plan);
  return plan;
}

export function publicExecutionPlan(plan: ExecutionPlan): PublicExecutionPlan {
  const { repositoryPath: _repositoryPath, canaries, ...safe } = plan;
  void _repositoryPath;
  return { ...safe, canaries: canaries.map(({ marker: _marker, ...canary }) => { void _marker; return canary; }) };
}
