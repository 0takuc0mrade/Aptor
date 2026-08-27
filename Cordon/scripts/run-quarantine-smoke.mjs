import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const projectRoot = path.resolve(import.meta.dirname, "..");
const outputRoot = await mkdtemp(path.join(tmpdir(), "cordon-smoke-"));

async function filesUnder(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await filesUnder(target));
    else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")) files.push(target);
  }
  return files;
}

try {
  const tscPath = require.resolve("typescript/lib/tsc.js");
  const nodeTypesRoot = path.dirname(path.dirname(require.resolve("@types/node/package.json")));
  const sources = [
    ...(await filesUnder(path.join(projectRoot, "lib", "quarantine"))),
    path.join(projectRoot, "lib", "scanner", "types.ts"),
    path.join(projectRoot, "scripts", "quarantine-smoke.ts"),
  ];
  const compile = spawnSync(process.execPath, [tscPath, "--ignoreConfig", "--ignoreDeprecations", "6.0", "--target", "ES2022", "--module", "commonjs", "--moduleResolution", "node", "--outDir", outputRoot, "--esModuleInterop", "--skipLibCheck", "--types", "node", "--typeRoots", nodeTypesRoot, ...sources], { cwd: projectRoot, encoding: "utf8" });
  if (compile.status !== 0) {
    process.stderr.write(compile.stdout);
    process.stderr.write(compile.stderr);
    process.exitCode = compile.status ?? 1;
  } else {
    const run = spawnSync(process.execPath, [path.join(outputRoot, "scripts", "quarantine-smoke.js"), process.argv[2] ?? "normal"], { cwd: projectRoot, env: process.env, stdio: "inherit" });
    process.exitCode = run.status ?? 1;
  }
} finally {
  await rm(outputRoot, { recursive: true, force: true });
}
