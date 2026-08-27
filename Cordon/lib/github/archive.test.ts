import { gzipSync } from "node:zlib";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import { extractGitHubTarball } from "./archive";

function tarEntry(name: string, content: string): Buffer {
  const header = Buffer.alloc(512);
  header.write(name, 0, 100, "utf8");
  header.write("0000600\0", 100, 8, "ascii");
  header.write("0000000\0", 108, 8, "ascii");
  header.write("0000000\0", 116, 8, "ascii");
  header.write(`${content.length.toString(8).padStart(11, "0")}\0`, 124, 12, "ascii");
  header.write("00000000000\0", 136, 12, "ascii");
  header.fill(32, 148, 156);
  header.write("0", 156, 1, "ascii");
  header.write("ustar\0", 257, 6, "ascii");
  const checksum = [...header].reduce((total, byte) => total + byte, 0);
  header.write(`${checksum.toString(8).padStart(6, "0")}\0 `, 148, 8, "ascii");
  const body = Buffer.from(content);
  const padding = Buffer.alloc(Math.ceil(body.length / 512) * 512 - body.length);
  return Buffer.concat([header, body, padding, Buffer.alloc(1024)]);
}

describe("safe GitHub archive extraction", () => {
  it("strips the archive root and writes a bounded regular file", async () => {
    const destination = await mkdtemp(path.join(tmpdir(), "cordon-archive-test-"));
    try {
      await extractGitHubTarball(gzipSync(tarEntry("repo-commit/src/index.js", "export const safe = true;")), destination);
      assert.equal(await readFile(path.join(destination, "src/index.js"), "utf8"), "export const safe = true;");
    } finally {
      await rm(destination, { recursive: true, force: true });
    }
  });

  it("rejects path traversal before writing", async () => {
    const destination = await mkdtemp(path.join(tmpdir(), "cordon-archive-test-"));
    try {
      await assert.rejects(
        extractGitHubTarball(gzipSync(tarEntry("repo-commit/../../escape.js", "bad")), destination),
        /path traversal/,
      );
    } finally {
      await rm(destination, { recursive: true, force: true });
    }
  });
});
