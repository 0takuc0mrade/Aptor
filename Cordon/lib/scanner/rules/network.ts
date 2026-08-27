import type { Finding, ScannerRule } from "../types";
import { createFinding, evidenceLine, isScriptFile, lineAt } from "./shared";

const URL_PATTERN = /https?:\/\/[A-Za-z0-9.-]+(?::\d{2,5})?(?:\/[^\s"'`)<>]*)?/g;
const IP_PATTERN = /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)(?::\d{2,5})?\b/g;
const REQUEST_CALL = /\b(?:fetch|axios\.(?:get|post|put|patch)|https?\.request|https?\.get|request)\s*\(/g;
const DOWNLOAD_COMMAND = /\b(?:curl|wget)\b[^\n]*/g;

function isLikelyDocumentation(filePath: string): boolean {
  return /(?:^|\/)(?:docs?|examples?|readme)(?:\/|\.|$)/i.test(filePath);
}

export const networkRule: ScannerRule = {
  id: "network-access",
  scan(files): Finding[] {
    const findings: Finding[] = [];

    for (const file of files.filter(isScriptFile)) {
      for (const match of file.content.matchAll(URL_PATTERN)) {
        const value = match[0];
        if (/^(?:https?:\/\/)?(?:localhost|127\.0\.0\.1)(?::|\/|$)/i.test(value)) continue;
        const index = match.index ?? 0;
        const line = lineAt(file.content, index);
        findings.push(
          createFinding({
            ruleId: /(?:discord(?:app)?\.com\/api\/webhooks|hooks\.slack\.com|webhook)/i.test(value)
              ? "webhook-endpoint"
              : "hardcoded-url",
            title: /webhook/i.test(value) ? "Webhook endpoint embedded in code" : "Hard-coded network destination",
            description: /webhook/i.test(value)
              ? "The code contains an endpoint commonly used to receive pushed data. Embedded webhook destinations deserve review because they can be used for exfiltration."
              : "The code contains a fixed external HTTP destination. URLs are common, but the destination and data sent to it should be reviewed.",
            severity: /webhook/i.test(value) ? "high" : isLikelyDocumentation(file.path) ? "info" : "low",
            category: "network-access",
            filePath: file.path,
            startLine: line,
            endLine: line,
            evidence: evidenceLine(file.content, index),
            recommendation: "Verify the destination owner, request timing, payload, redirects, and whether sensitive values can reach it.",
          }),
        );
      }

      for (const match of file.content.matchAll(IP_PATTERN)) {
        const value = match[0];
        if (/^(?:127\.|0\.0\.0\.0|255\.255\.255\.255)/.test(value)) continue;
        const index = match.index ?? 0;
        const line = lineAt(file.content, index);
        findings.push(
          createFinding({
            ruleId: "hardcoded-ip",
            title: "Hard-coded IP address",
            description: "A fixed non-loopback IP address appears in executable source. Direct IP connections can bypass ordinary domain review and deserve validation.",
            severity: "medium",
            category: "network-access",
            filePath: file.path,
            startLine: line,
            endLine: line,
            evidence: evidenceLine(file.content, index),
            recommendation: "Identify the address owner and confirm the connection purpose, protocol, and transmitted data.",
          }),
        );
      }

      for (const match of file.content.matchAll(REQUEST_CALL)) {
        const index = match.index ?? 0;
        const line = lineAt(file.content, index);
        findings.push(
          createFinding({
            ruleId: "network-request-call",
            title: "Outbound request capability",
            description: "The file initiates an HTTP request. This is informational until the destination, payload, and surrounding data flow are reviewed.",
            severity: "info",
            category: "network-access",
            filePath: file.path,
            startLine: line,
            endLine: line,
            evidence: evidenceLine(file.content, index),
            recommendation: "Trace the request URL and payload, especially values derived from the filesystem or environment.",
          }),
        );
      }

      for (const match of file.content.matchAll(DOWNLOAD_COMMAND)) {
        const index = match.index ?? 0;
        const line = lineAt(file.content, index);
        findings.push(
          createFinding({
            ruleId: "shell-download-command",
            title: "Shell download command",
            description: "The source constructs or runs a curl/wget command. Shell download utilities become high risk when their output is executed or includes sensitive local data.",
            severity: /\|\s*(?:sh|bash|node)|&&\s*(?:sh|bash|node)/i.test(match[0]) ? "critical" : "high",
            category: "network-access",
            filePath: file.path,
            startLine: line,
            endLine: line,
            evidence: evidenceLine(file.content, index),
            recommendation: "Do not run the command. Inspect the destination, flags, output path, and every downstream consumer.",
          }),
        );
      }
    }

    return findings;
  },
};
