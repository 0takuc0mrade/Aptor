import type { Finding, ScannerRule } from "../types";
import { createFinding, evidenceLine, isScriptFile, lineAt } from "./shared";

const SENSITIVE_PATH = /(?:\.env(?:\.|["'`/])|\.ssh\b|id_(?:rsa|ed25519)|private[_-]?key|wallet(?:\.dat|s?\/)|(?:Chrome|Chromium|Firefox|Brave)[/\\].*(?:Profile|Login Data|Cookies)|\.bash_history|\.zsh_history|credentials(?:\.json)?|\.aws[/\\]credentials)/gi;
const FILESYSTEM_API = /\b(?:readFile|readFileSync|createReadStream|readdir|readdirSync|opendir)\s*\(/g;
const PROCESS_ENV = /\bprocess\.env(?:\.[A-Za-z_][A-Za-z0-9_]*|\[[^\]]+\])?/g;

export const secretFilesystemRule: ScannerRule = {
  id: "secret-filesystem-access",
  scan(files): Finding[] {
    const findings: Finding[] = [];

    for (const file of files.filter(isScriptFile)) {
      for (const match of file.content.matchAll(SENSITIVE_PATH)) {
        const index = match.index ?? 0;
        const line = lineAt(file.content, index);
        const evidence = evidenceLine(file.content, index);
        findings.push(
          createFinding({
            ruleId: "sensitive-path-reference",
            title: "Sensitive local path referenced",
            description: `The code references ${match[0]}, a path commonly associated with secrets, keys, wallet material, browser profiles, or shell history.`,
            severity: /\.env/i.test(match[0]) ? "medium" : "high",
            category: "secret-access",
            filePath: file.path,
            startLine: line,
            endLine: line,
            evidence,
            recommendation: "Trace whether this path is read at runtime and ensure no value can leave the local process or repository boundary.",
          }),
        );
      }

      for (const match of file.content.matchAll(FILESYSTEM_API)) {
        const index = match.index ?? 0;
        const line = lineAt(file.content, index);
        const evidence = evidenceLine(file.content, index);
        findings.push(
          createFinding({
            ruleId: "filesystem-read",
            title: "Filesystem read capability",
            description: "The file reads or enumerates local filesystem content. This is often legitimate, so the finding is low severity unless it combines with sensitive paths or outbound network activity.",
            severity: "low",
            category: "filesystem-access",
            filePath: file.path,
            startLine: line,
            endLine: line,
            evidence,
            recommendation: "Verify the resolved path stays within the intended directory and cannot be controlled to read arbitrary host files.",
          }),
        );
      }

      for (const match of file.content.matchAll(PROCESS_ENV)) {
        const index = match.index ?? 0;
        const line = lineAt(file.content, index);
        const evidence = evidenceLine(file.content, index);
        findings.push(
          createFinding({
            ruleId: "environment-access",
            title: "Environment variable access",
            description: "The code reads process.env. This is common in Node.js applications and is informational by itself; it becomes important when combined with command execution or outbound network activity.",
            severity: "info",
            category: "secret-access",
            filePath: file.path,
            startLine: line,
            endLine: line,
            evidence,
            recommendation: "Confirm only expected variables are read and that secret values are never logged, embedded in commands, or transmitted.",
          }),
        );
      }
    }

    return findings;
  },
};
