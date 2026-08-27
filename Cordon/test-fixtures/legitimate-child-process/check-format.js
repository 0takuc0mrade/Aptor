import { spawnSync } from "node:child_process";

const result = spawnSync("git", ["diff", "--check"], {
  cwd: process.cwd(),
  env: { PATH: process.env.PATH },
  encoding: "utf8",
});

process.exitCode = result.status ?? 1;
