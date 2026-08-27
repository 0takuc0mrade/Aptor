import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

const projectRoot = path.resolve(import.meta.dirname, "..");
const outputRoot = await mkdtemp(path.join(tmpdir(), "cordon-setup-"));
try {
  const tscPath = path.join(projectRoot, "node_modules", "typescript", "lib", "tsc.js");
  if (!existsSync(tscPath)) {
    process.stdout.write("Cordon dependencies are missing; installing the locked dependency set.\n");
    const install = spawnSync("npm", [existsSync(path.join(projectRoot, "package-lock.json")) ? "ci" : "install"], { cwd: projectRoot, stdio: "inherit", env: process.env });
    if (install.status !== 0) {
      process.stderr.write("Cordon could not install dependencies. Resolve the npm error above, then run npm run setup again.\n");
      if (!existsSync(tscPath)) throw new Error(`Dependency installation exited with ${install.status ?? "an unknown status"}.`);
      process.stderr.write("Continuing with the dependencies that are available so readiness can still be reported.\n");
    }
  }
  const nodeTypesRoot = path.join(projectRoot, "node_modules", "@types");
  const compile = spawnSync(process.execPath, [tscPath, "--ignoreConfig", "--ignoreDeprecations", "6.0", "--target", "ES2022", "--module", "commonjs", "--moduleResolution", "node", "--outDir", outputRoot, "--esModuleInterop", "--skipLibCheck", "--types", "node", "--typeRoots", nodeTypesRoot, "scripts/setup.ts", "lib/quarantine/bootstrap.ts", "lib/quarantine/docker-cli.ts", "lib/quarantine/policy.ts", "lib/quarantine/types.ts", "lib/scanner/types.ts"], { cwd: projectRoot, encoding: "utf8" });
  if (compile.status !== 0) {
    process.stderr.write(compile.stdout);
    process.stderr.write(compile.stderr);
    process.exitCode = compile.status ?? 1;
  } else {
    const run = spawnSync(process.execPath, [path.join(outputRoot, "scripts", "setup.js")], { cwd: projectRoot, stdio: "inherit", env: process.env });
    process.exitCode = run.status ?? 1;
  }
} finally {
  await rm(outputRoot, { recursive: true, force: true });
}
