import { claimQuarantineRun, getExecutionPlan, getQuarantineRun, saveCombinedReport, updateQuarantineRun } from "@/lib/db/quarantine";
import { getScan } from "@/lib/db/scans";
import { withInspectionRepositoryAtCommit } from "@/lib/inspection/source";
import { publicExecutionPlan } from "@/lib/quarantine/planner";
import { advanceRuntimeStage, appendRuntimeEvent, completeRuntimeStages, failRuntimeStage } from "@/lib/quarantine/progress";
import { LocalQuarantineRunner } from "@/lib/quarantine/runner";
import type { CombinedReport, QuarantineRunRecord, QuarantineRunner, QuarantineWorker } from "@/lib/quarantine/types";
import { buildCombinedAttackPaths, runtimeVerdict } from "@/lib/quarantine/verdict";

export class DirectQuarantineWorker implements QuarantineWorker {
  constructor(private readonly runner: QuarantineRunner = new LocalQuarantineRunner()) {}

  async start(scanId: string, planId: string, options: { retry?: boolean } = {}): Promise<QuarantineRunRecord> {
    const plan = await getExecutionPlan(planId);
    if (!plan || plan.scanId !== scanId) throw new Error("Execution plan not found for this scan.");
    const claimed = await claimQuarantineRun(scanId, planId, options);
    if (claimed.created) queueMicrotask(() => { void this.execute(claimed.record); });
    return claimed.record;
  }

  async runNow(scanId: string, planId: string): Promise<QuarantineRunRecord> {
    const plan = await getExecutionPlan(planId);
    if (!plan || plan.scanId !== scanId) throw new Error("Execution plan not found for this scan.");
    const claimed = await claimQuarantineRun(scanId, planId);
    if (!claimed.created && claimed.record.status !== "queued") return claimed.record;
    return this.execute(claimed.record);
  }

  private async execute(record: QuarantineRunRecord): Promise<QuarantineRunRecord> {
    const startedAt = new Date().toISOString();
    await updateQuarantineRun(record.id, { status: "running", startedAt });
    try {
      const [scan, plan] = await Promise.all([getScan(record.scanId), getExecutionPlan(record.planId)]);
      if (!scan || !plan || plan.scanId !== scan.id) throw new Error("The scan or execution plan is no longer available.");
      const result = await withInspectionRepositoryAtCommit(scan.repository, async (root, metadata) => {
        if (metadata.commitHash !== scan.repository.commitHash) throw new Error("Repository commit changed during quarantine materialization.");
        return this.runner.run({ ...plan, repositoryPath: root }, {
          onStage: async (stage) => {
            const current = await getQuarantineRun(record.id);
            if (current) await updateQuarantineRun(record.id, advanceRuntimeStage(current, stage));
          },
          onEvent: async (event) => {
            const current = await getQuarantineRun(record.id);
            if (current) await updateQuarantineRun(record.id, appendRuntimeEvent(current, event));
          },
        });
      });
      result.runId = record.id;
      result.verdict = runtimeVerdict(scan.verdict, result.findings, result);
      const beforeReport = await getQuarantineRun(record.id);
      if (beforeReport) await updateQuarantineRun(record.id, advanceRuntimeStage(beforeReport, "building-report"));
      const attackPaths = buildCombinedAttackPaths(scan, result);
      const report: CombinedReport = {
        scanId: scan.id,
        runId: record.id,
        staticFindings: scan.findings,
        runtimeFindings: result.findings,
        attackPaths,
        runtimeEvents: result.events,
        executionPlan: publicExecutionPlan(plan),
        verdict: result.verdict,
        explanation: null,
        safetyNotice: "Cordon observed this repository inside a restricted test environment. Behaviour may differ on another machine or under different conditions. A run that produces no suspicious events is not proof that the repository is safe.",
      };
      await saveCombinedReport(report);
      const latest = await getQuarantineRun(record.id) ?? record;
      return updateQuarantineRun(record.id, {
        ...completeRuntimeStages(latest, result.completedAt),
        status: result.status,
        completedAt: result.completedAt,
        result,
        events: result.events,
        error: result.status === "failed" ? result.stderr : undefined,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message.replace(/\/tmp\/cordon-[^\s/]+/g, "[worker-managed repository]").slice(0, 2_000) : "The quarantine worker failed.";
      const current = await getQuarantineRun(record.id) ?? record;
      return updateQuarantineRun(record.id, { ...failRuntimeStage(current), status: "failed", completedAt: new Date().toISOString(), error: message });
    }
  }
}

const globalWorker = globalThis as unknown as { cordonQuarantineWorker?: DirectQuarantineWorker };
export const quarantineWorker = globalWorker.cordonQuarantineWorker ?? new DirectQuarantineWorker();
globalWorker.cordonQuarantineWorker = quarantineWorker;
