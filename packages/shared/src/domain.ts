export type AptorRole = "issuer" | "professional" | "verifier";

declare const bytes32Brand: unique symbol;
declare const issuerSigningKeyBrand: unique symbol;
declare const transactionIdBrand: unique symbol;
declare const contractAddressBrand: unique symbol;

export type Bytes32 = Uint8Array & {
  readonly [bytes32Brand]: "Bytes32";
};

export type IssuerSigningKey = bigint & {
  readonly [issuerSigningKeyBrand]: "IssuerSigningKey";
};

export type TransactionId = string & {
  readonly [transactionIdBrand]: "TransactionId";
};

export type ContractAddress = string & {
  readonly [contractAddressBrand]: "ContractAddress";
};

export type JubjubPoint = Readonly<{
  x: bigint;
  y: bigint;
}>;

export type JubjubSchnorrSignature = Readonly<{
  announcement: JubjubPoint;
  response: bigint;
}>;

export type MerkleTreeDigest = Readonly<{
  field: bigint;
}>;

export type MerkleTreePath<T> = Readonly<{
  leaf: T;
  path: readonly Readonly<{
    sibling: MerkleTreeDigest;
    goes_left: boolean;
  }>[];
}>;

export type WorkCredentialV1 = Readonly<{
  credentialId: Bytes32;
  holderCommitment: Bytes32;
  skillsRoot: MerkleTreeDigest;
  durationMonths: bigint;
  deliveredToProduction: boolean;
  clientRatingHundredths: bigint;
}>;

export type SignedWorkCredentialV1 = Readonly<{
  credential: WorkCredentialV1;
  issuerSignature: JubjubSchnorrSignature;
}>;

export type PrivateCredentialBundleV1 = SignedWorkCredentialV1 &
  Readonly<{
    issuerPublicKey: JubjubPoint;
    issuerMembershipPath: MerkleTreePath<JubjubPoint>;
    holderSecret: Bytes32;
    privateSkills: readonly Bytes32[];
    requiredSkillMembershipPath: MerkleTreePath<Bytes32>;
  }>;

export type ProofRequestV1 = Readonly<{
  requestId: Bytes32;
  acceptedIssuerRoot: MerkleTreeDigest;
  checkSkill: boolean;
  requiredSkillId: Bytes32;
  checkDuration: boolean;
  minimumDurationMonths: bigint;
  requireProductionDelivery: boolean;
  checkClientRating: boolean;
  minimumClientRatingHundredths: bigint;
}>;

export type RegisteredProofRequestV1 = Readonly<{
  request: ProofRequestV1;
  requestCommitment: Bytes32;
  contractAddress: ContractAddress;
  transactionId: TransactionId;
  blockHeight: number;
}>;

export type ProofReceiptV1 = Readonly<{
  requestId: Bytes32;
  requestCommitment: Bytes32;
  fulfilled: true;
  contractAddress: ContractAddress;
  transactionId: TransactionId;
  blockHeight: number;
}>;
