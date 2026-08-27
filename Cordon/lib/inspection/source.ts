import { createHash } from "node:crypto";
import { cp, mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { withPublicRepository, withPublicRepositoryAtCommit, type RepositoryMaterializationObserver } from "../github/client";
import type { RepositoryMetadata } from "../scanner/types";

export type InspectionSource = {
  kind: "github" | "demo";
  repositoryUrl: string;
  demoKey?: "normal" | "suspicious";
};

const DEMO_FIXTURES = {
  normal: "normal-demo",
  suspicious: "suspicious-demo",
} as const;

async function fixtureHash(root: string): Promise<string> {
  const hash = createHash("sha1");
  async function visit(directory: string): Promise<void> {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const target = path.join(directory, entry.name);
      const relative = path.relative(root, target);
      hash.update(relative);
      if (entry.isDirectory()) await visit(target);
      else hash.update(await readFile(target));
    }
  }
  await visit(root);
  return hash.digest("hex");
}

async function withDemoRepository<T>(
  demoKey: "normal" | "suspicious",
  callback: (root: string, metadata: RepositoryMetadata) => Promise<T>,
  onStage?: RepositoryMaterializationObserver,
): Promise<T> {
  await onStage?.("fetching-repository");
  const fixture = path.join(process.cwd(), "test-fixtures", "runtime", DEMO_FIXTURES[demoKey]);
  const commitHash = await fixtureHash(fixture);
  const target = await mkdtemp(path.join(tmpdir(), "cordon-demo-"));
  try {
    await onStage?.("checking-archive-safety");
    await cp(fixture, target, { recursive: true, errorOnExist: false, force: false });
    return await callback(target, {
      owner: "cordon-demo",
      name: demoKey === "normal" ? "normal-repository" : "suspicious-repository",
      url: `https://github.com/cordon-demo/${demoKey}-repository`,
      defaultBranch: "main",
      commitHash,
      source: "demo",
      demoKey,
    });
  } finally {
    await rm(target, { recursive: true, force: true });
  }
}

export async function withInspectionSource<T>(
  source: InspectionSource,
  callback: (root: string, metadata: RepositoryMetadata) => Promise<T>,
  onStage?: RepositoryMaterializationObserver,
): Promise<T> {
  if (source.kind === "demo" && source.demoKey) return withDemoRepository(source.demoKey, callback, onStage);
  return withPublicRepository(source.repositoryUrl, callback, onStage);
}

export async function withInspectionRepositoryAtCommit<T>(
  metadata: RepositoryMetadata,
  callback: (root: string, metadata: RepositoryMetadata) => Promise<T>,
  onStage?: RepositoryMaterializationObserver,
): Promise<T> {
  if (metadata.source === "demo" && metadata.demoKey) return withDemoRepository(metadata.demoKey, async (root, current) => {
    if (current.commitHash !== metadata.commitHash) throw new Error("The demonstration fixture changed after static inspection. Start a new inspection before running it.");
    return callback(root, current);
  }, onStage);
  return withPublicRepositoryAtCommit(metadata, callback, onStage);
}
