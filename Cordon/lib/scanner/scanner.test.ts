import assert from "node:assert/strict";
import path from "node:path";
import { describe, it } from "node:test";

import { scanRepository } from ".";

const metadata = {
  owner: "fixture",
  name: "combined-attack",
  url: "https://github.com/fixture/combined-attack",
  defaultBranch: "main",
  commitHash: "0123456789abcdef",
};

describe("scanner integration", () => {
  it("produces a real report and combined path from fixture source", async () => {
    const result = await scanRepository(path.resolve(process.cwd(), "test-fixtures/combined-attack"), metadata);
    assert.equal(result.filesScanned, 2);
    assert.ok(result.rulesExecuted.length >= 5);
    assert.ok(result.findings.length > 0);
    assert.ok(result.attackPaths.length > 0);
    assert.ok(["high-risk", "critical-risk"].includes(result.verdict));
  });
});
