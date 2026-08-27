import { spawn } from "node:child_process";

export type DockerCommandResult = {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  outputTruncated: boolean;
};

export type DockerCommandOptions = {
  timeoutMs?: number;
  outputLimitBytes?: number;
  onForcedStop?: () => Promise<void>;
};

export interface DockerCommandExecutor {
  run(args: string[], options?: DockerCommandOptions): Promise<DockerCommandResult>;
}

export class DockerCliExecutor implements DockerCommandExecutor {
  async run(args: string[], options: DockerCommandOptions = {}): Promise<DockerCommandResult> {
    return new Promise((resolve, reject) => {
      const child = spawn("docker", args, { env: process.env });
      child.stdin.end();
      const stdout: Buffer[] = [];
      const stderr: Buffer[] = [];
      let bytes = 0;
      let outputTruncated = false;
      let timedOut = false;
      let settled = false;
      const limit = options.outputLimitBytes ?? 1_048_576;

      const collect = (bucket: Buffer[], chunk: Buffer) => {
        if (bytes >= limit) return;
        const remaining = limit - bytes;
        bucket.push(chunk.subarray(0, remaining));
        bytes += Math.min(chunk.byteLength, remaining);
        if (chunk.byteLength > remaining || bytes >= limit) {
          outputTruncated = true;
          void options.onForcedStop?.();
          child.kill("SIGKILL");
        }
      };
      child.stdout.on("data", (chunk: Buffer) => collect(stdout, chunk));
      child.stderr.on("data", (chunk: Buffer) => collect(stderr, chunk));

      const timer = options.timeoutMs ? setTimeout(() => {
        timedOut = true;
        void options.onForcedStop?.();
        child.kill("SIGKILL");
      }, options.timeoutMs) : undefined;

      child.once("error", (error) => {
        if (timer) clearTimeout(timer);
        if (!settled) reject(error);
      });
      child.once("close", (code) => {
        settled = true;
        if (timer) clearTimeout(timer);
        resolve({ exitCode: code, stdout: Buffer.concat(stdout).toString("utf8"), stderr: Buffer.concat(stderr).toString("utf8"), timedOut, outputTruncated });
      });
    });
  }
}
