import { createHash } from "node:crypto";

export const BN254_SCALAR_FIELD =
  21888242871839275222246405745257275088548364400416034343698204186575808495617n;

export function normalizeSkill(value) {
  return value.normalize("NFKC").trim().toLowerCase().replace(/\s+/gu, " ");
}

export function encodeSkill(value) {
  const normalized = normalizeSkill(value);
  const digest = createHash("sha256")
    .update("aptor:skill:hsk:v1\0", "utf8")
    .update(normalized, "utf8")
    .digest("hex");
  return { normalized, field: BigInt(`0x${digest}`) % BN254_SCALAR_FIELD };
}

if (process.argv[1] === import.meta.filename) {
  const value = process.argv.slice(2).join(" ");
  if (!value) throw new Error("Usage: node encode-skill.mjs <skill>");
  const encoded = encodeSkill(value);
  process.stdout.write(
    `${JSON.stringify({ normalized: encoded.normalized, field: encoded.field.toString() })}\n`,
  );
}
