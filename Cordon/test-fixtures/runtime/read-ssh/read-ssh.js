const fs = require("node:fs");
fs.readFileSync("/home/cordon/.ssh/id_ed25519", "utf8");
process.stdout.write("Read the seeded SSH fixture.\n");
