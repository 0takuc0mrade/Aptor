import type { Finding, ScannerRule } from "../types";
import { createFinding, evidenceLine, isScriptFile, lineAt } from "./shared";

const BASE64 = /["'`]([A-Za-z0-9+/]{160,}={0,2})["'`]/g;
const HEX_PAYLOAD = /["'`](?:\\x[0-9a-fA-F]{2}){80,}["'`]|["'`][0-9a-fA-F]{320,}["'`]/g;
const DECODE_AND_EXECUTE = /(?:atob|Buffer\.from)\s*\([^\n]{0,300}(?:eval|Function|runInNewContext)|(?:eval|Function|runInNewContext)\s*\([^\n]{0,300}(?:atob|Buffer\.from)/g;
const CONCATENATION = /(?:["'`][^\n]{0,24}["'`]\s*\+\s*){12,}/g;

function expectedGenerated(path: string): boolean {
  return /(?:^|\/)(?:dist|build|\.next|coverage|vendor|public\/assets|generated)(?:\/|$)/i.test(path);
}

export const obfuscationRule: ScannerRule = {
  id: "obfuscation",
  scan(files): Finding[] {
    const findings: Finding[] = [];
    for (const file of files.filter(isScriptFile)) {
      const definitions = [
        {
          id: "large-base64",
          pattern: BASE64,
          title: "Large encoded Base64 value",
          description: "A large Base64-like string is embedded in executable source. Encoded assets exist legitimately, but payloads can conceal scripts or configuration.",
          severity: "medium" as const,
          recommendation: "Decode the value without executing it, identify its format, and review every consumer.",
        },
        {
          id: "hex-payload",
          pattern: HEX_PAYLOAD,
          title: "Large hexadecimal payload",
          description: "A long hex-encoded value appears in executable source and may conceal code or binary content.",
          severity: "medium" as const,
          recommendation: "Decode the value into an inert file, identify its type, and review its use before running the repository.",
        },
        {
          id: "decode-execute",
          pattern: DECODE_AND_EXECUTE,
          title: "Decoded content executed as code",
          description: "The file combines decoding with dynamic execution. This is a strong obfuscation indicator because the reviewed source does not directly show the executed program.",
          severity: "critical" as const,
          recommendation: "Do not execute the repository. Decode the payload in an isolated analysis environment and review the resulting code.",
        },
        {
          id: "excessive-string-concatenation",
          pattern: CONCATENATION,
          title: "Excessive string concatenation",
          description: "Many adjacent string fragments are joined together, a pattern sometimes used to hide commands, URLs, or code from simple inspection.",
          severity: "medium" as const,
          recommendation: "Reconstruct the final string without evaluating it and inspect every use of the result.",
        },
      ];

      for (const definition of definitions) {
        for (const match of file.content.matchAll(definition.pattern)) {
          const index = match.index ?? 0;
          const line = lineAt(file.content, index);
          findings.push(
            createFinding({
              ruleId: definition.id,
              title: definition.title,
              description: definition.description,
              severity: definition.severity,
              category: "obfuscation",
              filePath: file.path,
              startLine: line,
              endLine: line,
              evidence: evidenceLine(file.content, index),
              recommendation: definition.recommendation,
            }),
          );
        }
      }

      if (!expectedGenerated(file.path)) {
        const lines = file.content.split("\n");
        const longLines = lines.filter((line) => line.length > 2_000).length;
        const whitespaceRatio = file.content.length === 0 ? 1 : (file.content.match(/\s/g)?.length ?? 0) / file.content.length;
        if (longLines >= 2 || (file.content.length > 20_000 && whitespaceRatio < 0.04)) {
          findings.push(
            createFinding({
              ruleId: "unexpected-minified-source",
              title: "Minified source outside a build directory",
              description: "This executable file is unusually compressed or unreadable and is not located in an expected generated-output directory.",
              severity: "medium",
              category: "obfuscation",
              filePath: file.path,
              startLine: 1,
              evidence: `${file.size} bytes · ${longLines} lines exceed 2,000 characters`,
              recommendation: "Locate the unminified source and source map, then compare the generated output before executing the repository.",
            }),
          );
        }
      }
    }
    return findings;
  },
};
