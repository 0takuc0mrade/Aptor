const fs = require("node:fs");
fs.readFileSync(".env", "utf8");
process.stdout.write("Read the seeded dotenv fixture.\n");
