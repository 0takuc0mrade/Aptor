const { spawnSync } = require("node:child_process");
spawnSync(process.execPath, ["-e", "process.stdout.write('child-ok\\n')"], { stdio: "inherit" });
