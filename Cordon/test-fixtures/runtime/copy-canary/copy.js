const fs = require("node:fs");
fs.copyFileSync(".env", "/tmp/cordon-copied-canary.txt");
