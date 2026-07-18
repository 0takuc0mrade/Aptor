export type AptorErrorCode =
  | "VAULT_LOCKED"
  | "VAULT_NOT_FOUND"
  | "INVALID_VAULT_PASSWORD"
  | "INVALID_FILE"
  | "UNSUPPORTED_VERSION"
  | "CREDENTIAL_PACKAGE_ALTERED"
  | "INVALID_ISSUER_SIGNATURE"
  | "WRONG_HOLDER"
  | "CREDENTIAL_CANNOT_SATISFY_REQUEST"
  | "REQUEST_COMMITMENT_MISMATCH"
  | "REQUEST_NOT_REGISTERED"
  | "REQUEST_ALREADY_FULFILLED"
  | "WRONG_NETWORK"
  | "WRONG_CONTRACT"
  | "UNSUPPORTED_ISSUER"
  | "WALLET_NOT_DETECTED"
  | "WALLET_CONNECTION_REJECTED"
  | "WALLET_CONNECTION_LOST"
  | "MISSING_ZK_ARTIFACTS"
  | "PROOF_GENERATION_FAILED"
  | "TRANSACTION_SUBMISSION_FAILED"
  | "FINALIZATION_TIMEOUT";

export class AptorError extends Error {
  constructor(
    readonly code: AptorErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "AptorError";
  }
}

export function asAptorError(error: unknown): AptorError {
  if (error instanceof AptorError) return error;
  return new AptorError(
    "INVALID_FILE",
    error instanceof Error
      ? error.message
      : "The operation could not be completed.",
    { cause: error },
  );
}
