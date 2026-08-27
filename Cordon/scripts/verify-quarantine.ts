import { DockerRuntimeBootstrap } from "../lib/quarantine/bootstrap";

const readiness = await new DockerRuntimeBootstrap().inspect();
process.stdout.write(`${JSON.stringify({
  state: readiness.state,
  dockerAvailable: Boolean(readiness.version),
  dockerVersion: readiness.version,
  runtimeImage: readiness.image,
  runtimeImageVerified: readiness.imageVerified,
  networkDisabledSupported: true,
  allowlistConfigured: readiness.allowlistConfigured,
  message: readiness.message,
}, null, 2)}\n`);
if (!readiness.available) process.exitCode = 2;
