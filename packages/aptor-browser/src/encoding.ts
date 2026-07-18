import type { JubjubPoint } from "@midnight-ntwrk/compact-runtime";

const HEX_PATTERN = /^[0-9a-f]+$/u;
const POINT_PREFIX = "aptor-jubjub-v1";

export function bytesToHex(value: Uint8Array): string {
  return Array.from(value, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

export function hexToBytes(value: string, expectedBytes?: number): Uint8Array {
  const normalized = value.toLowerCase();
  if (
    normalized.length === 0 ||
    normalized.length % 2 !== 0 ||
    !HEX_PATTERN.test(normalized)
  ) {
    throw new TypeError("Expected an even-length lowercase hexadecimal value.");
  }
  if (expectedBytes !== undefined && normalized.length !== expectedBytes * 2) {
    throw new RangeError(`Expected exactly ${expectedBytes} bytes.`);
  }
  return Uint8Array.from(normalized.match(/.{2}/gu) ?? [], (pair) =>
    Number.parseInt(pair, 16),
  );
}

export function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left[index]! ^ right[index]!;
  }
  return difference === 0;
}

export function pointToString(point: JubjubPoint): string {
  return `${POINT_PREFIX}:${point.x.toString(16).padStart(64, "0")}:${point.y
    .toString(16)
    .padStart(64, "0")}`;
}

export function pointFromString(value: string): JubjubPoint {
  const [prefix, x, y, extra] = value.split(":");
  if (
    prefix !== POINT_PREFIX ||
    x === undefined ||
    y === undefined ||
    extra !== undefined ||
    x.length !== 64 ||
    y.length !== 64 ||
    !HEX_PATTERN.test(x) ||
    !HEX_PATTERN.test(y)
  ) {
    throw new TypeError("Issuer public key has an unsupported encoding.");
  }
  return { x: BigInt(`0x${x}`), y: BigInt(`0x${y}`) };
}

export function randomHex(bytes: number): string {
  return bytesToHex(globalThis.crypto.getRandomValues(new Uint8Array(bytes)));
}

export function toBase64(value: Uint8Array): string {
  let binary = "";
  for (const byte of value) binary += String.fromCharCode(byte);
  return globalThis.btoa(binary);
}

export function fromBase64(value: string): Uint8Array {
  const binary = globalThis.atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export function stableProfileId(): string {
  return `apt_${randomHex(16)}`;
}
