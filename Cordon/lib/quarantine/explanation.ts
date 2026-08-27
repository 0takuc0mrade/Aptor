import { z } from "zod";

import type { AIExplanation, CombinedReport } from "./types";

export const aiExplanationSchema = z.object({
  riskSummary: z.string().min(1).max(1_500),
  importantObservedBehavior: z.array(z.string().min(1).max(500)).max(8),
  likelyIntent: z.object({
    assessment: z.string().min(1).max(1_000),
    confidence: z.enum(["low", "medium", "high"]),
  }).strict(),
  attackPathExplanation: z.string().min(1).max(2_000),
  recommendedActions: z.array(z.string().min(1).max(500)).max(8),
  unansweredQuestions: z.array(z.string().min(1).max(500)).max(8),
}).strict();

export interface ExplanationProvider {
  explain(report: Omit<CombinedReport, "explanation">): Promise<AIExplanation | null>;
}

export class DisabledExplanationProvider implements ExplanationProvider {
  async explain(): Promise<null> {
    return null;
  }
}

export function explanationAvailability(environment: NodeJS.ProcessEnv = process.env): { configured: boolean; message: string } {
  const configured = Boolean(environment.OPENAI_API_KEY?.trim());
  return {
    configured,
    message: configured
      ? "An explanation provider may be configured, but deterministic evidence remains authoritative."
      : "AI explanation is not configured. Deterministic findings and attack paths remain fully available.",
  };
}
