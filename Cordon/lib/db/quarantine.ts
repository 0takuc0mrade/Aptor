import type { CombinedReport, ExecutionPlan, QuarantineResult, QuarantineRunRecord } from "../quarantine/types";
import { failRuntimeStage, initialRuntimeStages } from "../quarantine/progress";

import { withDatabaseFallback } from "./fallback";
import { loadPrisma } from "./runtime";

type QuarantineMemory = {
  plans: Map<string, ExecutionPlan>;
  runs: Map<string, QuarantineRunRecord>;
  runsByPlan: Map<string, string[]>;
  reports: Map<string, CombinedReport>;
};
const globalMemory = globalThis as unknown as { cordonQuarantineMemory?: QuarantineMemory };
const store: QuarantineMemory = globalMemory.cordonQuarantineMemory ?? {
  plans: new Map<string, ExecutionPlan>(),
  runs: new Map<string, QuarantineRunRecord>(),
  runsByPlan: new Map<string, string[]>(),
  reports: new Map<string, CombinedReport>(),
};
globalMemory.cordonQuarantineMemory = store;
const { plans, runs, runsByPlan, reports } = store;

function jsonValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export async function saveExecutionPlan(plan: ExecutionPlan): Promise<void> {
  plans.set(plan.id, plan);
  if (!process.env.DATABASE_URL) return;
  await withDatabaseFallback(async () => {
    const prisma = await loadPrisma();
    await prisma.quarantinePlan.create({
      data: {
        id: plan.id,
        scanId: plan.scanId,
        mode: plan.mode,
        runtime: plan.runtime,
        packageManager: plan.packageManager,
        command: plan.command,
        timeoutMs: plan.timeoutMs,
        memoryLimitMb: plan.memoryLimitMb,
        cpuLimit: plan.cpuLimit,
        processLimit: plan.processLimit,
        outputLimitBytes: plan.outputLimitBytes,
        networkPolicy: plan.networkPolicy,
        allowedDomains: plan.allowedDomains,
        lifecycleScripts: plan.lifecycleScripts,
        canaries: plan.canaries,
        plan: jsonValue(plan),
        createdAt: new Date(plan.createdAt),
      },
    });
  }, () => undefined);
}

export async function getExecutionPlan(id: string): Promise<ExecutionPlan | null> {
  const memory = plans.get(id);
  if (memory) return memory;
  if (!process.env.DATABASE_URL) return null;
  const record = await withDatabaseFallback(async () => {
    const prisma = await loadPrisma();
    return await prisma.quarantinePlan.findUnique({ where: { id }, select: { plan: true } }) as { plan: unknown } | null;
  }, () => null);
  return (record?.plan as ExecutionPlan | undefined) ?? null;
}

