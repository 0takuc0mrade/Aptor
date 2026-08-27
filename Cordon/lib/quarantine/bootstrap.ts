import path from "node:path";

import { DockerCliExecutor, type DockerCommandExecutor } from "./docker-cli";
import { QUARANTINE_IMAGE, QUARANTINE_IMAGE_LABEL, QUARANTINE_RUNTIME_VERSION } from "./policy";
import type { DockerReadiness } from "./types";

type BootstrapMemory = {
  build?: Promise<DockerReadiness>;
  lastFailure?: string;
};

const globalBootstrap = globalThis as unknown as { cordonRuntimeBootstrap?: BootstrapMemory };
const bootstrapMemory = globalBootstrap.cordonRuntimeBootstrap ?? {};
globalBootstrap.cordonRuntimeBootstrap = bootstrapMemory;

function unavailable(message: string, version?: string): DockerReadiness {
  return {
    state: "unavailable",
    available: false,
    version,
    image: QUARANTINE_IMAGE,
    imageVerified: false,
    allowlistConfigured: false,
    retryable: true,
    message,
  };
}

export class DockerRuntimeBootstrap {
  constructor(private readonly executor: DockerCommandExecutor = new DockerCliExecutor()) {}

  async inspect(): Promise<DockerReadiness> {
    try {
      const version = await this.executor.run(["version", "--format", "{{.Server.Version}}"], { timeoutMs: 5_000, outputLimitBytes: 4_096 });
      if (version.exitCode !== 0) return unavailable("Quarantine is unavailable because the isolated runtime could not start. Static inspection remains available.");
      const serverVersion = version.stdout.trim();
      const image = await this.executor.run(["image", "inspect", QUARANTINE_IMAGE, "--format", `{{index .Config.Labels "${QUARANTINE_IMAGE_LABEL}"}}`], { timeoutMs: 5_000, outputLimitBytes: 4_096 });
      const verified = image.exitCode === 0 && image.stdout.trim() === QUARANTINE_RUNTIME_VERSION;
      if (!verified) return unavailable("The isolated runtime image is not prepared yet.", serverVersion);
      return {
        state: "ready",
        available: true,
        version: serverVersion,
        image: QUARANTINE_IMAGE,
        imageVerified: true,
        allowlistConfigured: Boolean(process.env.CORDON_QUARANTINE_NETWORK && process.env.CORDON_REGISTRY_PROXY_URL && process.env.CORDON_QUARANTINE_ALLOWLIST_ENFORCED === "1"),
        retryable: false,
        message: "Quarantine is ready.",
      };
    } catch (error) {
      const missing = error instanceof Error && (error as NodeJS.ErrnoException).code === "ENOENT";
      return unavailable(missing
        ? "Quarantine is unavailable because Docker is not installed or is not on PATH. Static inspection remains available."
        : "Quarantine is unavailable because the isolated runtime could not start. Static inspection remains available.");
    }
  }

  async build(): Promise<DockerReadiness> {
    const current = await this.inspect();
    if (current.available) return current;
    const build = await this.executor.run([
      "build",
      "--file", path.join(process.cwd(), "docker", "quarantine.Dockerfile"),
      "--tag", QUARANTINE_IMAGE,
      "--label", `${QUARANTINE_IMAGE_LABEL}=${QUARANTINE_RUNTIME_VERSION}`,
      process.cwd(),
    ], { timeoutMs: 10 * 60_000, outputLimitBytes: 64_000 });
    if (build.exitCode !== 0) {
      bootstrapMemory.lastFailure = (build.stderr || build.stdout || "Docker image build failed.").slice(-2_000);
      return unavailable("Cordon could not prepare the isolated runtime. Static inspection remains available; open troubleshooting for one local setup action.", current.version);
    }
    bootstrapMemory.lastFailure = undefined;
    return this.inspect();
  }

  async ensure(options: { wait?: boolean; retry?: boolean } = {}): Promise<DockerReadiness> {
    const current = await this.inspect();
    if (current.available) return current;
    if (bootstrapMemory.lastFailure && !options.retry && !bootstrapMemory.build) return current;
    if (!bootstrapMemory.build) {
      bootstrapMemory.build = this.build().finally(() => { bootstrapMemory.build = undefined; });
    }
    if (options.wait) return bootstrapMemory.build;
    return {
      ...current,
      state: "preparing",
      retryable: false,
      message: "Preparing the isolated runtime.",
    };
  }
}

export function runtimeBootstrapFailure(): string | undefined {
  return bootstrapMemory.lastFailure;
}
