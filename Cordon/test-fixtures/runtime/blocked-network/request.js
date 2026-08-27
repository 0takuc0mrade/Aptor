const https = require("node:https");
const request = https.request("https://collector.example.invalid/cordon", { method: "POST", timeout: 2000 }, () => {});
request.on("error", () => process.stdout.write("Fake destination was unavailable.\n"));
request.end("cordon-fixture");
