import type { ScanResult } from "../scanner/types";

import { loadPrisma } from "./runtime";
import { withDatabaseFallback } from "./fallback";

const globalMemory = globalThis as unknown as { cordonScanMemory?: Map<string, ScanResult> };
const memoryStore = globalMemory.cordonScanMemory ?? new Map<string, ScanResult>();
globalMemory.cordonScanMemory = memoryStore;

type TransactionDatabase = {
  repository: { upsert(input: Record<string, unknown>): Promise<{ id: string }> };
  scan: { create(input: Record<string, unknown>): Promise<unknown> };
};

async function persistWithPrisma(result: ScanResult): Promise<void> {
  const prisma = await loadPrisma();
  await prisma.$transaction(async (database: unknown) => {
    const transaction = database as TransactionDatabase;
    const repository = await transaction.repository.upsert({
      where: { url: result.repository.url },
      update: {
        owner: result.repository.owner,
        name: result.repository.name,
        defaultBranch: result.repository.defaultBranch,
      },
      create: {
        owner: result.repository.owner,
        name: result.repository.name,
        url: result.repository.url,
        defaultBranch: result.repository.defaultBranch,
      },
    });
    await transaction.scan.create({
      data: {
        id: result.id,
        repositoryId: repository.id,
        commitHash: result.repository.commitHash,
        status: result.status,
        startedAt: new Date(result.startedAt),
        completedAt: new Date(result.completedAt),
        filesScanned: result.filesScanned,
        rulesExecuted: result.rulesExecuted,
        severityTotals: result.severityTotals,
        overallScore: result.overallScore,
        verdict: result.verdict,
        attackPaths: result.attackPaths,
        result: result,
        findings: {
          create: result.findings.map((finding) => ({
            externalId: finding.id,
            ruleId: finding.ruleId,
            title: finding.title,
            description: finding.description,
            severity: finding.severity,
            category: finding.category,
            filePath: finding.filePath,
            startLine: finding.startLine,
            endLine: finding.endLine,
            evidence: finding.evidence,
            recommendation: finding.recommendation,
          })),
        },
      },
    });
  });
}

export async function saveScan(result: ScanResult): Promise<void> {
  memoryStore.set(result.id, result);
  if (!process.env.DATABASE_URL) return;
  await withDatabaseFallback(() => persistWithPrisma(result), () => undefined);
}

export async function getScan(id: string): Promise<ScanResult | null> {
  const memory = memoryStore.get(id);
  if (memory) return memory;
  if (!process.env.DATABASE_URL) return null;
  const record = await withDatabaseFallback(async () => {
    const prisma = await loadPrisma();
    return (await prisma.scan.findUnique({ where: { id }, select: { result: true } })) as { result: unknown } | null;
  }, () => null);
  return (record?.result as ScanResult | undefined) ?? null;
}

export async function listRecentScans(limit = 8): Promise<ScanResult[]> {
  if (process.env.DATABASE_URL) {
    const records = await withDatabaseFallback(async () => {
      const prisma = await loadPrisma();
      return (await prisma.scan.findMany({ orderBy: { startedAt: "desc" }, take: limit, select: { result: true } })) as Array<{ result: unknown }>;
    }, () => [] as Array<{ result: unknown }>);
    if (records.length) return records.map((record) => record.result as ScanResult);
  }
  return [...memoryStore.values()]
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    .slice(0, limit);
}
