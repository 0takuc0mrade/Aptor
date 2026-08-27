import type { FindingCategory, Severity, Verdict } from "../scanner/types";

export function formatVerdict(verdict: Verdict): string {
  return {
    "low-risk": "Low observed risk",
    "needs-review": "Needs review",
    "high-risk": "High risk",
    "critical-risk": "Critical risk",
  }[verdict];
}

export function formatCategory(category: FindingCategory): string {
  return category.split("-").map((word) => `${word[0].toUpperCase()}${word.slice(1)}`).join(" ");
}

export function formatSeverity(severity: Severity): string {
  return `${severity[0].toUpperCase()}${severity.slice(1)}`;
}

export function shortHash(hash: string): string {
  return hash.slice(0, 8);
}

export function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
