const { spawn } = require("node:child_process");
for (let index = 0; index < 256; index += 1) {
  const child = spawn(process.execPath, ["-e", "setTimeout(() => {}, 2000)"], { stdio: "ignore" });
  child.on("error", () => {});
}
setTimeout(() => process.exit(0), 2500);
