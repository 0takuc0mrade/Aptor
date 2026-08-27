import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { CanaryDefinition, CanaryKind } from "./types";

const CANARY_SPECS: Array<{ kind: CanaryKind; label: string; path: string }> = [
  { kind: "dotenv", label: "Fake .env secret", path: "/workspace/repository/.env" },
  { kind: "ssh-private-key", label: "Fake SSH private key", path: "/home/cordon/.ssh/id_ed25519" },
  { kind: "npm-token", label: "Fake npm token", path: "/home/cordon/.npmrc" },
  { kind: "github-token", label: "Fake GitHub token", path: "/home/cordon/.config/gh/hosts.yml" },
  { kind: "cloud-access-key", label: "Fake cloud access key", path: "/home/cordon/.aws/credentials" },
  { kind: "wallet-private-key", label: "Fake wallet private key", path: "/home/cordon/.config/cordon/wallet.json" },
  { kind: "browser-session", label: "Fake browser session", path: "/home/cordon/.config/cordon/browser-session.json" },
  { kind: "api-key", label: "Fake generic API key", path: "/home/cordon/.config/cordon/api-key" },
];

function canaryId(runId: string, kind: CanaryKind): string {
  return createHash("sha256").update(`${runId}:${kind}`).digest("hex").slice(0, 16);
}

export function createCanaries(runId: string): CanaryDefinition[] {
  return CANARY_SPECS.map((spec) => {
    const id = canaryId(runId, spec.kind);
    return {
      ...spec,
      id,
      marker: `CORDON_FAKE_CANARY_${spec.kind.replaceAll("-", "_").toUpperCase()}_${id}_INVALID`,
    };
  });
}

function contentFor(canary: CanaryDefinition): string {
  const marker = canary.marker;
  switch (canary.kind) {
    case "dotenv": return `CORDON_DEMO_SECRET=${marker}\n`;
    case "ssh-private-key": return `-----BEGIN CORDON FAKE KEY-----\n${marker}\n-----END CORDON FAKE KEY-----\n`;
    case "npm-token": return `//registry.invalid/:_authToken=${marker}\n`;
    case "github-token": return `github.invalid:\n  oauth_token: ${marker}\n`;
    case "cloud-access-key": return `[cordon-fake]\naws_access_key_id=${marker}\naws_secret_access_key=${marker}\n`;
    case "wallet-private-key": return `${JSON.stringify({ network: "invalid", privateKey: marker })}\n`;
    case "browser-session": return `${JSON.stringify({ domain: "browser.invalid", session: marker })}\n`;
    case "api-key": return `${marker}\n`;
  }
}

export async function seedCanaryTree(root: string, canaries: CanaryDefinition[]): Promise<void> {
  for (const canary of canaries) {
    const relative = canary.path.replace(/^\/+/, "");
    const target = path.join(root, relative);
    await mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
    // The disposable copy deliberately replaces any repository-provided value at a
    // canary path. No host or application secret is ever copied into the container.
    await writeFile(target, contentFor(canary), { mode: 0o600, flag: "w" });
  }
}

export function redactCanaries(value: string, canaries: CanaryDefinition[]): string {
  return canaries.reduce((redacted, canary) => redacted.replaceAll(canary.marker, `[CANARY:${canary.id}]`), value);
}
