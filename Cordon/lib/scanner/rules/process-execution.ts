import type { Finding, ScannerRule } from "../types";
import { createFinding, evidenceLine, isScriptFile, lineAt } from "./shared";

const PATTERNS = [
  {
    id: "child-process-import",
    pattern: /(?:from\s+["']node:child_process["']|require\(\s*["'](?:node:)?child_process["']\s*\))/g,
    title: "Child process module imported",
    severity: "medium" as const,
    description: "The file imports Node’s child-process capability. This may be legitimate tooling, but it permits commands outside the JavaScript process.",
    recommendation: "Review every call site, command, argument, environment override, and input source that reaches this import.",
  },
  {
    id: "process-exec-call",
    pattern: /\b(?:exec|execSync)\s*\(/g,
    title: "Shell command execution",
    severity: "high" as const,
    description: "The code calls a shell-execution API. String commands can inherit shell parsing and become dangerous when any portion is externally controlled.",
    recommendation: "Confirm the command is fixed, inputs cannot alter shell syntax, and a non-shell API cannot be used instead.",
  },
  {
    id: "process-spawn-call",
    pattern: /\b(?:spawn|spawnSync)\s*\(/g,
    title: "Child process spawned",
    severity: "medium" as const,
    description: "The code starts another process. Array arguments can be legitimate, but the executable, arguments, working directory, and inherited environment require review.",
    recommendation: "Verify the executable and argument array are fixed or strictly validated, and minimize the inherited environment.",
  },
  {
    id: "dynamic-code-eval",
    pattern: /\beval\s*\(|\bnew\s+Function\s*\(|\bFunction\s*\(/g,
    title: "Dynamic code evaluation",
    severity: "high" as const,
    description: "The file constructs or evaluates executable code at runtime. This hides the final behavior from ordinary static review and can turn data into code.",
    recommendation: "Remove dynamic evaluation or prove that the evaluated source is fixed, local, and fully reviewed.",
  },
  {
    id: "vm-new-context",
    pattern: /\b(?:vm\.)?runInNewContext\s*\(/g,
    title: "Code executed in a VM context",
    severity: "high" as const,
    description: "The VM API executes dynamically supplied JavaScript. A VM context is not a security boundary when exposed capabilities are unsafe.",
    recommendation: "Review the code source and every capability passed into the context; do not treat the VM as isolation for hostile code.",
  },
  {
    id: "dynamic-require",
    pattern: /\brequire\s*\(\s*(?!["'`][^${`]+["'`]\s*\))[^)]+\)/g,
    title: "Dynamic module loading",
    severity: "medium" as const,
    description: "The required module path is computed at runtime, which can obscure the executed code and permit path manipulation.",
    recommendation: "Constrain the module to a small explicit allowlist and reject paths outside the repository root.",
  },
  {
    id: "dynamic-import",
    pattern: /\bimport\s*\(\s*(?!["'][^"']+["']\s*\))[^)]+\)/g,
    title: "Dynamic import target",
    severity: "low" as const,
    description: "The import target is computed at runtime. This may be normal code splitting, but it makes the loaded module set harder to verify.",
    recommendation: "Confirm the expression resolves only to reviewed local modules or an explicit allowlist.",
  },
];

export const processExecutionRule: ScannerRule = {
  id: "process-execution",
  scan(files): Finding[] {
    const findings: Finding[] = [];
    for (const file of files.filter(isScriptFile)) {
      for (const definition of PATTERNS) {
        for (const match of file.content.matchAll(definition.pattern)) {
          const index = match.index ?? 0;
          const line = lineAt(file.content, index);
          const evidence = evidenceLine(file.content, index);
          findings.push(
            createFinding({
              ruleId: definition.id,
              title: definition.title,
              description: definition.description,
              severity: definition.severity,
              category: "process-execution",
              filePath: file.path,
              startLine: line,
              endLine: line,
              evidence,
              recommendation: definition.recommendation,
            }),
          );
        }
      }
    }
    return findings;
  },
};
