import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import type { RepositoryMetadata } from "../scanner/types";

import { extractGitHubTarball } from "./archive";
import { githubRepositoryUrlSchema } from "./schema";

type GitHubRepositoryResponse = {
  default_branch: string;
  private: boolean;
};

type GitHubCommitResponse = {
  sha: string;
};

export type RepositoryMaterializationStage = "fetching-repository" | "checking-archive-safety";
export type RepositoryMaterializationObserver = (stage: RepositoryMaterializationStage) => void | Promise<void>;

function githubHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "Cordon/0.1 repository-inspector",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return headers;
}

async function githubJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers: githubHeaders(), cache: "no-store", signal: AbortSignal.timeout(15_000) });
  if (response.status === 404) throw new Error("GitHub could not find that public repository.");
  if (response.status === 403) throw new Error("GitHub refused the request or the API rate limit was reached. Configure GITHUB_TOKEN and retry.");
  if (!response.ok) throw new Error(`GitHub returned ${response.status} while reading repository metadata.`);
  return (await response.json()) as T;
}

async function readLimitedBody(response: Response, maxBytes: number): Promise<Buffer> {
  if (!response.body) throw new Error("GitHub returned an empty archive response.");
  const declared = Number(response.headers.get("content-length") ?? 0);
  if (declared > maxBytes) throw new Error("Repository archive exceeds the download size limit.");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error("Repository archive exceeds the download size limit.");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
}

async function withArchiveAtCommit<T>(
  metadata: RepositoryMetadata,
  callback: (root: string, metadata: RepositoryMetadata) => Promise<T>,
  onStage?: RepositoryMaterializationObserver,
): Promise<T> {
  await onStage?.("fetching-repository");
  if (!/^[0-9a-f]{40}$/i.test(metadata.commitHash)) throw new Error("The stored repository commit is invalid.");
  const archiveUrl = `https://api.github.com/repos/${encodeURIComponent(metadata.owner)}/${encodeURIComponent(metadata.name)}/tarball/${encodeURIComponent(metadata.commitHash)}`;
  const archiveResponse = await fetch(archiveUrl, {
    headers: githubHeaders(),
    cache: "no-store",
    redirect: "follow",
    signal: AbortSignal.timeout(30_000),
  });
  if (!archiveResponse.ok) throw new Error(`GitHub returned ${archiveResponse.status} while downloading the repository archive.`);
  const archive = await readLimitedBody(archiveResponse, 30_000_000);
  const tempRoot = await mkdtemp(path.join(tmpdir(), "cordon-scan-"));
  try {
    await onStage?.("checking-archive-safety");
    await extractGitHubTarball(archive, tempRoot);
    return await callback(tempRoot, metadata);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

export async function withPublicRepositoryAtCommit<T>(
  metadata: RepositoryMetadata,
  callback: (root: string, metadata: RepositoryMetadata) => Promise<T>,
  onStage?: RepositoryMaterializationObserver,
): Promise<T> {
  const reference = githubRepositoryUrlSchema.parse(metadata.url);
  if (reference.owner !== metadata.owner || reference.name !== metadata.name) throw new Error("Stored repository metadata does not match its public GitHub URL.");
  return withArchiveAtCommit(metadata, callback, onStage);
}

export async function withPublicRepository<T>(
  inputUrl: string,
  callback: (root: string, metadata: RepositoryMetadata) => Promise<T>,
  onStage?: RepositoryMaterializationObserver,
): Promise<T> {
  await onStage?.("fetching-repository");
  const reference = githubRepositoryUrlSchema.parse(inputUrl);
  const apiRoot = `https://api.github.com/repos/${encodeURIComponent(reference.owner)}/${encodeURIComponent(reference.name)}`;
  const repository = await githubJson<GitHubRepositoryResponse>(apiRoot);
  if (repository.private) throw new Error("Private GitHub repositories are outside the MVP scope.");
  const commit = await githubJson<GitHubCommitResponse>(`${apiRoot}/commits/${encodeURIComponent(repository.default_branch)}`);
  return withArchiveAtCommit({
    owner: reference.owner,
    name: reference.name,
    url: reference.url,
    defaultBranch: repository.default_branch,
    commitHash: commit.sha,
  }, callback, async (stage) => {
    if (stage !== "fetching-repository") await onStage?.(stage);
  });
}
