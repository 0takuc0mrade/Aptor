import { createGunzip } from "node:zlib";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

export const ARCHIVE_LIMITS = {
  maxCompressedBytes: 30_000_000,
  maxExpandedBytes: 100_000_000,
  maxEntryBytes: 2_000_000,
  maxEntries: 20_000,
};

function parseOctal(field: Buffer): number {
  const value = field.toString("ascii").replace(/\0.*$/, "").trim();
  if (!value) return 0;
  const result = Number.parseInt(value, 8);
  if (!Number.isFinite(result) || result < 0) throw new Error("Archive contains an invalid entry size.");
  return result;
}

function parseString(field: Buffer): string {
  return field.toString("utf8").replace(/\0.*$/, "");
}

function safeRelativePath(rawName: string): string | null {
  const normalized = rawName.replaceAll("\\", "/");
  if (normalized.includes("\0") || normalized.startsWith("/") || /^[A-Za-z]:/.test(normalized)) {
    throw new Error("Archive contains an absolute or invalid path.");
  }
  const segments = normalized.split("/").filter(Boolean);
  if (segments.some((segment) => segment === "..")) throw new Error("Archive contains a path traversal entry.");
  if (segments.length <= 1) return null;
  const stripped = segments.slice(1).join("/");
  return stripped || null;
}

async function gunzipWithLimit(compressed: Buffer, maxBytes: number): Promise<Buffer> {
  const gunzip = createGunzip();
  const chunks: Buffer[] = [];
  let total = 0;
  const stream = Readable.from(compressed).pipe(gunzip);
  for await (const chunk of stream) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.byteLength;
    if (total > maxBytes) {
      stream.destroy(new Error("Expanded archive exceeds the repository size limit."));
      throw new Error("Expanded archive exceeds the repository size limit.");
    }
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}

function parsePaxPath(data: Buffer): string | undefined {
  const text = data.toString("utf8");
  for (const record of text.split("\n")) {
    const value = record.match(/^\d+ path=(.*)$/)?.[1];
    if (value) return value;
  }
  return undefined;
}

export async function extractGitHubTarball(
  compressed: Buffer,
  destination: string,
  limits = ARCHIVE_LIMITS,
): Promise<void> {
  if (compressed.byteLength > limits.maxCompressedBytes) throw new Error("Repository archive exceeds the download size limit.");
  const archive = await gunzipWithLimit(compressed, limits.maxExpandedBytes);
  const destinationRoot = path.resolve(destination);
  let offset = 0;
  let entries = 0;
  let paxPath: string | undefined;

  while (offset + 512 <= archive.byteLength) {
    const header = archive.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) break;
    const name = parseString(header.subarray(0, 100));
    const prefix = parseString(header.subarray(345, 500));
    const type = String.fromCharCode(header[156] || 48);
    const size = parseOctal(header.subarray(124, 136));
    const dataStart = offset + 512;
    const dataEnd = dataStart + size;
    if (dataEnd > archive.byteLength) throw new Error("Repository archive is truncated.");
    entries += 1;
    if (entries > limits.maxEntries) throw new Error(`Repository archive exceeds the ${limits.maxEntries} entry limit.`);

    const headerName = paxPath ?? (prefix ? `${prefix}/${name}` : name);
    paxPath = undefined;
    if (type === "x") {
      paxPath = parsePaxPath(archive.subarray(dataStart, dataEnd));
    } else if (type === "1" || type === "2") {
      throw new Error("Repository archive contains a link entry; extraction was refused.");
    } else {
      const relative = safeRelativePath(headerName);
      if (relative) {
        const target = path.resolve(destinationRoot, relative);
        const relation = path.relative(destinationRoot, target);
        if (!relation || relation.startsWith("..") || path.isAbsolute(relation)) {
          throw new Error("Repository archive attempted to write outside the temporary root.");
        }
        if (type === "5") {
          await mkdir(target, { recursive: true, mode: 0o700 });
        } else if (type === "0" || type === "\0") {
          if (size > limits.maxEntryBytes) {
            offset = dataStart + Math.ceil(size / 512) * 512;
            continue;
          }
          await mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
          await writeFile(target, archive.subarray(dataStart, dataEnd), { mode: 0o600, flag: "wx" });
        }
      }
    }
    offset = dataStart + Math.ceil(size / 512) * 512;
  }
}
