import { cp, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { redactCanaries, seedCanaryTree } from "../canaries";
import { DockerCliExecutor, type DockerCommandExecutor } from "../docker-cli";
import { DockerRuntimeBootstrap } from "../bootstrap";
import { dockerPolicyArguments, imageIsPinned, QUARANTINE_IMAGE } from "../policy";
import { canaryManifest, outputEvents, parseTelemetryOutput, probeSource, telemetryEnvironment, telemetryPreloadSource } from "../telemetry";
import type { DockerReadiness, ExecutionPlan, QuarantineResult, QuarantineRunner, RuntimeEvent, RuntimeObserver, TerminationReason } from "../types";
import { runtimeFindings } from "../verdict";

export { DockerCliExecutor, type DockerCommandExecutor } from "../docker-cli";

function policyEvent(type: RuntimeEvent["type"], evidence: string, outcome: RuntimeEvent["outcome"] = "observed"): RuntimeEvent {
  const timestamp = new Date().toISOString();
  return { id: crypto.randomUUID(), timestamp, type, outcome, evidence };
}

function safeError(error: unknown, plan: ExecutionPlan, containerName: string): string {
  const message = error instanceof Error ? error.message : "The Docker quarantine failed.";
  return redactCanaries(message.replaceAll(plan.repositoryPath, "[worker-managed repository]").replaceAll(containerName, "[container]"), plan.canaries).slice(0, 2_000);
}

export class DockerQuarantineRunner implements QuarantineRunner {
  constructor(private readonly executor: DockerCommandExecutor = new DockerCliExecutor()) {}

  async readiness(): Promise<DockerReadiness> {
    return new DockerRuntimeBootstrap(this.executor).inspect();
  }

  async run(plan: ExecutionPlan, observer?: RuntimeObserver): Promise<QuarantineResult> {
    const runId = crypto.randomUUID();
    const startedAt = new Date().toISOString();
    const containerName = `cordon-${runId.replaceAll("-", "").slice(0, 20)}`;
    const stageRoot = await mkdtemp(path.join(tmpdir(), "cordon-quarantine-"));
    let containerCreated = false;
    let cleanupCompleted = false;
    let terminationReason: TerminationReason = "failed";
    let exitCode: number | null = null;
    let stdout = "";
    let stderr = "";
    const events: RuntimeEvent[] = [];
    let outputTruncated = false;

    try {
      await observer?.onStage?.("creating-environment");
      const readiness = await this.readiness();
      if (!readiness.available) {
        terminationReason = "engine-unavailable";
        events.push(policyEvent("policy-violation", readiness.message, "blocked"));
        throw new Error(readiness.message);
      }
      if (!path.isAbsolute(plan.repositoryPath)) throw new Error("The worker did not materialize the managed repository before execution.");

      const cordonRoot = path.join(stageRoot, "cordon");
      await observer?.onStage?.("preparing-repository");
      await mkdir(path.join(stageRoot, "workspace", "repository"), { recursive: true, mode: 0o755 });
      await mkdir(cordonRoot, { recursive: true, mode: 0o755 });
      await cp(plan.repositoryPath, path.join(stageRoot, "workspace", "repository"), { recursive: true, errorOnExist: false, force: false });
      await observer?.onStage?.("seeding-canaries");
      await seedCanaryTree(stageRoot, plan.canaries);
      await writeFile(path.join(cordonRoot, "preload.cjs"), telemetryPreloadSource(), { mode: 0o644, flag: "wx" });
      await writeFile(path.join(cordonRoot, "probe.cjs"), probeSource(), { mode: 0o644, flag: "wx" });
      await writeFile(path.join(cordonRoot, "canaries.json"), canaryManifest(plan.canaries), { mode: 0o600, flag: "wx" });

      const createArgs = [
        ...dockerPolicyArguments(plan, containerName),
        ...telemetryEnvironment(plan),
        QUARANTINE_IMAGE,
        ...plan.command,
      ];
      const created = await this.executor.run(createArgs, { timeoutMs: 15_000, outputLimitBytes: 16_384 });
      if (created.exitCode !== 0) {
        terminationReason = /allowlist/i.test(created.stderr) ? "policy-refusal" : "failed";
        throw new Error(created.stderr || "Docker refused to create the quarantine container.");
      }
      containerCreated = true;
      const copied = await this.executor.run(["cp", `${stageRoot}/.`, `${containerName}:/`], { timeoutMs: 30_000, outputLimitBytes: 16_384 });
      if (copied.exitCode !== 0) throw new Error(copied.stderr || "Docker could not copy the repository into disposable storage.");

      events.push(policyEvent("process-start", `Started selected command: ${plan.command.join(" ")}`));
      await observer?.onEvent?.(events.at(-1)!);
      await observer?.onStage?.("running-operation");
      const stop = async () => { await this.executor.run(["kill", containerName], { timeoutMs: 5_000, outputLimitBytes: 4_096 }).catch(() => undefined); };
      const executed = await this.executor.run(["start", "--attach", containerName], {
        timeoutMs: plan.timeoutMs,
        outputLimitBytes: plan.outputLimitBytes,
        onForcedStop: stop,
      });
      await observer?.onStage?.("observing-activity");
      const inspected = await this.executor.run(["inspect", containerName, "--format", "{{.State.ExitCode}}"], { timeoutMs: 5_000, outputLimitBytes: 4_096 }).catch(() => null);
      const inspectedExitCode = Number.parseInt(inspected?.stdout.trim() ?? "", 10);
      exitCode = Number.isInteger(inspectedExitCode) ? inspectedExitCode : executed.exitCode;
      outputTruncated = executed.outputTruncated;
      terminationReason = executed.timedOut ? "timeout" : executed.outputTruncated ? "output-limit" : exitCode === 0 ? "completed" : "failed";

      for (const canary of plan.canaries) {
        if (executed.stdout.includes(canary.marker) || executed.stderr.includes(canary.marker)) {
          events.push({
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            type: "canary-propagation",
            canaryId: canary.id,
            outcome: "observed",
            evidence: `Seeded ${canary.label} appeared in process output. This shows disclosure to output, not network transmission.`,
          });
        }
      }
      stdout = redactCanaries(executed.stdout, plan.canaries);
      const parsed = parseTelemetryOutput(redactCanaries(executed.stderr, plan.canaries));
      stderr = parsed.stderr;
      const observedEvents = [...parsed.events, ...outputEvents(stdout, stderr)];
      events.push(...observedEvents);
      for (const event of observedEvents) await observer?.onEvent?.(event);
      events.push(policyEvent("process-exit", `Selected command ended with exit code ${exitCode ?? "unknown"}; termination=${terminationReason}.`, terminationReason === "completed" ? "observed" : "blocked"));
      await observer?.onEvent?.(events.at(-1)!);
    } catch (error) {
      if (terminationReason === "failed" && (error as NodeJS.ErrnoException).code === "ENOENT") terminationReason = "engine-unavailable";
      stderr = safeError(error, plan, containerName);
      events.push(policyEvent("policy-violation", stderr, "blocked"));
      await observer?.onEvent?.(events.at(-1)!);
    } finally {
      await observer?.onStage?.("stopping-environment");
      if (containerCreated) {
        const removed = await this.executor.run(["rm", "--force", containerName], { timeoutMs: 10_000, outputLimitBytes: 8_192 }).catch(() => null);
        cleanupCompleted = removed?.exitCode === 0;
      } else {
        cleanupCompleted = true;
      }
      await rm(stageRoot, { recursive: true, force: true });
    }

    const findings = runtimeFindings(events, terminationReason);
    return {
      runId,
      scanId: plan.scanId,
      planId: plan.id,
      status: terminationReason === "completed" ? "completed" : "failed",
      startedAt,
      completedAt: new Date().toISOString(),
      terminationReason,
      events,
      findings,
      stdout,
      stderr,
      verdict: "inconclusive",
      container: {
        engine: "docker",
        image: QUARANTINE_IMAGE,
        imagePinned: imageIsPinned(QUARANTINE_IMAGE),
        startedAt,
        completedAt: new Date().toISOString(),
        exitCode,
        outputTruncated,
        cleanupCompleted,
      },
      limitations: [
        "Node preload telemetry observes supported Node.js APIs; native binaries and code that bypasses those APIs may not be attributed completely.",
        "Docker containers reduce exposure but are not treated as a perfect security boundary.",
        "A blocked or absent event does not prove the same behavior cannot occur under different conditions.",
      ],
    };
  }
}
