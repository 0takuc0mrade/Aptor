export type AptorRole = "issuer" | "professional" | "verifier";

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
