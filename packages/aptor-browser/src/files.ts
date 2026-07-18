import { AptorError } from "./errors.js";
import {
  encryptedCredentialPackageSchema,
  holderProfileSchema,
  issuerProfileSchema,
  parseImportedJson,
  requestPackageSchema,
  type AptorEncryptedCredentialPackageV1,
  type AptorHolderProfileV1,
  type AptorIssuerProfileV1,
  type AptorProofRequestPackageV1,
} from "./schemas.js";
import { validateRequestPackage } from "./domain.js";

export type AptorPortableFile =
  | AptorHolderProfileV1
  | AptorIssuerProfileV1
  | AptorEncryptedCredentialPackageV1
  | AptorProofRequestPackageV1;

export function serializePortableFile(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function parseHolderFile(text: string): AptorHolderProfileV1 {
  return holderProfileSchema.parse(parseImportedJson(text));
}

export function parseIssuerFile(text: string): AptorIssuerProfileV1 {
  return issuerProfileSchema.parse(parseImportedJson(text));
}

export function parseCredentialFile(
  text: string,
): AptorEncryptedCredentialPackageV1 {
  return encryptedCredentialPackageSchema.parse(parseImportedJson(text));
}

export function parseRequestFile(text: string): AptorProofRequestPackageV1 {
  return validateRequestPackage(
    requestPackageSchema.parse(parseImportedJson(text)),
  );
}

export function parsePortableFile(text: string): AptorPortableFile {
  const value = parseImportedJson(text);
  if (typeof value !== "object" || value === null || !("format" in value)) {
    throw new AptorError(
      "INVALID_FILE",
      "This file does not contain an Aptor format identifier.",
    );
  }
  const format = (value as { format?: unknown }).format;
  switch (format) {
    case "aptor-holder":
      return holderProfileSchema.parse(value);
    case "aptor-issuer":
      return issuerProfileSchema.parse(value);
    case "aptor-credential":
      return encryptedCredentialPackageSchema.parse(value);
    case "aptor-request":
      return validateRequestPackage(value);
    default:
      throw new AptorError(
        "INVALID_FILE",
        "This file uses an unknown Aptor format.",
      );
  }
}

export function downloadPortableFile(filename: string, text: string): void {
  const blob = new Blob([text], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
