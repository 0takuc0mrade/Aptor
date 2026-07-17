export type AptorRole = "issuer" | "professional" | "verifier";

declare const bytes32Brand: unique symbol;
declare const issuerSigningKeyBrand: unique symbol;

export type Bytes32 = Uint8Array & {
  readonly [bytes32Brand]: "Bytes32";
};

export type IssuerSigningKey = bigint & {
  readonly [issuerSigningKeyBrand]: "IssuerSigningKey";
};

export type JubjubPoint = Readonly<{
  x: bigint;
  y: bigint;
}>;

export type JubjubSchnorrSignature = Readonly<{
  announcement: JubjubPoint;
  response: bigint;
}>;

export type UnsignedDurationCredential = Readonly<{
  credentialId: Bytes32;
  holderCommitment: Bytes32;
  durationMonths: bigint;
}>;

export type SignedDurationCredential = Readonly<{
  credential: UnsignedDurationCredential;
  issuerSignature: JubjubSchnorrSignature;
}>;

export type PrivateCredentialBundle = SignedDurationCredential &
  Readonly<{
    holderSecret: Bytes32;
  }>;

export type PublicCredentialProofResult = Readonly<{
  txId: string;
  blockHeight: number;
  minimumDurationMonths: bigint;
  successfulCredentialProofs: bigint;
}>;

export type WorkCredential = {
  credentialId: string;
  holderId: string;
  issuerId: string;
  projectCategory: string;
  skills: string[];
  durationMonths: number;
  deliveredToProduction: boolean;
  clientRating: number;
  issuedAt: number;
  expiresAt: number;
};

export type ProofRequest = {
  requiredSkill?: string;
  minimumDurationMonths?: number;
  requireProductionDelivery?: boolean;
  minimumClientRating?: number;
};

export type ProofRequirement = keyof ProofRequest;

export type ProofRequirementResult = {
  requirement: ProofRequirement;
  passed: boolean;
};