export async function getLatestExecutionPlan(scanId: string): Promise<ExecutionPlan | null> {
  const memory = [...plans.values()].filter((plan) => plan.scanId === scanId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  if (memory) return memory;
  if (!process.env.DATABASE_URL) return null;
  const record = await withDatabaseFallback(async () => {
    const prisma = await loadPrisma();
    return await prisma.quarantinePlan.findFirst({ where: { scanId }, orderBy: { createdAt: "desc" }, select: { plan: true } }) as { plan: unknown } | null;
  }, () => null);
  return (record?.plan as ExecutionPlan | undefined) ?? null;
}

export async function claimQuarantineRun(scanId: string, planId: string, options: { retry?: boolean } = {}): Promise<{ record: QuarantineRunRecord; created: boolean }> {
  const existingIds = runsByPlan.get(planId) ?? [];
  let latest = existingIds.map((id) => runs.get(id)!).sort((a, b) => b.attempt - a.attempt)[0];
  if (!latest && process.env.DATABASE_URL) {
    const found = await withDatabaseFallback(async () => {
      const prisma = await loadPrisma();
      return await prisma.quarantineRun.findFirst({ where: { planId }, orderBy: { attempt: "desc" }, select: { id: true, scanId: true, planId: true, status: true, stage: true, progress: true, attempt: true, createdAt: true, startedAt: true, completedAt: true, error: true, result: true } }) as Record<string, unknown> | null;
    }, () => null);
    if (found) {
      latest = await hydrateDatabaseRun(found);
      runs.set(latest.id, latest);
      runsByPlan.set(planId, [latest.id]);
    }
  }
  if (latest && (latest.status === "queued" || latest.status === "running" || !options.retry || latest.status !== "failed")) return { record: latest, created: false };
  const attempt = (latest?.attempt ?? 0) + 1;
  const record: QuarantineRunRecord = { id: crypto.randomUUID(), scanId, planId, status: "queued", attempt, stages: initialRuntimeStages(), events: [], createdAt: new Date().toISOString() };
  runs.set(record.id, record);
  runsByPlan.set(planId, [...existingIds, record.id]);
  if (process.env.DATABASE_URL) {
    const found = await withDatabaseFallback(async () => {
      const prisma = await loadPrisma();
      try {
        await prisma.quarantineRun.create({ data: { id: record.id, scanId, planId, status: record.status, attempt: record.attempt, progress: { stages: record.stages, events: record.events }, createdAt: new Date(record.createdAt) } });
        return null;
      } catch (error) {
        const duplicate = await prisma.quarantineRun.findFirst({ where: { planId, attempt }, select: { id: true, scanId: true, planId: true, status: true, stage: true, progress: true, attempt: true, createdAt: true, startedAt: true, completedAt: true, error: true, result: true } }) as Record<string, unknown> | null;
        if (!duplicate) throw error;
        return duplicate;
      }
    }, () => null);
    if (found) {
      const hydrated = await hydrateDatabaseRun(found);
      runs.delete(record.id);
      runs.set(hydrated.id, hydrated);
      runsByPlan.set(planId, [...existingIds, hydrated.id]);
      return { record: hydrated, created: false };
    }
  }
  return { record, created: true };
}

function databaseRun(record: Record<string, unknown>): QuarantineRunRecord {
  const progress = (record.progress && typeof record.progress === "object" ? record.progress : {}) as { stages?: QuarantineRunRecord["stages"]; events?: QuarantineRunRecord["events"] };
  return {
    id: String(record.id),
    scanId: String(record.scanId),
    planId: String(record.planId),
    status: record.status as QuarantineRunRecord["status"],
    attempt: typeof record.attempt === "number" ? record.attempt : 1,
    stage: typeof record.stage === "string" ? record.stage as QuarantineRunRecord["stage"] : undefined,
    stages: progress.stages ?? initialRuntimeStages(),
    events: progress.events ?? [],
    createdAt: new Date(record.createdAt as string | Date).toISOString(),
    startedAt: record.startedAt ? new Date(record.startedAt as string | Date).toISOString() : undefined,
    completedAt: record.completedAt ? new Date(record.completedAt as string | Date).toISOString() : undefined,
    error: typeof record.error === "string" ? record.error : undefined,
    result: (record.result as QuarantineResult | null) ?? undefined,
  };
}

const RESTART_RECOVERY_MESSAGE = "This quarantine attempt was interrupted when the Cordon application restarted. Static findings remain available. Retry intentionally to start a new disposable container.";

async function hydrateDatabaseRun(found: Record<string, unknown>): Promise<QuarantineRunRecord> {
  const hydrated = databaseRun(found);
  if (hydrated.status !== "queued" && hydrated.status !== "running") return hydrated;
  const completedAt = new Date().toISOString();
  const recovered: QuarantineRunRecord = {
    ...failRuntimeStage(hydrated, completedAt),
    status: "failed",
    completedAt,
    error: RESTART_RECOVERY_MESSAGE,
  };
  await withDatabaseFallback(async () => {
    const prisma = await loadPrisma();
    await prisma.quarantineRun.update({
      where: { id: recovered.id },
      data: {
        status: recovered.status,
        progress: { stages: recovered.stages, events: recovered.events },
        completedAt: new Date(completedAt),
        error: recovered.error,
      },
    });
  }, () => undefined);
  return recovered;
}

export async function updateQuarantineRun(id: string, update: Partial<QuarantineRunRecord>): Promise<QuarantineRunRecord> {
  const current = runs.get(id);
  if (!current) throw new Error("Quarantine run not found.");
  const next = { ...current, ...update, id: current.id, scanId: current.scanId, planId: current.planId };
  runs.set(id, next);
  if (process.env.DATABASE_URL) {
    await withDatabaseFallback(async () => {
      const prisma = await loadPrisma();
      await prisma.quarantineRun.update({
        where: { id },
        data: {
          status: next.status,
          stage: next.stage,
          attempt: next.attempt,
          progress: { stages: next.stages, events: next.events },
          startedAt: next.startedAt ? new Date(next.startedAt) : null,
          completedAt: next.completedAt ? new Date(next.completedAt) : null,
          error: next.error,
          result: next.result ? jsonValue(next.result) : undefined,
          terminationReason: next.result?.terminationReason,
          containerMetadata: next.result?.container,
          networkPolicy: next.result ? (await getExecutionPlan(next.planId))?.networkPolicy : undefined,
          runtimeEvents: next.result ? {
            deleteMany: {},
            create: next.result.events.map((event) => ({ externalId: event.id, timestamp: new Date(event.timestamp), type: event.type, processId: event.processId, parentProcessId: event.parentProcessId, command: event.command, filePath: event.filePath, destination: event.destination, canaryId: event.canaryId, outcome: event.outcome, evidence: event.evidence })),
          } : undefined,
          runtimeFindings: next.result ? {
            deleteMany: {},
            create: next.result.findings.map((finding) => ({ externalId: finding.id, ruleId: finding.ruleId, title: finding.title, description: finding.description, severity: finding.severity, category: finding.category, filePath: finding.filePath, evidence: finding.evidence, recommendation: finding.recommendation, runtimeEvidence: finding.runtime })),
          } : undefined,
        },
      });
    }, () => undefined);
  }
  return next;
}

export async function getQuarantineRun(id: string): Promise<QuarantineRunRecord | null> {
  const memory = runs.get(id);
  if (memory) return memory;
  if (!process.env.DATABASE_URL) return null;
  const found = await withDatabaseFallback(async () => {
    const prisma = await loadPrisma();
    return await prisma.quarantineRun.findUnique({ where: { id }, select: { id: true, scanId: true, planId: true, status: true, stage: true, progress: true, attempt: true, createdAt: true, startedAt: true, completedAt: true, error: true, result: true } }) as Record<string, unknown> | null;
  }, () => null);
  if (!found) return null;
  const hydrated = await hydrateDatabaseRun(found);
  runs.set(hydrated.id, hydrated);
  runsByPlan.set(hydrated.planId, [...(runsByPlan.get(hydrated.planId) ?? []), hydrated.id]);
  return hydrated;
}

export async function getLatestQuarantineRun(scanId: string): Promise<QuarantineRunRecord | null> {
  const memory = [...runs.values()].filter((run) => run.scanId === scanId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  if (memory) return memory;
  if (!process.env.DATABASE_URL) return null;
  const found = await withDatabaseFallback(async () => {
    const prisma = await loadPrisma();
    return await prisma.quarantineRun.findFirst({ where: { scanId }, orderBy: { createdAt: "desc" }, select: { id: true, scanId: true, planId: true, status: true, stage: true, progress: true, attempt: true, createdAt: true, startedAt: true, completedAt: true, error: true, result: true } }) as Record<string, unknown> | null;
  }, () => null);
  if (!found) return null;
  const hydrated = await hydrateDatabaseRun(found);
  runs.set(hydrated.id, hydrated);
  runsByPlan.set(hydrated.planId, [...new Set([...(runsByPlan.get(hydrated.planId) ?? []), hydrated.id])]);
  return hydrated;
}

export async function listQuarantineRuns(scanId: string): Promise<QuarantineRunRecord[]> {
  const memory = [...runs.values()].filter((run) => run.scanId === scanId);
  if (!process.env.DATABASE_URL) return memory.sort((a, b) => b.attempt - a.attempt);
  const found = await withDatabaseFallback(async () => {
    const prisma = await loadPrisma();
    return await prisma.quarantineRun.findMany({ where: { scanId }, orderBy: { createdAt: "desc" }, select: { id: true, scanId: true, planId: true, status: true, stage: true, progress: true, attempt: true, createdAt: true, startedAt: true, completedAt: true, error: true, result: true } }) as Array<Record<string, unknown>>;
  }, () => [] as Array<Record<string, unknown>>);
  if (!found.length) return memory.sort((a, b) => b.attempt - a.attempt);
  return Promise.all(found.map(hydrateDatabaseRun));
}

export async function saveCombinedReport(report: CombinedReport): Promise<void> {
  reports.set(report.runId, report);
  if (!process.env.DATABASE_URL) return;
  await withDatabaseFallback(async () => {
    const prisma = await loadPrisma();
    await prisma.quarantineRun.update({
      where: { id: report.runId },
      data: {
        combinedReport: jsonValue(report),
        explanation: report.explanation,
        attackPathNodes: {
          deleteMany: {},
          create: report.attackPaths.flatMap((attackPath) => (attackPath.nodes ?? []).map((node) => ({ externalId: node.id, pathId: attackPath.id, label: node.label, evidenceKind: node.evidenceKind, findingId: node.findingId, runtimeEventId: node.runtimeEventId, filePath: node.filePath, line: node.line, processId: node.processId, policyDecision: node.policyDecision }))),
        },
        attackPathEdges: {
          deleteMany: {},
          create: report.attackPaths.flatMap((attackPath) => (attackPath.edges ?? []).map((edge) => ({ externalId: edge.id, pathId: attackPath.id, sourceExternalId: edge.source, targetExternalId: edge.target, evidenceKind: edge.evidenceKind, label: edge.label }))),
        },
      },
    });
  }, () => undefined);
}

export async function getCombinedReport(runId: string): Promise<CombinedReport | null> {
  const memory = reports.get(runId);
  if (memory) return memory;
  if (!process.env.DATABASE_URL) return null;
  const found = await withDatabaseFallback(async () => {
    const prisma = await loadPrisma();
    return await prisma.quarantineRun.findUnique({ where: { id: runId }, select: { combinedReport: true } }) as { combinedReport: unknown } | null;
  }, () => null);
  return (found?.combinedReport as CombinedReport | undefined) ?? null;
}
