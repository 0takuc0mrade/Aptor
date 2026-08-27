import { createInspection, getInspection, updateInspection } from "../db/inspections";
import { saveExecutionPlan } from "../db/quarantine";
import { saveScan } from "../db/scans";
import { createRecommendedExecutionPlan } from "../quarantine/planner";
import { scanRepository } from "../scanner";
import { advanceInspectionStage, completeInspectionStages, failInspectionStage, initialInspectionStages } from "./stages";
import { withInspectionSource, type InspectionSource } from "./source";
import type { InspectionFailure, InspectionRecord, InspectionStageId } from "./types";

function inspectionFailure(error: unknown, staticAvailable: boolean): InspectionFailure {
  const message = error instanceof Error ? error.message : "Cordon could not complete the repository inspection.";
  if (/not find/i.test(message)) return { title: "Repository not found", message: "GitHub could not find that public repository. Confirm the owner and repository name, then retry.", retryable: true, staticAvailable, retryStartsNewContainer: false };
  if (/private/i.test(message)) return { title: "Private repository unavailable", message: "This milestone accepts public GitHub repositories only. No repository content was inspected.", retryable: false, staticAvailable, retryStartsNewContainer: false };
  if (/exceeds|size limit|oversized/i.test(message)) return { title: "Repository exceeds the inspection limit", message: "Cordon stopped before scanning because the archive exceeded a configured safety limit. No repository code was executed.", retryable: false, staticAvailable, retryStartsNewContainer: false };
  if (/archive|traversal|symbolic link|extract/i.test(message)) return { title: "Archive safety check rejected the repository", message: `${message} No repository code was executed.`, retryable: false, staticAvailable, retryStartsNewContainer: false };
  return { title: "Inspection incomplete", message: `${message} ${staticAvailable ? "Completed static findings remain available." : "No repository code was executed."}`, retryable: true, staticAvailable, retryStartsNewContainer: false };
}

async function move(id: string, stage: InspectionStageId): Promise<void> {
  await updateInspection(id, (record) => advanceInspectionStage(record, stage));
}

export class DirectInspectionWorker {
  async start(record: InspectionRecord): Promise<InspectionRecord> {
    queueMicrotask(() => { void this.execute(record.id); });
    return record;
  }

  async runNow(record: InspectionRecord): Promise<InspectionRecord> {
    return this.execute(record.id);
  }

  private async execute(id: string): Promise<InspectionRecord> {
    const record = await getInspection(id);
    if (!record) throw new Error("Inspection not found.");
    if (record.status === "completed") return record;
    const source: InspectionSource = { kind: record.source, repositoryUrl: record.repositoryUrl, demoKey: record.demoKey };
    let staticAvailable = Boolean(record.scan);
    try {
      const completed = await withInspectionSource(source, async (root, metadata) => {
        const scan = await scanRepository(root, metadata, undefined, {
          id: record.id,
          startedAt: record.startedAt ?? record.createdAt,
          onStage: (stage) => move(record.id, stage),
        });
        staticAvailable = true;
        await saveScan(scan);
        await updateInspection(record.id, { scan });
        await move(record.id, "preparing-quarantine-options");

        let recommendation;
        try {
          const planned = await createRecommendedExecutionPlan({
            scan,
            repositoryRoot: root,
            repositoryLocator: `managed://scan/${scan.id}/${scan.repository.commitHash}`,
          });
          if (planned.plan) await saveExecutionPlan(planned.plan);
          recommendation = planned.recommendation;
        } catch (error) {
          recommendation = {
            supported: false,
            action: "manual-review" as const,
            title: "Static inspection is complete",
            rationale: `Cordon could not create a safe runtime action: ${error instanceof Error ? error.message : "unsupported package configuration"} The static report remains available.`,
            confirmation: [],
          };
        }

        const current = await updateInspection(record.id, { scan, recommendation });
        return updateInspection(record.id, completeInspectionStages(current));
      }, (stage) => move(record.id, stage));
      return completed;
    } catch (error) {
      const current = await getInspection(record.id) ?? record;
      return updateInspection(record.id, failInspectionStage(current, inspectionFailure(error, staticAvailable)));
    }
  }
}

export async function submitInspection(input: {
  submissionKey: string;
  repositoryUrl: string;
  owner: string;
  name: string;
  source?: "github" | "demo";
  demoKey?: "normal" | "suspicious";
}): Promise<{ inspection: InspectionRecord; created: boolean }> {
  const now = new Date().toISOString();
  const record: InspectionRecord = {
    id: crypto.randomUUID(),
    submissionKey: input.submissionKey,
    repositoryUrl: input.repositoryUrl,
    owner: input.owner,
    name: input.name,
    source: input.source ?? "github",
    demoKey: input.demoKey,
    status: "queued",
    currentStage: "fetching-repository",
    stages: initialInspectionStages(),
    createdAt: now,
    updatedAt: now,
  };
  const claimed = await createInspection(record);
  if (claimed.created) await inspectionWorker.start(claimed.record);
  return { inspection: claimed.record, created: claimed.created };
}

const globalWorker = globalThis as unknown as { cordonInspectionWorker?: DirectInspectionWorker };
export const inspectionWorker = globalWorker.cordonInspectionWorker ?? new DirectInspectionWorker();
globalWorker.cordonInspectionWorker = inspectionWorker;
