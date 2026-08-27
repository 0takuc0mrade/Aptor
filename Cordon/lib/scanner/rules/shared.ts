import { createHash } from "node:crypto";

import type { Finding, SourceFile } from "../types";

export const SCRIPT_EXTENSIONS = new Set([".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx", ".mts", ".cts"]);

export function lineAt(content: string, index: number): number {
  return content.slice(0, index).split("\n").length;
}

export function evidenceLine(content: string, index: number, maxLength = 240): string {
  const lineStart = content.lastIndexOf("\n", index) + 1;
  const lineEnd = content.indexOf("\n", index);
  const line = content.slice(lineStart, lineEnd === -1 ? undefined : lineEnd).trim();
  return line.length > maxLength ? `${line.slice(0, maxLength)}…` : line;
}

export function findingId(ruleId: string, filePath: string, line: number, evidence: string): string {
  return createHash("sha256")
    .update(`${ruleId}\0${filePath}\0${line}\0${evidence}`)
    .digest("hex")
    .slice(0, 16);
}

export function createFinding(
  input: Omit<Finding, "id"> & { startLine?: number; evidence?: string },
): Finding {
  const line = input.startLine ?? 1;
  return {
    ...input,
    id: findingId(input.ruleId, input.filePath, line, input.evidence ?? input.title),
  };
}

export function isScriptFile(file: SourceFile): boolean {
  const dot = file.path.lastIndexOf(".");
  return dot !== -1 && SCRIPT_EXTENSIONS.has(file.path.slice(dot).toLowerCase());
}

export function uniqueFindings(findings: Finding[]): Finding[] {
  return [...new Map(findings.map((finding) => [finding.id, finding])).values()];
}
