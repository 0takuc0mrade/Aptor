import assert from "node:assert/strict";
import path from "node:path";
import { describe, it } from "node:test";

import { readRepositoryFiles } from "../parsers/files";
import { obfuscationRule } from "./obfuscation";
import { networkRule } from "./network";
import { packageLifecycleRule } from "./package-lifecycle";
import { processExecutionRule } from "./process-execution";
import { secretFilesystemRule } from "./secret-filesystem";

const fixtures = path.resolve(process.cwd(), "test-fixtures");

async function fixture(name: string) {
  return readRepositoryFiles(path.join(fixtures, name));
}

describe("package lifecycle rule", () => {
  it("flags remote execution in postinstall as critical", async () => {
    const findings = packageLifecycleRule.scan(await fixture("suspicious-postinstall"));
    assert.ok(findings.some((finding) => finding.ruleId === "lifecycle-remote-execution" && finding.severity === "critical"));
  });

  it("does not flag ordinary Next.js scripts", async () => {
    assert.equal(packageLifecycleRule.scan(await fixture("normal-next")).length, 0);
  });
});

describe("process execution rule", () => {
  it("records spawn separately from shell exec", async () => {
    const findings = processExecutionRule.scan(await fixture("legitimate-child-process"));
    assert.ok(findings.some((finding) => finding.ruleId === "process-spawn-call" && finding.severity === "medium"));
    assert.equal(findings.some((finding) => finding.ruleId === "process-exec-call"), false);
  });

  it("flags execSync as high severity", async () => {
    const findings = processExecutionRule.scan(await fixture("combined-attack"));
    assert.ok(findings.some((finding) => finding.ruleId === "process-exec-call" && finding.severity === "high"));
  });
});

describe("secret and filesystem rule", () => {
  it("treats process.env as informational but sensitive paths as higher risk", async () => {
    const findings = secretFilesystemRule.scan(await fixture("env-exfiltration"));
    assert.ok(findings.some((finding) => finding.ruleId === "environment-access" && finding.severity === "info"));
    assert.ok(findings.some((finding) => finding.ruleId === "sensitive-path-reference" && finding.severity === "medium"));
  });
});

describe("network rule", () => {
  it("records outbound requests and fixed destinations", async () => {
    const findings = networkRule.scan(await fixture("env-exfiltration"));
    assert.ok(findings.some((finding) => finding.ruleId === "network-request-call"));
    assert.ok(findings.some((finding) => finding.ruleId === "hardcoded-url"));
  });
});

describe("obfuscation rule", () => {
  it("finds large encoded payloads and dynamic evaluation", async () => {
    const findings = obfuscationRule.scan(await fixture("obfuscated"));
    assert.ok(findings.some((finding) => finding.ruleId === "large-base64"));
  });
});
