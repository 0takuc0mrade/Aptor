import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const projectRoot = path.resolve(import.meta.dirname, "..");
const outputRoot = await mkdtemp(path.join(tmpdir(), "cordon-verify-"));
try {
  const tscPath = require.resolve("typescript/lib/tsc.js");
  const nodeTypesRoot = path.dirname(path.dirname(require.resolve("@types/node/package.json")));
  const compile = spawnSync(process.execPath, [tscPath, "--ignoreConfig", "--ignoreDeprecations", "6.0", "--target", "ES2022", "--module", "commonjs", "--moduleResolution", "node", "--outDir", outputRoot, "--esModuleInterop", "--skipLibCheck", "--types", "node", "--typeRoots", nodeTypesRoot, "scripts/verify-quarantine.ts", "lib/quarantine/bootstrap.ts", "lib/quarantine/docker-cli.ts", "lib/quarantine/policy.ts", "lib/quarantine/types.ts", "lib/scanner/types.ts"], { cwd: projectRoot, encoding: "utf8" });
  if (compile.status !== 0) {
    process.stderr.write(compile.stdout);
    process.stderr.write(compile.stderr);
    process.exitCode = compile.status ?? 1;
  } else {
    const run = spawnSync(process.execPath, [path.join(outputRoot, "scripts", "verify-quarantine.js")], { cwd: projectRoot, stdio: "inherit", env: process.env });
    process.exitCode = run.status ?? 1;
  }
} finally {
  await rm(outputRoot, { recursive: true, force: true });
}
