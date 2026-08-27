import type { Finding, ScannerRule, SourceFile } from "../types";
import { createFinding } from "./shared";

const LIFECYCLE_HOOKS = new Set(["preinstall", "install", "postinstall", "prepare", "prepublish"]);
const REMOTE_EXECUTION = /(?:curl|wget)\b[^\n;&|]*(?:\||&&|;)\s*(?:sh|bash|node|powershell)|powershell\b[^\n]*(?:invoke-webrequest|iwr)|https?:\/\/[^\s]+[^\n]*(?:\||&&)\s*(?:sh|bash|node)/i;
const SHELL_EXECUTION = /(?:^|\s|&&|;|\|)(?:sh|bash|zsh|cmd|powershell|curl|wget)\b|node\s+-e\b/i;
const NON_REGISTRY_DEPENDENCY = /^(?:git\+|https?:|git:|github:)/i;

function parsePackage(file: SourceFile): Record<string, unknown> | null {
  try {
    return JSON.parse(file.content) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export const packageLifecycleRule: ScannerRule = {
  id: "package-lifecycle",
  scan(files): Finding[] {
    const findings: Finding[] = [];

    for (const file of files.filter((candidate) => candidate.path.endsWith("package.json"))) {
      const manifest = parsePackage(file);
      if (!manifest) continue;

      const scripts = manifest.scripts;
      if (scripts && typeof scripts === "object" && !Array.isArray(scripts)) {
        for (const [name, rawCommand] of Object.entries(scripts)) {
          if (typeof rawCommand !== "string") continue;
          const evidence = `"${name}": ${JSON.stringify(rawCommand)}`;
          const line = file.content.slice(0, file.content.indexOf(`"${name}"`)).split("\n").length;
          const remote = REMOTE_EXECUTION.test(rawCommand);

          if (LIFECYCLE_HOOKS.has(name)) {
            findings.push(
              createFinding({
                ruleId: remote ? "lifecycle-remote-execution" : "lifecycle-hook",
                title: remote ? `Remote code execution in ${name}` : `Package lifecycle hook: ${name}`,
                description: remote
                  ? `The ${name} hook downloads content and passes it to an interpreter. Package managers can run this before a developer reviews the repository.`
                  : `The ${name} script may run automatically during package installation or publication. Its presence is not inherently malicious, but it expands the code executed before normal application startup.`,
                severity: remote ? "critical" : name === "postinstall" || name === "install" ? "high" : "medium",
                category: "lifecycle-script",
                filePath: file.path,
                startLine: line,
                endLine: line,
                evidence,
                recommendation: remote
                  ? "Do not install dependencies. Inspect the downloaded resource and every command in the pipeline independently."
                  : `Review the ${name} command and each referenced file before running a package-manager install.`,
              }),
            );
          }

          if (SHELL_EXECUTION.test(rawCommand)) {
            findings.push(
              createFinding({
                ruleId: "package-script-shell",
                title: `Shell execution in package script “${name}”`,
                description: "This package script invokes a shell, interpreter, or download utility. It only becomes active when the script is run, so review its invocation path as well as the command itself.",
                severity: remote ? "high" : "medium",
                category: "process-execution",
                filePath: file.path,
                startLine: line,
                endLine: line,
                evidence,
                recommendation: "Trace where this script is invoked and review all interpolated arguments before running it.",
              }),
            );
          }

          if (remote) {
            findings.push(
              createFinding({
                ruleId: "package-script-remote-download",
                title: `Remote download in package script “${name}”`,
                description: "This script retrieves content from a remote destination and passes it into an execution pipeline. The download and execution stages are recorded separately so the combined path remains auditable.",
                severity: "high",
                category: "network-access",
                filePath: file.path,
                startLine: line,
                endLine: line,
                evidence,
                recommendation: "Do not run the package script. Retrieve the resource separately in an isolated environment and verify its content and integrity.",
              }),
            );
          }
        }
      }

      for (const section of ["dependencies", "devDependencies", "optionalDependencies"]) {
        const dependencies = manifest[section];
        if (!dependencies || typeof dependencies !== "object" || Array.isArray(dependencies)) continue;
        for (const [name, value] of Object.entries(dependencies)) {
          if (typeof value !== "string" || !NON_REGISTRY_DEPENDENCY.test(value)) continue;
          const line = file.content.slice(0, file.content.indexOf(`"${name}"`)).split("\n").length;
          findings.push(
            createFinding({
              ruleId: "dependency-non-registry-source",
              title: `Dependency fetched outside the package registry`,
              description: `The dependency ${name} resolves from a Git or HTTP source. This can bypass registry provenance and lockfile expectations.`,
              severity: "low",
              category: "dependency-risk",
              filePath: file.path,
              startLine: line,
              endLine: line,
              evidence: `"${name}": ${JSON.stringify(value)}`,
              recommendation: "Pin the dependency to a reviewed commit and verify the source repository and integrity metadata.",
            }),
          );
        }
      }
    }

    return findings;
  },
};
