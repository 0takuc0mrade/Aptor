import { getLatestQuarantineRun } from "./quarantine";
import { withDatabaseFallback } from "./fallback";
import { loadPrisma } from "./runtime";
import type { InspectionRecord, ScanHistoryItem } from "../inspection/types";

type InspectionMemory = {
  records: Map<string, InspectionRecord>;
  bySubmission: Map<string, string>;
};

const globalMemory = globalThis as unknown as { cordonInspectionMemory?: InspectionMemory };
const memory = globalMemory.cordonInspectionMemory ?? { records: new Map(), bySubmission: new Map() };
globalMemory.cordonInspectionMemory = memory;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function databaseRecord(record: Record<string, unknown>): InspectionRecord {
  return clone(record.state as InspectionRecord);
}

async function persist(record: InspectionRecord): Promise<void> {
  const prisma = await loadPrisma();
  await prisma.inspection.upsert({
    where: { id: record.id },
    update: {
      repositoryUrl: record.repositoryUrl,
      owner: record.owner,
      name: record.name,
      source: record.source,
      demoKey: record.demoKey,
      status: record.status,
      currentStage: record.currentStage,
      state: clone(record),
      startedAt: record.startedAt ? new Date(record.startedAt) : null,
      completedAt: record.completedAt ? new Date(record.completedAt) : null,
      updatedAt: new Date(record.updatedAt),
    },
    create: {
      id: record.id,
      submissionKey: record.submissionKey,
      repositoryUrl: record.repositoryUrl,
      owner: record.owner,
      name: record.name,
      source: record.source,
      demoKey: record.demoKey,
      status: record.status,
      currentStage: record.currentStage,
      state: clone(record),
      createdAt: new Date(record.createdAt),
      startedAt: record.startedAt ? new Date(record.startedAt) : null,
      completedAt: record.completedAt ? new Date(record.completedAt) : null,
      updatedAt: new Date(record.updatedAt),
    },
  });
}

export async function createInspection(record: InspectionRecord): Promise<{ record: InspectionRecord; created: boolean }> {
  const existingId = memory.bySubmission.get(record.submissionKey);
  if (existingId) return { record: clone(memory.records.get(existingId)!), created: false };

  if (process.env.DATABASE_URL) {
    const existing = await withDatabaseFallback(async () => {
      const prisma = await loadPrisma();
      return await prisma.inspection.findUnique({ where: { submissionKey: record.submissionKey }, select: { state: true } }) as Record<string, unknown> | null;
    }, () => null);
    if (existing) {
      const hydrated = databaseRecord(existing);
      memory.records.set(hydrated.id, hydrated);
      memory.bySubmission.set(hydrated.submissionKey, hydrated.id);
      return { record: clone(hydrated), created: false };
    }
  }

  memory.records.set(record.id, clone(record));
  memory.bySubmission.set(record.submissionKey, record.id);
  if (process.env.DATABASE_URL) await withDatabaseFallback(() => persist(record), () => undefined);
  return { record: clone(record), created: true };
}

export async function getInspection(id: string): Promise<InspectionRecord | null> {
  let record = memory.records.get(id) ?? null;
  if (!record && process.env.DATABASE_URL) {
    const found = await withDatabaseFallback(async () => {
      const prisma = await loadPrisma();
      return await prisma.inspection.findUnique({ where: { id }, select: { state: true } }) as Record<string, unknown> | null;
    }, () => null);
    if (found) {
      record = databaseRecord(found);
      memory.records.set(record.id, record);
      memory.bySubmission.set(record.submissionKey, record.id);
    }
  }
  if (!record) return null;
  const latestRun = record.scan ? await getLatestQuarantineRun(record.id) : null;
  return clone({ ...record, latestRun });
}

export async function updateInspection(id: string, update: Partial<InspectionRecord> | ((record: InspectionRecord) => InspectionRecord)): Promise<InspectionRecord> {
  const current = await getInspection(id);
  if (!current) throw new Error("Inspection not found.");
  const base = { ...current, latestRun: undefined };
  const next = typeof update === "function" ? update(base) : { ...base, ...update, id: base.id, submissionKey: base.submissionKey };
  next.updatedAt = next.updatedAt || new Date().toISOString();
  memory.records.set(id, clone(next));
  if (process.env.DATABASE_URL) await withDatabaseFallback(() => persist(next), () => undefined);
  return clone(next);
}

function historyItem(record: InspectionRecord): ScanHistoryItem {
  return {
    id: record.id,
    repositoryUrl: record.repositoryUrl,
    owner: record.owner,
    name: record.name,
    source: record.source,
    commitHash: record.scan?.repository.commitHash,
    stage: record.currentStage,
    status: record.status,
    staticVerdict: record.scan?.verdict,
    runtimeVerdict: record.latestRun?.result?.verdict,
    runtimeStatus: record.latestRun?.status,
    completedAt: record.latestRun?.completedAt ?? record.completedAt,
    updatedAt: record.latestRun?.completedAt ?? record.updatedAt,
  };
}

export async function listRecentInspections(limit = 12): Promise<ScanHistoryItem[]> {
  let records = [...memory.records.values()];
  if (process.env.DATABASE_URL) {
    const databaseRecords = await withDatabaseFallback(async () => {
      const prisma = await loadPrisma();
      return await prisma.inspection.findMany({ orderBy: { updatedAt: "desc" }, take: limit, select: { state: true } }) as Array<Record<string, unknown>>;
    }, () => [] as Array<Record<string, unknown>>);
    for (const found of databaseRecords) {
      const record = databaseRecord(found);
      memory.records.set(record.id, record);
      memory.bySubmission.set(record.submissionKey, record.id);
    }
    records = [...new Map([...records, ...databaseRecords.map(databaseRecord)].map((record) => [record.id, record])).values()];
  }
  const hydrated = await Promise.all(records.map(async (record) => ({ ...record, latestRun: record.scan ? await getLatestQuarantineRun(record.id) : null })));
  return hydrated.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, limit).map(historyItem);
}

export async function resetDemoInspections(): Promise<number> {
  const ids = [...memory.records.values()].filter((record) => record.source === "demo").map((record) => record.id);
  for (const id of ids) {
    const record = memory.records.get(id);
    if (record) memory.bySubmission.delete(record.submissionKey);
    memory.records.delete(id);
  }
  if (process.env.DATABASE_URL) {
    await withDatabaseFallback(async () => {
      const prisma = await loadPrisma();
      const found = await prisma.inspection.findMany({ where: { source: "demo" }, select: { id: true } }) as Array<{ id: string }>;
      const databaseIds = found.map((item) => item.id);
      if (databaseIds.length) await prisma.scan.deleteMany({ where: { id: { in: databaseIds } } });
      await prisma.inspection.deleteMany({ where: { source: "demo" } });
    }, () => undefined);
  }
  return ids.length;
}

export function clearInspectionMemoryForTests(): void {
  memory.records.clear();
  memory.bySubmission.clear();
}
