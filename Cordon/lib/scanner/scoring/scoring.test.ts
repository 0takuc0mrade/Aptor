import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { Finding } from "../types";
import { buildAttackPaths, scoreFindings, verdictForScore } from ".";

function finding(partial: Pick<Finding, "id" | "category" | "severity">): Finding {
  return {
    ...partial,
    ruleId: partial.id,
    title: partial.id,
    description: partial.id,
    filePath: "collect.js",
    recommendation: "Review it.",
  };
}

describe("risk scoring", () => {
  it("uses transparent severity weights", () => {
    const findings = [
      finding({ id: "i", category: "secret-access", severity: "info" }),
      finding({ id: "l", category: "dependency-risk", severity: "low" }),
      finding({ id: "m", category: "filesystem-access", severity: "medium" }),
      finding({ id: "h", category: "process-execution", severity: "high" }),
      finding({ id: "c", category: "obfuscation", severity: "critical" }),
    ];
    assert.equal(scoreFindings(findings, []), 40);
  });

  it("adds an attack-path bonus when local data and network behavior combine", () => {
    const findings = [
      finding({ id: "secret", category: "secret-access", severity: "high" }),
      finding({ id: "exec", category: "process-execution", severity: "high" }),
      finding({ id: "network", category: "network-access", severity: "low" }),
    ];
    const paths = buildAttackPaths(findings);
    assert.equal(paths.length, 1);
    assert.equal(paths[0]?.severity, "critical");
    assert.equal(scoreFindings(findings, paths), 36);
    assert.equal(verdictForScore(36), "critical-risk");
  });

  it("maps score thresholds to published verdicts", () => {
    assert.equal(verdictForScore(0), "low-risk");
    assert.equal(verdictForScore(4), "needs-review");
    assert.equal(verdictForScore(15), "high-risk");
    assert.equal(verdictForScore(25), "critical-risk");
  });
});
