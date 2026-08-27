const { spawnSync } = require("node:child_process");

const child = spawnSync(process.execPath, ["child.js"], { cwd: __dirname, encoding: "utf8" });
process.stdout.write(child.stdout || "");
process.stderr.write(child.stderr || "");
process.exitCode = child.status ?? 1;
