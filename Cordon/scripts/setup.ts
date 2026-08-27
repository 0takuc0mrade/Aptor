import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";

import { DockerRuntimeBootstrap } from "../lib/quarantine/bootstrap";

type Step = { name: string; status: "passed" | "unavailable" | "failed"; message: string };
const steps: Step[] = [];
const resolveFromProject = createRequire(path.join(process.cwd(), "package.json"));

function command(command: string, args: string[], timeoutMs = 120_000): Promise<{ code: number | null; output: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: process.cwd(), env: process.env });
    const output: Buffer[] = [];
    child.stdout.on("data", (chunk: Buffer) => output.push(chunk.subarray(0, 16_384)));
    child.stderr.on("data", (chunk: Buffer) => output.push(chunk.subarray(0, 16_384)));
    const timer = setTimeout(() => child.kill("SIGKILL"), timeoutMs);
    child.once("error", reject);
    child.once("close", (code) => { clearTimeout(timer); resolve({ code, output: Buffer.concat(output).toString("utf8").slice(-4_000) }); });
  });
}

async function main() {
  const major = Number.parseInt(process.versions.node.split(".")[0], 10);
  steps.push({ name: "Node.js", status: major >= 22 ? "passed" : "failed", message: major >= 22 ? `Node ${process.versions.node} satisfies the Node 22+ requirement.` : `Node ${process.versions.node} is unsupported; install Node 22 or newer.` });

  try {
    ["next/package.json", "typescript/package.json", "zod/package.json"].forEach((name) => resolveFromProject.resolve(name));
    steps.push({ name: "Dependencies", status: "passed", message: "The locked core application dependencies are available." });
  } catch {
    steps.push({ name: "Dependencies", status: "failed", message: "Core dependencies are missing. Resolve the npm install error, then run npm run setup again." });
  }

  steps.push({
    name: "Environment",
    status: "passed",
    message: `${process.env.DATABASE_URL ? "DATABASE_URL is configured." : "DATABASE_URL is optional; Cordon will use in-memory persistence."} ${process.env.GITHUB_TOKEN ? "GITHUB_TOKEN is configured." : "GITHUB_TOKEN is optional; unauthenticated GitHub rate limits apply."}`,
  });

  if (!steps.some((step) => step.name === "Dependencies" && step.status === "failed")) {
    let prismaAvailable = true;
    try {
      ["prisma/package.json", "@prisma/client/package.json"].forEach((name) => resolveFromProject.resolve(name));
    } catch {
      prismaAvailable = false;
    }
    if (prismaAvailable) {
      const generated = await command("npm", ["run", "db:generate"]);
      steps.push({ name: "Prisma client", status: generated.code === 0 ? "passed" : "failed", message: generated.code === 0 ? "Prisma client generation completed." : `Prisma client generation failed: ${generated.output}` });
    } else {
      steps.push({ name: "Prisma client", status: process.env.DATABASE_URL ? "failed" : "unavailable", message: process.env.DATABASE_URL ? "Prisma packages are missing, so configured database persistence cannot start." : "Prisma packages are not installed in this environment. In-memory persistence remains available." });
    }
    if (process.env.DATABASE_URL && prismaAvailable) {
      const migrated = await command("npm", ["run", "db:deploy"]);
      steps.push({ name: "Database migrations", status: migrated.code === 0 ? "passed" : "failed", message: migrated.code === 0 ? "Configured development migrations were applied." : `Database migration failed: ${migrated.output}` });
    } else if (!process.env.DATABASE_URL) {
      steps.push({ name: "Database migrations", status: "unavailable", message: "Skipped because DATABASE_URL is not configured. In-memory persistence remains available." });
    } else {
      steps.push({ name: "Database migrations", status: "failed", message: "Skipped because Prisma is unavailable for the configured database." });
    }
  }

  const runtime = await new DockerRuntimeBootstrap().ensure({ wait: true, retry: true });
  steps.push({ name: "Quarantine runtime", status: runtime.available ? "passed" : "unavailable", message: runtime.message });

  const readiness = await new DockerRuntimeBootstrap().inspect();
  steps.push({ name: "Readiness", status: readiness.available ? "passed" : "unavailable", message: readiness.message });

  process.stdout.write("Cordon setup\n\n");
  for (const step of steps) process.stdout.write(`${step.status === "passed" ? "PASS" : step.status === "failed" ? "FAIL" : "WAIT"}  ${step.name} — ${step.message}\n`);
  if (steps.some((step) => step.status === "failed")) process.exitCode = 1;
  else if (!readiness.available) process.exitCode = 2;
}

void main().catch((error) => {
  process.stderr.write(`Cordon setup failed: ${error instanceof Error ? error.message : "unknown failure"}\n`);
  process.exitCode = 1;
});
