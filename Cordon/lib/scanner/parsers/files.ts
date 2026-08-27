import { lstat, readdir, readFile, realpath } from "node:fs/promises";
import path from "node:path";

import type { SourceFile } from "../types";

const IGNORED_DIRECTORIES = new Set([
  ".git",
  ".next",
  ".turbo",
  "node_modules",
  "dist",
  "build",
  "coverage",
  "vendor",
]);

const TEXT_EXTENSIONS = new Set([
  ".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx", ".mts", ".cts", ".json", ".yml", ".yaml", ".sh", ".bash", ".md",
]);

export const DEFAULT_FILE_LIMITS = {
  maxFiles: 10_000,
  maxFileBytes: 1_000_000,
  maxTotalBytes: 50_000_000,
};

function withinRoot(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
}

export async function readRepositoryFiles(
  root: string,
  limits = DEFAULT_FILE_LIMITS,
): Promise<SourceFile[]> {
  const canonicalRoot = await realpath(root);
  const files: SourceFile[] = [];
  let totalBytes = 0;

  async function visit(directory: string): Promise<void> {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.includes("\0")) throw new Error("Repository entry contains a null byte.");
      if (entry.isDirectory() && IGNORED_DIRECTORIES.has(entry.name)) continue;

      const candidate = path.resolve(directory, entry.name);
      if (!withinRoot(canonicalRoot, candidate)) throw new Error(`Repository path escaped root: ${entry.name}`);
      const stat = await lstat(candidate);
      if (stat.isSymbolicLink()) continue;
      if (stat.isDirectory()) {
        await visit(candidate);
        continue;
      }
      if (!stat.isFile()) continue;

      const extension = path.extname(entry.name).toLowerCase();
      if (entry.name !== "package.json" && !TEXT_EXTENSIONS.has(extension)) continue;
      if (stat.size > limits.maxFileBytes) continue;
      if (files.length >= limits.maxFiles) throw new Error(`Repository exceeds the ${limits.maxFiles} file scan limit.`);
      totalBytes += stat.size;
      if (totalBytes > limits.maxTotalBytes) throw new Error("Repository exceeds the total readable source limit.");

      const buffer = await readFile(candidate);
      if (buffer.includes(0)) continue;
      files.push({
        path: path.relative(canonicalRoot, candidate).split(path.sep).join("/"),
        content: buffer.toString("utf8"),
        size: buffer.byteLength,
      });
    }
  }

  await visit(canonicalRoot);
  return files;
}
