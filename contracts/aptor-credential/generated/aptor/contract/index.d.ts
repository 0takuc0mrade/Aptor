import type * as __compactRuntime from '@midnight-ntwrk/compact-runtime';

export type WorkCredentialV1 = { credentialId: Uint8Array;
                                 holderCommitment: Uint8Array;
                                 skillsRoot: { field: bigint };
                                 durationMonths: bigint;
                                 deliveredToProduction: boolean;
                                 clientRatingHundredths: bigint
                               };

export type ProofRequestV1 = { requestId: Uint8Array;
                               acceptedIssuerRoot: { field: bigint };
                               checkSkill: boolean;
                               requiredSkillId: Uint8Array;
                               checkDuration: boolean;
                               minimumDurationMonths: bigint;
                               requireProductionDelivery: boolean;
                               checkClientRating: boolean;
                               minimumClientRatingHundredths: bigint
                             };

export type Schnorr_SchnorrSignature = { announcement: __compactRuntime.JubjubPoint;
                                         response: bigint
                                       };

export type Witnesses<PS> = {
  getSchnorrReduction(context: __compactRuntime.WitnessContext<Ledger, PS>,
                      challengeHash_0: bigint): [PS, [bigint, bigint]];
  getCredentialBundle(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, [WorkCredentialV1,
                                                                                   __compactRuntime.JubjubPoint,
                                                                                   Schnorr_SchnorrSignature,
                                                                                   { leaf: __compactRuntime.JubjubPoint,
                                                                                     path: { sibling: { field: bigint
                                                                                                      },
                                                                                             goes_left: boolean
                                                                                           }[]
                                                                                   },
                                                                                   Uint8Array,
                                                                                   { leaf: Uint8Array,
                                                                                     path: { sibling: { field: bigint
                                                                                                      },
                                                                                             goes_left: boolean
                                                                                           }[]
                                                                                   }]];
}

export type ImpureCircuits<PS> = {
  createProofRequest(context: __compactRuntime.CircuitContext<PS>,
                     requestId_0: Uint8Array,
                     requestCommitment_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  proveAgainstRequest(context: __compactRuntime.CircuitContext<PS>,
                      request_0: ProofRequestV1): __compactRuntime.CircuitResults<PS, []>;
}

export type ProvableCircuits<PS> = {
  createProofRequest(context: __compactRuntime.CircuitContext<PS>,
                     requestId_0: Uint8Array,
                     requestCommitment_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  proveAgainstRequest(context: __compactRuntime.CircuitContext<PS>,
                      request_0: ProofRequestV1): __compactRuntime.CircuitResults<PS, []>;
}

export type PureCircuits = {
  deriveHolderCommitment(holderSecret_0: Uint8Array): Uint8Array;
  deriveCanonicalSkillId(normalizedSkillBytes_0: Uint8Array,
                         normalizedSkillLength_0: bigint): Uint8Array;
  deriveWorkCredentialDigest(credential_0: WorkCredentialV1): Uint8Array;
  deriveProofRequestCommitment(request_0: ProofRequestV1): Uint8Array;
  deriveSkillPathRoot(path_0: { leaf: Uint8Array,
                                path: { sibling: { field: bigint },
                                        goes_left: boolean
                                      }[]
                              }): { field: bigint };
  deriveIssuerPathRoot(path_0: { leaf: __compactRuntime.JubjubPoint,
                                 path: { sibling: { field: bigint },
                                         goes_left: boolean
                                       }[]
                               }): { field: bigint };
  schnorrChallenge(ann_x_0: bigint,
                   ann_y_0: bigint,
                   pk_x_0: bigint,
                   pk_y_0: bigint,
                   msg_0: bigint[]): bigint;
}

export type Circuits<PS> = {
  deriveHolderCommitment(context: __compactRuntime.CircuitContext<PS>,
                         holderSecret_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
  deriveCanonicalSkillId(context: __compactRuntime.CircuitContext<PS>,
                         normalizedSkillBytes_0: Uint8Array,
                         normalizedSkillLength_0: bigint): __compactRuntime.CircuitResults<PS, Uint8Array>;
  deriveWorkCredentialDigest(context: __compactRuntime.CircuitContext<PS>,
                             credential_0: WorkCredentialV1): __compactRuntime.CircuitResults<PS, Uint8Array>;
  deriveProofRequestCommitment(context: __compactRuntime.CircuitContext<PS>,
                               request_0: ProofRequestV1): __compactRuntime.CircuitResults<PS, Uint8Array>;
  deriveSkillPathRoot(context: __compactRuntime.CircuitContext<PS>,
                      path_0: { leaf: Uint8Array,
                                path: { sibling: { field: bigint },
                                        goes_left: boolean
                                      }[]
                              }): __compactRuntime.CircuitResults<PS, { field: bigint
                                                                      }>;
  deriveIssuerPathRoot(context: __compactRuntime.CircuitContext<PS>,
                       path_0: { leaf: __compactRuntime.JubjubPoint,
                                 path: { sibling: { field: bigint },
                                         goes_left: boolean
                                       }[]
                               }): __compactRuntime.CircuitResults<PS, { field: bigint
                                                                       }>;
  schnorrChallenge(context: __compactRuntime.CircuitContext<PS>,
                   ann_x_0: bigint,
                   ann_y_0: bigint,
                   pk_x_0: bigint,
                   pk_y_0: bigint,
                   msg_0: bigint[]): __compactRuntime.CircuitResults<PS, bigint>;
  createProofRequest(context: __compactRuntime.CircuitContext<PS>,
                     requestId_0: Uint8Array,
                     requestCommitment_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  proveAgainstRequest(context: __compactRuntime.CircuitContext<PS>,
                      request_0: ProofRequestV1): __compactRuntime.CircuitResults<PS, []>;
}

export type Ledger = {
  requestCommitments: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): Uint8Array;
    [Symbol.iterator](): Iterator<[Uint8Array, Uint8Array]>
  };
  fulfilledRequests: {
    isEmpty(): boolean;
    size(): bigint;
    member(elem_0: Uint8Array): boolean;
    [Symbol.iterator](): Iterator<Uint8Array>
  };
}

export type ContractReferenceLocations = any;

export declare const contractReferenceLocations : ContractReferenceLocations;

export declare class Contract<PS = any, W extends Witnesses<PS> = Witnesses<PS>> {
  witnesses: W;
  circuits: Circuits<PS>;
  impureCircuits: ImpureCircuits<PS>;
  provableCircuits: ProvableCircuits<PS>;
  constructor(witnesses: W);
  initialState(context: __compactRuntime.ConstructorContext<PS>): __compactRuntime.ConstructorResult<PS>;
}

export declare function ledger(state: __compactRuntime.StateValue | __compactRuntime.ChargedState): Ledger;
export declare const pureCircuits: PureCircuits;
