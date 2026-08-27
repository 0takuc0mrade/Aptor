# Scanner rules

## Finding contract

Every finding includes a stable ID, rule ID, title, explanation, severity, category, path, optional line range, evidence, and a concrete recommended action. Keyword matches are not presented without an explanation of why the matched behavior matters.

## Package lifecycle

`package-lifecycle` reads every `package.json` and inspects `preinstall`, `install`, `postinstall`, `prepare`, and `prepublish`. Automatic lifecycle hooks are medium or high severity; a download piped into an interpreter is critical. Other shell-bearing scripts are reported as process execution. Git/HTTP dependency sources receive a low-severity provenance finding.

## Process execution

`process-execution` distinguishes capability from direct execution:

- importing `child_process`: medium;
- `spawn` / `spawnSync`: medium;
- `exec` / `execSync`: high;
- `eval`, `Function`, and `vm.runInNewContext`: high;
- computed `require`: medium;
- computed `import`: low.

This distinction lets legitimate tooling remain reviewable without being labeled malicious.

## Secret and filesystem access

Sensitive path references such as `.env`, `.ssh`, private keys, wallet data, browser profiles, shell histories, and credential files receive medium or high severity. General filesystem reads are low. `process.env` is informational alone and gains significance only in a combined path.

## Network activity

Executable sources are inspected for URLs, non-loopback IPs, webhook endpoints, request APIs, and curl/wget commands. Documentation paths reduce ordinary URL findings to informational. Shell downloads are high or critical depending on whether output is executed.

## Obfuscation

The scanner detects large Base64 strings, long hexadecimal payloads, decoding near dynamic execution, excessive concatenation, and minified source outside common build-output directories. Encoded data is never decoded or executed by Cordon.

## Combined reasoning

Attack paths are separate from findings. The MVP uses same-file behavioral proximity:

- local file/environment access → outbound network behavior;
- lifecycle hook → process execution → network behavior.

The report explicitly states that proximity raises review priority but does not prove exfiltration or malicious intent.

## Scoring

| Severity | Points |
| --- | ---: |
| Informational | 0 |
| Low | 1 |
| Medium | 4 |
| High | 10 |
| Critical | 25 |

Combined paths add 8 or 15 points. Verdict thresholds are: `0–3` low risk, `4–14` needs review, `15–24` high risk, and `25+` critical risk. A standalone critical finding therefore cannot be diluted into a lower final verdict.
