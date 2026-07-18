import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const repositoryRoot = process.cwd();
const sourceRoots = [
  "apps/web/src",
  "contracts/aptor-credential/src",
  "packages/aptor-browser/src",
  "packages/aptor-midnight/src",
];
const sourceExtensions = new Set([".compact", ".js", ".mjs", ".ts", ".tsx"]);
const findings = [];

async function filesBelow(relativeDirectory) {
  const directory = path.join(repositoryRoot, relativeDirectory);
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relativePath = path.join(relativeDirectory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await filesBelow(relativePath)));
    } else if (sourceExtensions.has(path.extname(entry.name))) {
      files.push(relativePath);
    }
  }
  return files;
}

const checks = [
  {
    name: "localStorage use in private-product source",
    pattern: /\blocalStorage\s*\.(?:getItem|setItem)\s*\(/gu,
  },
  {
    name: "sensitive value sent to console",
    pattern:
      /console\.(?:log|info|debug|warn|error)\([^\n]*(?:holderSecret|issuerSigningKey|credential|witness|mnemonic|seedPhrase)/giu,
  },
  {
    name: "literal holder secret",
    pattern: /holderSecret\s*:\s*["'][0-9a-f]{64}["']/giu,
  },
  {
    name: "literal issuer signing key",
    pattern: /issuerSigningKey\s*:\s*["'][0-9]+["']/giu,
  },
  {
    name: "literal wallet secret",
    pattern:
      /(?:mnemonic|seedPhrase|walletSeed|walletPrivateKey)\s*[:=]\s*["'][^"']{12,}["']/giu,
  },
  {
    name: "embedded private key",
    pattern: /-----BEGIN (?:EC |RSA )?PRIVATE KEY-----/gu,
  },
];

for (const sourceRoot of sourceRoots) {
  for (const relativePath of await filesBelow(sourceRoot)) {
    const source = await readFile(
      path.join(repositoryRoot, relativePath),
      "utf8",
    );
    for (const check of checks) {
      check.pattern.lastIndex = 0;
      for (const match of source.matchAll(check.pattern)) {
        const line = source.slice(0, match.index).split("\n").length;
        findings.push(`${relativePath}:${line} ${check.name}`);
      }
    }
  }
}

const rootEntries = await readdir(repositoryRoot, { withFileTypes: true });
for (const entry of rootEntries) {
  if (
    entry.isFile() &&
    entry.name.startsWith(".env") &&
    entry.name !== ".env.example"
  ) {
    findings.push(
      `${entry.name}: non-example environment file is present at repository root`,
    );
  }
}

if (findings.length > 0) {
  console.error("Aptor security scan found potentially unsafe material:");
  for (const finding of findings) console.error(`- ${finding}`);
  process.exitCode = 1;
} else {
  console.info(
    `Aptor security scan passed across ${sourceRoots.length} production source roots.`,
  );
}
