import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const projectRoot = path.resolve(import.meta.dirname, "..");
const outputRoot = await mkdtemp(path.join(tmpdir(), "cordon-tests-"));

async function filesUnder(directory, extension = ".ts") {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await filesUnder(target, extension)));
    else if (entry.name.endsWith(extension)) files.push(target);
  }
  return files;
}

try {
  const sourceFiles = [
    ...(await filesUnder(path.join(projectRoot, "lib", "scanner"))),
    ...(await filesUnder(path.join(projectRoot, "lib", "github"))).filter((file) => !file.endsWith("client.ts")),
    ...(await filesUnder(path.join(projectRoot, "lib", "quarantine"))),
    ...(await filesUnder(path.join(projectRoot, "lib", "inspection"))),
    ...(await filesUnder(path.join(projectRoot, "lib", "reports"))),
    path.join(projectRoot, "lib", "db", "quarantine.ts"),
    path.join(projectRoot, "lib", "db", "inspections.ts"),
    path.join(projectRoot, "lib", "db", "scans.ts"),
    path.join(projectRoot, "lib", "db", "fallback.ts"),
    path.join(projectRoot, "lib", "db", "runtime.ts"),
  ];
  const tscPath = require.resolve("typescript/lib/tsc.js");
  const nodeTypesRoot = path.dirname(path.dirname(require.resolve("@types/node/package.json")));
  const nodeModulesRoot = path.dirname(path.dirname(require.resolve("zod/package.json")));
  const compile = spawnSync(
    process.execPath,
    [
      tscPath,
      "--ignoreConfig",
      "--ignoreDeprecations", "6.0",
      "--target", "ES2022",
      "--module", "commonjs",
      "--moduleResolution", "node",
      "--outDir", outputRoot,
      "--esModuleInterop",
      "--skipLibCheck",
      "--types", "node",
      "--typeRoots", nodeTypesRoot,
      ...sourceFiles,
    ],
    { cwd: projectRoot, encoding: "utf8" },
  );
  if (compile.status !== 0) {
    if (compile.error) process.stderr.write(`${compile.error.message}\n`);
    process.stderr.write(compile.stdout);
    process.stderr.write(compile.stderr);
    process.exitCode = compile.status ?? 1;
  } else {
    const compiledFiles = await filesUnder(outputRoot, ".js");
    const tests = compiledFiles.filter((file) => file.endsWith(".test.js"));
    if (tests.length === 0) throw new Error("The test compile produced no runnable test files.");
    process.stdout.write(`Running ${tests.length} compiled test files.\n`);
    const run = spawnSync(process.execPath, ["--test", ...tests], {
      cwd: projectRoot,
      env: { ...process.env, DATABASE_URL: "", OPENAI_API_KEY: "", NODE_PATH: nodeModulesRoot },
      stdio: "inherit",
    });
    process.exitCode = run.status ?? 1;
  }
} finally {
  await rm(outputRoot, { recursive: true, force: true });
}
