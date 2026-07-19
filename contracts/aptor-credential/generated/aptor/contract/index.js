import * as __compactRuntime from '@midnight-ntwrk/compact-runtime';
__compactRuntime.checkRuntimeVersion('0.16.0');

const _descriptor_0 = new __compactRuntime.CompactTypeBytes(32);

const _descriptor_1 = __compactRuntime.CompactTypeBoolean;

const _descriptor_2 = __compactRuntime.CompactTypeField;

class _MerkleTreeDigest_0 {
  alignment() {
    return _descriptor_2.alignment();
  }
  fromValue(value_0) {
    return {
      field: _descriptor_2.fromValue(value_0)
    }
  }
  toValue(value_0) {
    return _descriptor_2.toValue(value_0.field);
  }
}

const _descriptor_3 = new _MerkleTreeDigest_0();

const _descriptor_4 = new __compactRuntime.CompactTypeUnsignedInteger(65535n, 2);

class _ProofRequestV1_0 {
  alignment() {
    return _descriptor_0.alignment().concat(_descriptor_3.alignment().concat(_descriptor_1.alignment().concat(_descriptor_0.alignment().concat(_descriptor_1.alignment().concat(_descriptor_4.alignment().concat(_descriptor_1.alignment().concat(_descriptor_1.alignment().concat(_descriptor_4.alignment()))))))));
  }
  fromValue(value_0) {
    return {
      requestId: _descriptor_0.fromValue(value_0),
      acceptedIssuerRoot: _descriptor_3.fromValue(value_0),
      checkSkill: _descriptor_1.fromValue(value_0),
      requiredSkillId: _descriptor_0.fromValue(value_0),
      checkDuration: _descriptor_1.fromValue(value_0),
      minimumDurationMonths: _descriptor_4.fromValue(value_0),
      requireProductionDelivery: _descriptor_1.fromValue(value_0),
      checkClientRating: _descriptor_1.fromValue(value_0),
      minimumClientRatingHundredths: _descriptor_4.fromValue(value_0)
    }
  }
  toValue(value_0) {
    return _descriptor_0.toValue(value_0.requestId).concat(_descriptor_3.toValue(value_0.acceptedIssuerRoot).concat(_descriptor_1.toValue(value_0.checkSkill).concat(_descriptor_0.toValue(value_0.requiredSkillId).concat(_descriptor_1.toValue(value_0.checkDuration).concat(_descriptor_4.toValue(value_0.minimumDurationMonths).concat(_descriptor_1.toValue(value_0.requireProductionDelivery).concat(_descriptor_1.toValue(value_0.checkClientRating).concat(_descriptor_4.toValue(value_0.minimumClientRatingHundredths)))))))));
  }
}

const _descriptor_5 = new _ProofRequestV1_0();

const _descriptor_6 = new __compactRuntime.CompactTypeVector(4, _descriptor_2);

const _descriptor_7 = __compactRuntime.CompactTypeJubjubPoint;

class _MerkleTreePathEntry_0 {
  alignment() {
    return _descriptor_3.alignment().concat(_descriptor_1.alignment());
  }
  fromValue(value_0) {
    return {
      sibling: _descriptor_3.fromValue(value_0),
      goes_left: _descriptor_1.fromValue(value_0)
    }
  }
  toValue(value_0) {
    return _descriptor_3.toValue(value_0.sibling).concat(_descriptor_1.toValue(value_0.goes_left));
  }
}

const _descriptor_8 = new _MerkleTreePathEntry_0();

const _descriptor_9 = new __compactRuntime.CompactTypeVector(5, _descriptor_8);

class _MerkleTreePath_0 {
  alignment() {
    return _descriptor_7.alignment().concat(_descriptor_9.alignment());
  }
  fromValue(value_0) {
    return {
      leaf: _descriptor_7.fromValue(value_0),
      path: _descriptor_9.fromValue(value_0)
    }
  }
  toValue(value_0) {
    return _descriptor_7.toValue(value_0.leaf).concat(_descriptor_9.toValue(value_0.path));
  }
}

const _descriptor_10 = new _MerkleTreePath_0();

class _MerkleTreePath_1 {
  alignment() {
    return _descriptor_0.alignment().concat(_descriptor_9.alignment());
  }
  fromValue(value_0) {
    return {
      leaf: _descriptor_0.fromValue(value_0),
      path: _descriptor_9.fromValue(value_0)
    }
  }
  toValue(value_0) {
    return _descriptor_0.toValue(value_0.leaf).concat(_descriptor_9.toValue(value_0.path));
  }
}

const _descriptor_11 = new _MerkleTreePath_1();

const _descriptor_12 = new __compactRuntime.CompactTypeBytes(64);

const _descriptor_13 = new __compactRuntime.CompactTypeUnsignedInteger(255n, 1);

class _WorkCredentialV1_0 {
  alignment() {
    return _descriptor_0.alignment().concat(_descriptor_0.alignment().concat(_descriptor_3.alignment().concat(_descriptor_4.alignment().concat(_descriptor_1.alignment().concat(_descriptor_4.alignment())))));
  }
  fromValue(value_0) {
    return {
      credentialId: _descriptor_0.fromValue(value_0),
      holderCommitment: _descriptor_0.fromValue(value_0),
      skillsRoot: _descriptor_3.fromValue(value_0),
      durationMonths: _descriptor_4.fromValue(value_0),
      deliveredToProduction: _descriptor_1.fromValue(value_0),
      clientRatingHundredths: _descriptor_4.fromValue(value_0)
    }
  }
  toValue(value_0) {
    return _descriptor_0.toValue(value_0.credentialId).concat(_descriptor_0.toValue(value_0.holderCommitment).concat(_descriptor_3.toValue(value_0.skillsRoot).concat(_descriptor_4.toValue(value_0.durationMonths).concat(_descriptor_1.toValue(value_0.deliveredToProduction).concat(_descriptor_4.toValue(value_0.clientRatingHundredths))))));
  }
}

const _descriptor_14 = new _WorkCredentialV1_0();

class _SchnorrSignature_0 {
  alignment() {
    return _descriptor_7.alignment().concat(_descriptor_2.alignment());
  }
  fromValue(value_0) {
    return {
      announcement: _descriptor_7.fromValue(value_0),
      response: _descriptor_2.fromValue(value_0)
    }
  }
  toValue(value_0) {
    return _descriptor_7.toValue(value_0.announcement).concat(_descriptor_2.toValue(value_0.response));
  }
}

const _descriptor_15 = new _SchnorrSignature_0();

class _tuple_0 {
  alignment() {
    return _descriptor_14.alignment().concat(_descriptor_7.alignment().concat(_descriptor_15.alignment().concat(_descriptor_10.alignment().concat(_descriptor_0.alignment().concat(_descriptor_11.alignment())))));
  }
  fromValue(value_0) {
    return [
      _descriptor_14.fromValue(value_0),
      _descriptor_7.fromValue(value_0),
      _descriptor_15.fromValue(value_0),
      _descriptor_10.fromValue(value_0),
      _descriptor_0.fromValue(value_0),
      _descriptor_11.fromValue(value_0)
    ]
  }
  toValue(value_0) {
    return _descriptor_14.toValue(value_0[0]).concat(_descriptor_7.toValue(value_0[1]).concat(_descriptor_15.toValue(value_0[2]).concat(_descriptor_10.toValue(value_0[3]).concat(_descriptor_0.toValue(value_0[4]).concat(_descriptor_11.toValue(value_0[5]))))));
  }
}

const _descriptor_16 = new _tuple_0();

const _descriptor_17 = new __compactRuntime.CompactTypeUnsignedInteger(452312848583266388373324160190187140051835877600158453279131187530910662655n, 31);

class _tuple_1 {
  alignment() {
    return _descriptor_2.alignment().concat(_descriptor_17.alignment());
  }
  fromValue(value_0) {
    return [
      _descriptor_2.fromValue(value_0),
      _descriptor_17.fromValue(value_0)
    ]
  }
  toValue(value_0) {
    return _descriptor_2.toValue(value_0[0]).concat(_descriptor_17.toValue(value_0[1]));
  }
}

const _descriptor_18 = new _tuple_1();

const _descriptor_19 = new __compactRuntime.CompactTypeBytes(6);

class _LeafPreimage_0 {
  alignment() {
    return _descriptor_19.alignment().concat(_descriptor_7.alignment());
  }
  fromValue(value_0) {
    return {
      domain_sep: _descriptor_19.fromValue(value_0),
      data: _descriptor_7.fromValue(value_0)
    }
  }
  toValue(value_0) {
    return _descriptor_19.toValue(value_0.domain_sep).concat(_descriptor_7.toValue(value_0.data));
  }
}

const _descriptor_20 = new _LeafPreimage_0();

const _descriptor_21 = new __compactRuntime.CompactTypeBytes(22);

class _tuple_2 {
  alignment() {
    return _descriptor_21.alignment().concat(_descriptor_0.alignment().concat(_descriptor_3.alignment().concat(_descriptor_1.alignment().concat(_descriptor_0.alignment().concat(_descriptor_1.alignment().concat(_descriptor_4.alignment().concat(_descriptor_1.alignment().concat(_descriptor_1.alignment().concat(_descriptor_4.alignment())))))))));
  }
  fromValue(value_0) {
    return [
      _descriptor_21.fromValue(value_0),
      _descriptor_0.fromValue(value_0),
      _descriptor_3.fromValue(value_0),
      _descriptor_1.fromValue(value_0),
      _descriptor_0.fromValue(value_0),
      _descriptor_1.fromValue(value_0),
      _descriptor_4.fromValue(value_0),
      _descriptor_1.fromValue(value_0),
      _descriptor_1.fromValue(value_0),
      _descriptor_4.fromValue(value_0)
    ]
  }
  toValue(value_0) {
    return _descriptor_21.toValue(value_0[0]).concat(_descriptor_0.toValue(value_0[1]).concat(_descriptor_3.toValue(value_0[2]).concat(_descriptor_1.toValue(value_0[3]).concat(_descriptor_0.toValue(value_0[4]).concat(_descriptor_1.toValue(value_0[5]).concat(_descriptor_4.toValue(value_0[6]).concat(_descriptor_1.toValue(value_0[7]).concat(_descriptor_1.toValue(value_0[8]).concat(_descriptor_4.toValue(value_0[9]))))))))));
  }
}

const _descriptor_22 = new _tuple_2();

class _LeafPreimage_1 {
  alignment() {
    return _descriptor_19.alignment().concat(_descriptor_0.alignment());
  }
  fromValue(value_0) {
    return {
      domain_sep: _descriptor_19.fromValue(value_0),
      data: _descriptor_0.fromValue(value_0)
    }
  }
  toValue(value_0) {
    return _descriptor_19.toValue(value_0.domain_sep).concat(_descriptor_0.toValue(value_0.data));
  }
}

const _descriptor_23 = new _LeafPreimage_1();

const _descriptor_24 = new __compactRuntime.CompactTypeBytes(17);

class _tuple_3 {
  alignment() {
    return _descriptor_24.alignment().concat(_descriptor_12.alignment().concat(_descriptor_13.alignment()));
  }
  fromValue(value_0) {
    return [
      _descriptor_24.fromValue(value_0),
      _descriptor_12.fromValue(value_0),
      _descriptor_13.fromValue(value_0)
    ]
  }
  toValue(value_0) {
    return _descriptor_24.toValue(value_0[0]).concat(_descriptor_12.toValue(value_0[1]).concat(_descriptor_13.toValue(value_0[2])));
  }
}

const _descriptor_25 = new _tuple_3();

const _descriptor_26 = new __compactRuntime.CompactTypeBytes(24);

class _tuple_4 {
  alignment() {
    return _descriptor_26.alignment().concat(_descriptor_0.alignment().concat(_descriptor_0.alignment().concat(_descriptor_3.alignment().concat(_descriptor_4.alignment().concat(_descriptor_1.alignment().concat(_descriptor_4.alignment()))))));
  }
  fromValue(value_0) {
    return [
      _descriptor_26.fromValue(value_0),
      _descriptor_0.fromValue(value_0),
      _descriptor_0.fromValue(value_0),
      _descriptor_3.fromValue(value_0),
      _descriptor_4.fromValue(value_0),
      _descriptor_1.fromValue(value_0),
      _descriptor_4.fromValue(value_0)
    ]
  }
  toValue(value_0) {
    return _descriptor_26.toValue(value_0[0]).concat(_descriptor_0.toValue(value_0[1]).concat(_descriptor_0.toValue(value_0[2]).concat(_descriptor_3.toValue(value_0[3]).concat(_descriptor_4.toValue(value_0[4]).concat(_descriptor_1.toValue(value_0[5]).concat(_descriptor_4.toValue(value_0[6])))))));
  }
}

const _descriptor_27 = new _tuple_4();

class _SchnorrHashInput_0 {
  alignment() {
    return _descriptor_2.alignment().concat(_descriptor_2.alignment().concat(_descriptor_2.alignment().concat(_descriptor_2.alignment().concat(_descriptor_6.alignment()))));
  }
  fromValue(value_0) {
    return {
      ann_x: _descriptor_2.fromValue(value_0),
      ann_y: _descriptor_2.fromValue(value_0),
      pk_x: _descriptor_2.fromValue(value_0),
      pk_y: _descriptor_2.fromValue(value_0),
      msg: _descriptor_6.fromValue(value_0)
    }
  }
  toValue(value_0) {
    return _descriptor_2.toValue(value_0.ann_x).concat(_descriptor_2.toValue(value_0.ann_y).concat(_descriptor_2.toValue(value_0.pk_x).concat(_descriptor_2.toValue(value_0.pk_y).concat(_descriptor_6.toValue(value_0.msg)))));
  }
}

const _descriptor_28 = new _SchnorrHashInput_0();

const _descriptor_29 = new __compactRuntime.CompactTypeBytes(15);

class _tuple_5 {
  alignment() {
    return _descriptor_29.alignment().concat(_descriptor_0.alignment());
  }
  fromValue(value_0) {
    return [
      _descriptor_29.fromValue(value_0),
      _descriptor_0.fromValue(value_0)
    ]
  }
  toValue(value_0) {
    return _descriptor_29.toValue(value_0[0]).concat(_descriptor_0.toValue(value_0[1]));
  }
}

const _descriptor_30 = new _tuple_5();

const _descriptor_31 = new __compactRuntime.CompactTypeVector(2, _descriptor_2);

const _descriptor_32 = new __compactRuntime.CompactTypeUnsignedInteger(18446744073709551615n, 8);

class _Either_0 {
  alignment() {
    return _descriptor_1.alignment().concat(_descriptor_0.alignment().concat(_descriptor_0.alignment()));
  }
  fromValue(value_0) {
    return {
      is_left: _descriptor_1.fromValue(value_0),
      left: _descriptor_0.fromValue(value_0),
      right: _descriptor_0.fromValue(value_0)
    }
  }
  toValue(value_0) {
    return _descriptor_1.toValue(value_0.is_left).concat(_descriptor_0.toValue(value_0.left).concat(_descriptor_0.toValue(value_0.right)));
  }
}

const _descriptor_33 = new _Either_0();

const _descriptor_34 = new __compactRuntime.CompactTypeUnsignedInteger(340282366920938463463374607431768211455n, 16);

class _ContractAddress_0 {
  alignment() {
    return _descriptor_0.alignment();
  }
  fromValue(value_0) {
    return {
      bytes: _descriptor_0.fromValue(value_0)
    }
  }
  toValue(value_0) {
    return _descriptor_0.toValue(value_0.bytes);
  }
}

const _descriptor_35 = new _ContractAddress_0();

export class Contract {
  witnesses;
  constructor(...args_0) {
    if (args_0.length !== 1) {
      throw new __compactRuntime.CompactError(`Contract constructor: expected 1 argument, received ${args_0.length}`);
    }
    const witnesses_0 = args_0[0];
    if (typeof(witnesses_0) !== 'object') {
      throw new __compactRuntime.CompactError('first (witnesses) argument to Contract constructor is not an object');
    }
    if (typeof(witnesses_0.getSchnorrReduction) !== 'function') {
      throw new __compactRuntime.CompactError('first (witnesses) argument to Contract constructor does not contain a function-valued field named getSchnorrReduction');
    }
    if (typeof(witnesses_0.getCredentialBundle) !== 'function') {
      throw new __compactRuntime.CompactError('first (witnesses) argument to Contract constructor does not contain a function-valued field named getCredentialBundle');
    }
    this.witnesses = witnesses_0;
    this.circuits = {
      deriveHolderCommitment(context, ...args_1) {
        return { result: pureCircuits.deriveHolderCommitment(...args_1), context };
      },
      deriveCanonicalSkillId(context, ...args_1) {
        return { result: pureCircuits.deriveCanonicalSkillId(...args_1), context };
      },
      deriveWorkCredentialDigest(context, ...args_1) {
        return { result: pureCircuits.deriveWorkCredentialDigest(...args_1), context };
      },
      deriveProofRequestCommitment(context, ...args_1) {
        return { result: pureCircuits.deriveProofRequestCommitment(...args_1), context };
      },
      deriveSkillPathRoot(context, ...args_1) {
        return { result: pureCircuits.deriveSkillPathRoot(...args_1), context };
      },
      deriveIssuerPathRoot(context, ...args_1) {
        return { result: pureCircuits.deriveIssuerPathRoot(...args_1), context };
      },
      schnorrChallenge(context, ...args_1) {
        return { result: pureCircuits.schnorrChallenge(...args_1), context };
      },
      createProofRequest: (...args_1) => {
        if (args_1.length !== 3) {
          throw new __compactRuntime.CompactError(`createProofRequest: expected 3 arguments (as invoked from Typescript), received ${args_1.length}`);
        }
        const contextOrig_0 = args_1[0];
        const requestId_0 = args_1[1];
        const requestCommitment_0 = args_1[2];
        if (!(typeof(contextOrig_0) === 'object' && contextOrig_0.currentQueryContext != undefined)) {
          __compactRuntime.typeError('createProofRequest',
                                     'argument 1 (as invoked from Typescript)',
                                     'aptor.compact line 118 char 1',
                                     'CircuitContext',
                                     contextOrig_0)
        }
        if (!(requestId_0.buffer instanceof ArrayBuffer && requestId_0.BYTES_PER_ELEMENT === 1 && requestId_0.length === 32)) {
          __compactRuntime.typeError('createProofRequest',
                                     'argument 1 (argument 2 as invoked from Typescript)',
                                     'aptor.compact line 118 char 1',
                                     'Bytes<32>',
                                     requestId_0)
        }
        if (!(requestCommitment_0.buffer instanceof ArrayBuffer && requestCommitment_0.BYTES_PER_ELEMENT === 1 && requestCommitment_0.length === 32)) {
          __compactRuntime.typeError('createProofRequest',
                                     'argument 2 (argument 3 as invoked from Typescript)',
                                     'aptor.compact line 118 char 1',
                                     'Bytes<32>',
                                     requestCommitment_0)
        }
        const context = { ...contextOrig_0, gasCost: __compactRuntime.emptyRunningCost() };
        const partialProofData = {
          input: {
            value: _descriptor_0.toValue(requestId_0).concat(_descriptor_0.toValue(requestCommitment_0)),
            alignment: _descriptor_0.alignment().concat(_descriptor_0.alignment())
          },
          output: undefined,
          publicTranscript: [],
          privateTranscriptOutputs: []
        };
        const result_0 = this._createProofRequest_0(context,
                                                    partialProofData,
                                                    requestId_0,
                                                    requestCommitment_0);
        partialProofData.output = { value: [], alignment: [] };
        return { result: result_0, context: context, proofData: partialProofData, gasCost: context.gasCost };
      },
      proveAgainstRequest: (...args_1) => {
        if (args_1.length !== 2) {
          throw new __compactRuntime.CompactError(`proveAgainstRequest: expected 2 arguments (as invoked from Typescript), received ${args_1.length}`);
        }
        const contextOrig_0 = args_1[0];
        const request_0 = args_1[1];
        if (!(typeof(contextOrig_0) === 'object' && contextOrig_0.currentQueryContext != undefined)) {
          __compactRuntime.typeError('proveAgainstRequest',
                                     'argument 1 (as invoked from Typescript)',
                                     'aptor.compact line 123 char 1',
                                     'CircuitContext',
                                     contextOrig_0)
        }
        if (!(typeof(request_0) === 'object' && request_0.requestId.buffer instanceof ArrayBuffer && request_0.requestId.BYTES_PER_ELEMENT === 1 && request_0.requestId.length === 32 && typeof(request_0.acceptedIssuerRoot) === 'object' && typeof(request_0.acceptedIssuerRoot.field) === 'bigint' && request_0.acceptedIssuerRoot.field >= 0 && request_0.acceptedIssuerRoot.field <= __compactRuntime.MAX_FIELD && typeof(request_0.checkSkill) === 'boolean' && request_0.requiredSkillId.buffer instanceof ArrayBuffer && request_0.requiredSkillId.BYTES_PER_ELEMENT === 1 && request_0.requiredSkillId.length === 32 && typeof(request_0.checkDuration) === 'boolean' && typeof(request_0.minimumDurationMonths) === 'bigint' && request_0.minimumDurationMonths >= 0n && request_0.minimumDurationMonths <= 65535n && typeof(request_0.requireProductionDelivery) === 'boolean' && typeof(request_0.checkClientRating) === 'boolean' && typeof(request_0.minimumClientRatingHundredths) === 'bigint' && request_0.minimumClientRatingHundredths >= 0n && request_0.minimumClientRatingHundredths <= 65535n)) {
          __compactRuntime.typeError('proveAgainstRequest',
                                     'argument 1 (argument 2 as invoked from Typescript)',
                                     'aptor.compact line 123 char 1',
                                     'struct ProofRequestV1<requestId: Bytes<32>, acceptedIssuerRoot: struct MerkleTreeDigest<field: Field>, checkSkill: Boolean, requiredSkillId: Bytes<32>, checkDuration: Boolean, minimumDurationMonths: Uint<0..65536>, requireProductionDelivery: Boolean, checkClientRating: Boolean, minimumClientRatingHundredths: Uint<0..65536>>',
                                     request_0)
        }
        const context = { ...contextOrig_0, gasCost: __compactRuntime.emptyRunningCost() };
        const partialProofData = {
          input: {
            value: _descriptor_5.toValue(request_0),
            alignment: _descriptor_5.alignment()
          },
          output: undefined,
          publicTranscript: [],
          privateTranscriptOutputs: []
        };
        const result_0 = this._proveAgainstRequest_0(context,
                                                     partialProofData,
                                                     request_0);
        partialProofData.output = { value: [], alignment: [] };
        return { result: result_0, context: context, proofData: partialProofData, gasCost: context.gasCost };
      }
    };
    this.impureCircuits = {
      createProofRequest: this.circuits.createProofRequest,
      proveAgainstRequest: this.circuits.proveAgainstRequest
    };
    this.provableCircuits = {
      createProofRequest: this.circuits.createProofRequest,
      proveAgainstRequest: this.circuits.proveAgainstRequest
    };
  }
  initialState(...args_0) {
    if (args_0.length !== 1) {
      throw new __compactRuntime.CompactError(`Contract state constructor: expected 1 argument (as invoked from Typescript), received ${args_0.length}`);
    }
    const constructorContext_0 = args_0[0];
    if (typeof(constructorContext_0) !== 'object') {
      throw new __compactRuntime.CompactError(`Contract state constructor: expected 'constructorContext' in argument 1 (as invoked from Typescript) to be an object`);
    }
    if (!('initialPrivateState' in constructorContext_0)) {
      throw new __compactRuntime.CompactError(`Contract state constructor: expected 'initialPrivateState' in argument 1 (as invoked from Typescript)`);
    }
    if (!('initialZswapLocalState' in constructorContext_0)) {
      throw new __compactRuntime.CompactError(`Contract state constructor: expected 'initialZswapLocalState' in argument 1 (as invoked from Typescript)`);
    }
    if (typeof(constructorContext_0.initialZswapLocalState) !== 'object') {
      throw new __compactRuntime.CompactError(`Contract state constructor: expected 'initialZswapLocalState' in argument 1 (as invoked from Typescript) to be an object`);
    }
    const state_0 = new __compactRuntime.ContractState();
    let stateValue_0 = __compactRuntime.StateValue.newArray();
    stateValue_0 = stateValue_0.arrayPush(__compactRuntime.StateValue.newNull());
    stateValue_0 = stateValue_0.arrayPush(__compactRuntime.StateValue.newNull());
    state_0.data = new __compactRuntime.ChargedState(stateValue_0);
    state_0.setOperation('createProofRequest', new __compactRuntime.ContractOperation());
    state_0.setOperation('proveAgainstRequest', new __compactRuntime.ContractOperation());
    const context = __compactRuntime.createCircuitContext(__compactRuntime.dummyContractAddress(), constructorContext_0.initialZswapLocalState.coinPublicKey, state_0.data, constructorContext_0.initialPrivateState);
    const partialProofData = {
      input: { value: [], alignment: [] },
      output: undefined,
      publicTranscript: [],
      privateTranscriptOutputs: []
    };
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_13.toValue(0n),
                                                                                              alignment: _descriptor_13.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newMap(
                                                          new __compactRuntime.StateMap()
                                                        ).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_13.toValue(1n),
                                                                                              alignment: _descriptor_13.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newMap(
                                                          new __compactRuntime.StateMap()
                                                        ).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    state_0.data = new __compactRuntime.ChargedState(context.currentQueryContext.state.state);
    return {
      currentContractState: state_0,
      currentPrivateState: context.currentPrivateState,
      currentZswapLocalState: context.currentZswapLocalState
    }
  }
  _merkleTreePathRoot_0(path_0) {
    return { field:
               this._folder_0((...args_0) =>
                                this._merkleTreePathEntryRoot_0(...args_0),
                              this._degradeToTransient_0(this._persistentHash_4({ domain_sep:
                                                                                    new Uint8Array([109, 100, 110, 58, 108, 104]),
                                                                                  data:
                                                                                    path_0.leaf })),
                              path_0.path) };
  }
  _merkleTreePathRoot_1(path_0) {
    return { field:
               this._folder_1((...args_0) =>
                                this._merkleTreePathEntryRoot_0(...args_0),
                              this._degradeToTransient_0(this._persistentHash_5({ domain_sep:
                                                                                    new Uint8Array([109, 100, 110, 58, 108, 104]),
                                                                                  data:
                                                                                    path_0.leaf })),
                              path_0.path) };
  }
  _merkleTreePathEntryRoot_0(recursiveDigest_0, entry_0) {
    const left_0 = entry_0.goes_left ? recursiveDigest_0 : entry_0.sibling.field;
    const right_0 = entry_0.goes_left ?
                    entry_0.sibling.field :
                    recursiveDigest_0;
    return this._transientHash_0([left_0, right_0]);
  }
  _transientHash_0(value_0) {
    const result_0 = __compactRuntime.transientHash(_descriptor_31, value_0);
    return result_0;
  }
  _transientHash_1(value_0) {
    const result_0 = __compactRuntime.transientHash(_descriptor_0, value_0);
    return result_0;
  }
  _transientHash_2(value_0) {
    const result_0 = __compactRuntime.transientHash(_descriptor_28, value_0);
    return result_0;
  }
  _persistentHash_0(value_0) {
    const result_0 = __compactRuntime.persistentHash(_descriptor_30, value_0);
    return result_0;
  }
  _persistentHash_1(value_0) {
    const result_0 = __compactRuntime.persistentHash(_descriptor_25, value_0);
    return result_0;
  }
  _persistentHash_2(value_0) {
    const result_0 = __compactRuntime.persistentHash(_descriptor_27, value_0);
    return result_0;
  }
  _persistentHash_3(value_0) {
    const result_0 = __compactRuntime.persistentHash(_descriptor_22, value_0);
    return result_0;
  }
  _persistentHash_4(value_0) {
    const result_0 = __compactRuntime.persistentHash(_descriptor_23, value_0);
    return result_0;
  }
  _persistentHash_5(value_0) {
    const result_0 = __compactRuntime.persistentHash(_descriptor_20, value_0);
    return result_0;
  }
  _degradeToTransient_0(x_0) {
    const result_0 = __compactRuntime.degradeToTransient(x_0);
    return result_0;
  }
  _jubjubPointX_0(np_0) {
    const result_0 = __compactRuntime.jubjubPointX(np_0);
    return result_0;
  }
  _jubjubPointY_0(np_0) {
    const result_0 = __compactRuntime.jubjubPointY(np_0);
    return result_0;
  }
  _ecAdd_0(a_0, b_0) {
    const result_0 = __compactRuntime.ecAdd(a_0, b_0);
    return result_0;
  }
  _ecMul_0(a_0, b_0) {
    const result_0 = __compactRuntime.ecMul(a_0, b_0);
    return result_0;
  }
  _ecMulGenerator_0(b_0) {
    const result_0 = __compactRuntime.ecMulGenerator(b_0);
    return result_0;
  }
  _getSchnorrReduction_0(context, partialProofData, challengeHash_0) {
    const witnessContext_0 = __compactRuntime.createWitnessContext(ledger(context.currentQueryContext.state), context.currentPrivateState, context.currentQueryContext.address);
    const [nextPrivateState_0, result_0] = this.witnesses.getSchnorrReduction(witnessContext_0,
                                                                              challengeHash_0);
    context.currentPrivateState = nextPrivateState_0;
    if (!(Array.isArray(result_0) && result_0.length === 2  && typeof(result_0[0]) === 'bigint' && result_0[0] >= 0 && result_0[0] <= __compactRuntime.MAX_FIELD && typeof(result_0[1]) === 'bigint' && result_0[1] >= 0n && result_0[1] <= 452312848583266388373324160190187140051835877600158453279131187530910662655n)) {
      __compactRuntime.typeError('getSchnorrReduction',
                                 'return value',
                                 'schnorr.compact line 25 char 3',
                                 '[Field, Uint<0..452312848583266388373324160190187140051835877600158453279131187530910662656>]',
                                 result_0)
    }
    partialProofData.privateTranscriptOutputs.push({
      value: _descriptor_18.toValue(result_0),
      alignment: _descriptor_18.alignment()
    });
    return result_0;
  }
  _schnorrVerify_0(context, partialProofData, msg_0, signature_0, pk_0) {
    const __compact_pattern_tmp2_0 = signature_0;
    const announcement_0 = __compact_pattern_tmp2_0.announcement;
    const response_0 = __compact_pattern_tmp2_0.response;
    const cFull_0 = this._transientHash_2({ ann_x:
                                              this._jubjubPointX_0(announcement_0),
                                            ann_y:
                                              this._jubjubPointY_0(announcement_0),
                                            pk_x: this._jubjubPointX_0(pk_0),
                                            pk_y: this._jubjubPointY_0(pk_0),
                                            msg: msg_0 });
    const TWO_248_0 = 452312848583266388373324160190187140051835877600158453279131187530910662656n;
    const __compact_pattern_tmp1_0 = this._getSchnorrReduction_0(context,
                                                                 partialProofData,
                                                                 cFull_0);
    const q_0 = __compact_pattern_tmp1_0[0];
    const cTruncated_0 = __compact_pattern_tmp1_0[1];
    __compactRuntime.assert(__compactRuntime.addField(__compactRuntime.mulField(q_0,
                                                                                TWO_248_0),
                                                      cTruncated_0)
                            ===
                            cFull_0,
                            'Invalid challenge reduction');
    const c_0 = cTruncated_0;
    const lhs_0 = this._ecMulGenerator_0(response_0);
    const rhs_0 = this._ecAdd_0(announcement_0, this._ecMul_0(pk_0, c_0));
    __compactRuntime.assert(this._jubjubPointX_0(lhs_0)
                            ===
                            this._jubjubPointX_0(rhs_0)
                            &&
                            this._jubjubPointY_0(lhs_0)
                            ===
                            this._jubjubPointY_0(rhs_0),
                            'Invalid issuer signature');
    return [];
  }
  _schnorrChallenge_0(ann_x_0, ann_y_0, pk_x_0, pk_y_0, msg_0) {
    return this._transientHash_2({ ann_x: ann_x_0,
                                   ann_y: ann_y_0,
                                   pk_x: pk_x_0,
                                   pk_y: pk_y_0,
                                   msg: msg_0 });
  }
  _getCredentialBundle_0(context, partialProofData) {
    const witnessContext_0 = __compactRuntime.createWitnessContext(ledger(context.currentQueryContext.state), context.currentPrivateState, context.currentQueryContext.address);
    const [nextPrivateState_0, result_0] = this.witnesses.getCredentialBundle(witnessContext_0);
    context.currentPrivateState = nextPrivateState_0;
    if (!(Array.isArray(result_0) && result_0.length === 6  && typeof(result_0[0]) === 'object' && result_0[0].credentialId.buffer instanceof ArrayBuffer && result_0[0].credentialId.BYTES_PER_ELEMENT === 1 && result_0[0].credentialId.length === 32 && result_0[0].holderCommitment.buffer instanceof ArrayBuffer && result_0[0].holderCommitment.BYTES_PER_ELEMENT === 1 && result_0[0].holderCommitment.length === 32 && typeof(result_0[0].skillsRoot) === 'object' && typeof(result_0[0].skillsRoot.field) === 'bigint' && result_0[0].skillsRoot.field >= 0 && result_0[0].skillsRoot.field <= __compactRuntime.MAX_FIELD && typeof(result_0[0].durationMonths) === 'bigint' && result_0[0].durationMonths >= 0n && result_0[0].durationMonths <= 65535n && typeof(result_0[0].deliveredToProduction) === 'boolean' && typeof(result_0[0].clientRatingHundredths) === 'bigint' && result_0[0].clientRatingHundredths >= 0n && result_0[0].clientRatingHundredths <= 65535n && true && typeof(result_0[2]) === 'object' && true && typeof(result_0[2].response) === 'bigint' && result_0[2].response >= 0 && result_0[2].response <= __compactRuntime.MAX_FIELD && typeof(result_0[3]) === 'object' && true && Array.isArray(result_0[3].path) && result_0[3].path.length === 5 && result_0[3].path.every((t) => typeof(t) === 'object' && typeof(t.sibling) === 'object' && typeof(t.sibling.field) === 'bigint' && t.sibling.field >= 0 && t.sibling.field <= __compactRuntime.MAX_FIELD && typeof(t.goes_left) === 'boolean') && result_0[4].buffer instanceof ArrayBuffer && result_0[4].BYTES_PER_ELEMENT === 1 && result_0[4].length === 32 && typeof(result_0[5]) === 'object' && result_0[5].leaf.buffer instanceof ArrayBuffer && result_0[5].leaf.BYTES_PER_ELEMENT === 1 && result_0[5].leaf.length === 32 && Array.isArray(result_0[5].path) && result_0[5].path.length === 5 && result_0[5].path.every((t) => typeof(t) === 'object' && typeof(t.sibling) === 'object' && typeof(t.sibling.field) === 'bigint' && t.sibling.field >= 0 && t.sibling.field <= __compactRuntime.MAX_FIELD && typeof(t.goes_left) === 'boolean'))) {
      __compactRuntime.typeError('getCredentialBundle',
                                 'return value',
                                 'aptor.compact line 34 char 1',
                                 '[struct WorkCredentialV1<credentialId: Bytes<32>, holderCommitment: Bytes<32>, skillsRoot: struct MerkleTreeDigest<field: Field>, durationMonths: Uint<0..65536>, deliveredToProduction: Boolean, clientRatingHundredths: Uint<0..65536>>, Opaque<"JubjubPoint">, struct SchnorrSignature<announcement: Opaque<"JubjubPoint">, response: Field>, struct MerkleTreePath<leaf: Opaque<"JubjubPoint">, path: Vector<5, struct MerkleTreePathEntry<sibling: struct MerkleTreeDigest<field: Field>, goes_left: Boolean>>>, Bytes<32>, struct MerkleTreePath<leaf: Bytes<32>, path: Vector<5, struct MerkleTreePathEntry<sibling: struct MerkleTreeDigest<field: Field>, goes_left: Boolean>>>]',
                                 result_0)
    }
    partialProofData.privateTranscriptOutputs.push({
      value: _descriptor_16.toValue(result_0),
      alignment: _descriptor_16.alignment()
    });
    return result_0;
  }
  _deriveHolderCommitment_0(holderSecret_0) {
    return this._persistentHash_0([new Uint8Array([97, 112, 116, 111, 114, 58, 104, 111, 108, 100, 101, 114, 58, 118, 49]),
                                   holderSecret_0]);
  }
  _deriveCanonicalSkillId_0(normalizedSkillBytes_0, normalizedSkillLength_0) {
    return this._persistentHash_1([new Uint8Array([97, 112, 116, 111, 114, 58, 115, 107, 105, 108, 108, 58, 105, 100, 58, 118, 49]),
                                   normalizedSkillBytes_0,
                                   normalizedSkillLength_0]);
  }
  _deriveWorkCredentialDigest_0(credential_0) {
    return this._persistentHash_2([new Uint8Array([97, 112, 116, 111, 114, 58, 119, 111, 114, 107, 45, 99, 114, 101, 100, 101, 110, 116, 105, 97, 108, 58, 118, 49]),
                                   credential_0.credentialId,
                                   credential_0.holderCommitment,
                                   credential_0.skillsRoot,
                                   credential_0.durationMonths,
                                   credential_0.deliveredToProduction,
                                   credential_0.clientRatingHundredths]);
  }
  _deriveProofRequestCommitment_0(request_0) {
    return this._persistentHash_3([new Uint8Array([97, 112, 116, 111, 114, 58, 112, 114, 111, 111, 102, 45, 114, 101, 113, 117, 101, 115, 116, 58, 118, 49]),
                                   request_0.requestId,
                                   request_0.acceptedIssuerRoot,
                                   request_0.checkSkill,
                                   request_0.requiredSkillId,
                                   request_0.checkDuration,
                                   request_0.minimumDurationMonths,
                                   request_0.requireProductionDelivery,
                                   request_0.checkClientRating,
                                   request_0.minimumClientRatingHundredths]);
  }
  _deriveSkillPathRoot_0(path_0) { return this._merkleTreePathRoot_0(path_0); }
  _deriveIssuerPathRoot_0(path_0) { return this._merkleTreePathRoot_1(path_0); }
  _credentialSignatureMessage_0(digest_0) {
    return [this._transientHash_1(digest_0), 0n, 0n, 0n];
  }
  _schnorrChallenge_1(ann_x_0, ann_y_0, pk_x_0, pk_y_0, msg_0) {
    return this._schnorrChallenge_0(ann_x_0, ann_y_0, pk_x_0, pk_y_0, msg_0);
  }
  _createProofRequest_0(context,
                        partialProofData,
                        requestId_0,
                        requestCommitment_0)
  {
    __compactRuntime.assert(!_descriptor_1.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                       partialProofData,
                                                                                       [
                                                                                        { dup: { n: 0 } },
                                                                                        { idx: { cached: false,
                                                                                                 pushPath: false,
                                                                                                 path: [
                                                                                                        { tag: 'value',
                                                                                                          value: { value: _descriptor_13.toValue(0n),
                                                                                                                   alignment: _descriptor_13.alignment() } }] } },
                                                                                        { push: { storage: false,
                                                                                                  value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(requestId_0),
                                                                                                                                               alignment: _descriptor_0.alignment() }).encode() } },
                                                                                        'member',
                                                                                        { popeq: { cached: true,
                                                                                                   result: undefined } }]).value),
                            'Proof request already exists');
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { idx: { cached: false,
                                                pushPath: true,
                                                path: [
                                                       { tag: 'value',
                                                         value: { value: _descriptor_13.toValue(0n),
                                                                  alignment: _descriptor_13.alignment() } }] } },
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(requestId_0),
                                                                                              alignment: _descriptor_0.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(requestCommitment_0),
                                                                                              alignment: _descriptor_0.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } },
                                       { ins: { cached: true, n: 1 } }]);
    return [];
  }
  _proveAgainstRequest_0(context, partialProofData, request_0) {
    __compactRuntime.assert(request_0.checkSkill || request_0.checkDuration
                            ||
                            request_0.requireProductionDelivery
                            ||
                            request_0.checkClientRating,
                            'Proof request must enable at least one requirement');
    let t_0;
    __compactRuntime.assert(!request_0.checkClientRating
                            ||
                            (t_0 = request_0.minimumClientRatingHundredths,
                             t_0 <= 500n),
                            'Requested client rating must be between 0 and 500');
    const disclosedRequestId_0 = request_0.requestId;
    const requestCommitment_0 = this._deriveProofRequestCommitment_0(request_0);
    __compactRuntime.assert(_descriptor_1.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                      partialProofData,
                                                                                      [
                                                                                       { dup: { n: 0 } },
                                                                                       { idx: { cached: false,
                                                                                                pushPath: false,
                                                                                                path: [
                                                                                                       { tag: 'value',
                                                                                                         value: { value: _descriptor_13.toValue(0n),
                                                                                                                  alignment: _descriptor_13.alignment() } }] } },
                                                                                       { push: { storage: false,
                                                                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(disclosedRequestId_0),
                                                                                                                                              alignment: _descriptor_0.alignment() }).encode() } },
                                                                                       'member',
                                                                                       { popeq: { cached: true,
                                                                                                  result: undefined } }]).value),
                            'Proof request is not registered');
    __compactRuntime.assert(this._equal_0(_descriptor_0.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                                    partialProofData,
                                                                                                    [
                                                                                                     { dup: { n: 0 } },
                                                                                                     { idx: { cached: false,
                                                                                                              pushPath: false,
                                                                                                              path: [
                                                                                                                     { tag: 'value',
                                                                                                                       value: { value: _descriptor_13.toValue(0n),
                                                                                                                                alignment: _descriptor_13.alignment() } }] } },
                                                                                                     { idx: { cached: false,
                                                                                                              pushPath: false,
                                                                                                              path: [
                                                                                                                     { tag: 'value',
                                                                                                                       value: { value: _descriptor_0.toValue(disclosedRequestId_0),
                                                                                                                                alignment: _descriptor_0.alignment() } }] } },
                                                                                                     { popeq: { cached: false,
                                                                                                                result: undefined } }]).value),
                                          requestCommitment_0),
                            'Proof request does not match its registered commitment');
    __compactRuntime.assert(!_descriptor_1.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                       partialProofData,
                                                                                       [
                                                                                        { dup: { n: 0 } },
                                                                                        { idx: { cached: false,
                                                                                                 pushPath: false,
                                                                                                 path: [
                                                                                                        { tag: 'value',
                                                                                                          value: { value: _descriptor_13.toValue(1n),
                                                                                                                   alignment: _descriptor_13.alignment() } }] } },
                                                                                        { push: { storage: false,
                                                                                                  value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(disclosedRequestId_0),
                                                                                                                                               alignment: _descriptor_0.alignment() }).encode() } },
                                                                                        'member',
                                                                                        { popeq: { cached: true,
                                                                                                   result: undefined } }]).value),
                            'Proof request is already fulfilled');
    const __compact_pattern_tmp1_0 = this._getCredentialBundle_0(context,
                                                                 partialProofData);
    const credential_0 = __compact_pattern_tmp1_0[0];
    const issuerPublicKey_0 = __compact_pattern_tmp1_0[1];
    const issuerSignature_0 = __compact_pattern_tmp1_0[2];
    const issuerMembershipPath_0 = __compact_pattern_tmp1_0[3];
    const holderSecret_0 = __compact_pattern_tmp1_0[4];
    const skillMembershipPath_0 = __compact_pattern_tmp1_0[5];
    let t_1;
    __compactRuntime.assert((t_1 = credential_0.clientRatingHundredths,
                             t_1 <= 500n),
                            'Credential client rating must be between 0 and 500');
    const credentialDigest_0 = this._deriveWorkCredentialDigest_0(credential_0);
    const signingMessage_0 = this._credentialSignatureMessage_0(credentialDigest_0);
    this._schnorrVerify_0(context,
                          partialProofData,
                          signingMessage_0,
                          issuerSignature_0,
                          issuerPublicKey_0);
    __compactRuntime.assert(this._jubjubPointX_0(issuerMembershipPath_0.leaf)
                            ===
                            this._jubjubPointX_0(issuerPublicKey_0)
                            &&
                            this._jubjubPointY_0(issuerMembershipPath_0.leaf)
                            ===
                            this._jubjubPointY_0(issuerPublicKey_0),
                            'Issuer membership path is for a different public key');
    __compactRuntime.assert(this._equal_1(this._deriveIssuerPathRoot_0(issuerMembershipPath_0),
                                          request_0.acceptedIssuerRoot),
                            'Credential issuer is not in the accepted issuer set');
    __compactRuntime.assert(this._equal_2(this._deriveHolderCommitment_0(holderSecret_0),
                                          credential_0.holderCommitment),
                            'Holder secret does not match the signed credential');
    if (request_0.checkSkill) {
      __compactRuntime.assert(this._equal_3(skillMembershipPath_0.leaf,
                                            request_0.requiredSkillId),
                              'Skill membership path is for a different skill');
      __compactRuntime.assert(this._equal_4(this._deriveSkillPathRoot_0(skillMembershipPath_0),
                                            credential_0.skillsRoot),
                              'Required skill is not in the signed credential');
    }
    if (request_0.checkDuration) {
      let t_2;
      __compactRuntime.assert((t_2 = credential_0.durationMonths,
                               t_2 >= request_0.minimumDurationMonths),
                              'Signed private duration does not satisfy the request');
    }
    if (request_0.requireProductionDelivery) {
      __compactRuntime.assert(credential_0.deliveredToProduction,
                              'Signed credential does not confirm production delivery');
    }
    if (request_0.checkClientRating) {
      let t_3;
      __compactRuntime.assert((t_3 = credential_0.clientRatingHundredths,
                               t_3 >= request_0.minimumClientRatingHundredths),
                              'Signed private rating does not satisfy the request');
    }
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { idx: { cached: false,
                                                pushPath: true,
                                                path: [
                                                       { tag: 'value',
                                                         value: { value: _descriptor_13.toValue(1n),
                                                                  alignment: _descriptor_13.alignment() } }] } },
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(disclosedRequestId_0),
                                                                                              alignment: _descriptor_0.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newNull().encode() } },
                                       { ins: { cached: false, n: 1 } },
                                       { ins: { cached: true, n: 1 } }]);
    return [];
  }
  _folder_0(f, x, a0) {
    for (let i = 0; i < 5; i++) { x = f(x, a0[i]); }
    return x;
  }
  _folder_1(f, x, a0) {
    for (let i = 0; i < 5; i++) { x = f(x, a0[i]); }
    return x;
  }
  _equal_0(x0, y0) {
    if (!x0.every((x, i) => y0[i] === x)) { return false; }
    return true;
  }
  _equal_1(x0, y0) {
    {
      let x1 = x0.field;
      let y1 = y0.field;
      if (x1 !== y1) { return false; }
    }
    return true;
  }
  _equal_2(x0, y0) {
    if (!x0.every((x, i) => y0[i] === x)) { return false; }
    return true;
  }
  _equal_3(x0, y0) {
    if (!x0.every((x, i) => y0[i] === x)) { return false; }
    return true;
  }
  _equal_4(x0, y0) {
    {
      let x1 = x0.field;
      let y1 = y0.field;
      if (x1 !== y1) { return false; }
    }
    return true;
  }
}
export function ledger(stateOrChargedState) {
  const state = stateOrChargedState instanceof __compactRuntime.StateValue ? stateOrChargedState : stateOrChargedState.state;
  const chargedState = stateOrChargedState instanceof __compactRuntime.StateValue ? new __compactRuntime.ChargedState(stateOrChargedState) : stateOrChargedState;
  const context = {
    currentQueryContext: new __compactRuntime.QueryContext(chargedState, __compactRuntime.dummyContractAddress()),
    costModel: __compactRuntime.CostModel.initialCostModel()
  };
  const partialProofData = {
    input: { value: [], alignment: [] },
    output: undefined,
    publicTranscript: [],
    privateTranscriptOutputs: []
  };
  return {
    requestCommitments: {
      isEmpty(...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`isEmpty: expected 0 arguments, received ${args_0.length}`);
        }
        return _descriptor_1.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_13.toValue(0n),
                                                                                                     alignment: _descriptor_13.alignment() } }] } },
                                                                          'size',
                                                                          { push: { storage: false,
                                                                                    value: __compactRuntime.StateValue.newCell({ value: _descriptor_32.toValue(0n),
                                                                                                                                 alignment: _descriptor_32.alignment() }).encode() } },
                                                                          'eq',
                                                                          { popeq: { cached: true,
                                                                                     result: undefined } }]).value);
      },
      size(...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`size: expected 0 arguments, received ${args_0.length}`);
        }
        return _descriptor_32.fromValue(__compactRuntime.queryLedgerState(context,
                                                                          partialProofData,
                                                                          [
                                                                           { dup: { n: 0 } },
                                                                           { idx: { cached: false,
                                                                                    pushPath: false,
                                                                                    path: [
                                                                                           { tag: 'value',
                                                                                             value: { value: _descriptor_13.toValue(0n),
                                                                                                      alignment: _descriptor_13.alignment() } }] } },
                                                                           'size',
                                                                           { popeq: { cached: true,
                                                                                      result: undefined } }]).value);
      },
      member(...args_0) {
        if (args_0.length !== 1) {
          throw new __compactRuntime.CompactError(`member: expected 1 argument, received ${args_0.length}`);
        }
        const key_0 = args_0[0];
        if (!(key_0.buffer instanceof ArrayBuffer && key_0.BYTES_PER_ELEMENT === 1 && key_0.length === 32)) {
          __compactRuntime.typeError('member',
                                     'argument 1',
                                     'aptor.compact line 30 char 1',
                                     'Bytes<32>',
                                     key_0)
        }
        return _descriptor_1.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_13.toValue(0n),
                                                                                                     alignment: _descriptor_13.alignment() } }] } },
                                                                          { push: { storage: false,
                                                                                    value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(key_0),
                                                                                                                                 alignment: _descriptor_0.alignment() }).encode() } },
                                                                          'member',
                                                                          { popeq: { cached: true,
                                                                                     result: undefined } }]).value);
      },
      lookup(...args_0) {
        if (args_0.length !== 1) {
          throw new __compactRuntime.CompactError(`lookup: expected 1 argument, received ${args_0.length}`);
        }
        const key_0 = args_0[0];
        if (!(key_0.buffer instanceof ArrayBuffer && key_0.BYTES_PER_ELEMENT === 1 && key_0.length === 32)) {
          __compactRuntime.typeError('lookup',
                                     'argument 1',
                                     'aptor.compact line 30 char 1',
                                     'Bytes<32>',
                                     key_0)
        }
        return _descriptor_0.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_13.toValue(0n),
                                                                                                     alignment: _descriptor_13.alignment() } }] } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_0.toValue(key_0),
                                                                                                     alignment: _descriptor_0.alignment() } }] } },
                                                                          { popeq: { cached: false,
                                                                                     result: undefined } }]).value);
      },
      [Symbol.iterator](...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`iter: expected 0 arguments, received ${args_0.length}`);
        }
        const self_0 = state.asArray()[0];
        return self_0.asMap().keys().map(  (key) => {    const value = self_0.asMap().get(key).asCell();    return [      _descriptor_0.fromValue(key.value),      _descriptor_0.fromValue(value.value)    ];  })[Symbol.iterator]();
      }
    },
    fulfilledRequests: {
      isEmpty(...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`isEmpty: expected 0 arguments, received ${args_0.length}`);
        }
        return _descriptor_1.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_13.toValue(1n),
                                                                                                     alignment: _descriptor_13.alignment() } }] } },
                                                                          'size',
                                                                          { push: { storage: false,
                                                                                    value: __compactRuntime.StateValue.newCell({ value: _descriptor_32.toValue(0n),
                                                                                                                                 alignment: _descriptor_32.alignment() }).encode() } },
                                                                          'eq',
                                                                          { popeq: { cached: true,
                                                                                     result: undefined } }]).value);
      },
      size(...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`size: expected 0 arguments, received ${args_0.length}`);
        }
        return _descriptor_32.fromValue(__compactRuntime.queryLedgerState(context,
                                                                          partialProofData,
                                                                          [
                                                                           { dup: { n: 0 } },
                                                                           { idx: { cached: false,
                                                                                    pushPath: false,
                                                                                    path: [
                                                                                           { tag: 'value',
                                                                                             value: { value: _descriptor_13.toValue(1n),
                                                                                                      alignment: _descriptor_13.alignment() } }] } },
                                                                           'size',
                                                                           { popeq: { cached: true,
                                                                                      result: undefined } }]).value);
      },
      member(...args_0) {
        if (args_0.length !== 1) {
          throw new __compactRuntime.CompactError(`member: expected 1 argument, received ${args_0.length}`);
        }
        const elem_0 = args_0[0];
        if (!(elem_0.buffer instanceof ArrayBuffer && elem_0.BYTES_PER_ELEMENT === 1 && elem_0.length === 32)) {
          __compactRuntime.typeError('member',
                                     'argument 1',
                                     'aptor.compact line 32 char 1',
                                     'Bytes<32>',
                                     elem_0)
        }
        return _descriptor_1.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_13.toValue(1n),
                                                                                                     alignment: _descriptor_13.alignment() } }] } },
                                                                          { push: { storage: false,
                                                                                    value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(elem_0),
                                                                                                                                 alignment: _descriptor_0.alignment() }).encode() } },
                                                                          'member',
                                                                          { popeq: { cached: true,
                                                                                     result: undefined } }]).value);
      },
      [Symbol.iterator](...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`iter: expected 0 arguments, received ${args_0.length}`);
        }
        const self_0 = state.asArray()[1];
        return self_0.asMap().keys().map((elem) => _descriptor_0.fromValue(elem.value))[Symbol.iterator]();
      }
    }
  };
}
const _emptyContext = {
  currentQueryContext: new __compactRuntime.QueryContext(new __compactRuntime.ContractState().data, __compactRuntime.dummyContractAddress())
};
const _dummyContract = new Contract({
  getSchnorrReduction: (...args) => undefined,
  getCredentialBundle: (...args) => undefined
});
export const pureCircuits = {
  deriveHolderCommitment: (...args_0) => {
    if (args_0.length !== 1) {
      throw new __compactRuntime.CompactError(`deriveHolderCommitment: expected 1 argument (as invoked from Typescript), received ${args_0.length}`);
    }
    const holderSecret_0 = args_0[0];
    if (!(holderSecret_0.buffer instanceof ArrayBuffer && holderSecret_0.BYTES_PER_ELEMENT === 1 && holderSecret_0.length === 32)) {
      __compactRuntime.typeError('deriveHolderCommitment',
                                 'argument 1',
                                 'aptor.compact line 41 char 1',
                                 'Bytes<32>',
                                 holderSecret_0)
    }
    return _dummyContract._deriveHolderCommitment_0(holderSecret_0);
  },
  deriveCanonicalSkillId: (...args_0) => {
    if (args_0.length !== 2) {
      throw new __compactRuntime.CompactError(`deriveCanonicalSkillId: expected 2 arguments (as invoked from Typescript), received ${args_0.length}`);
    }
    const normalizedSkillBytes_0 = args_0[0];
    const normalizedSkillLength_0 = args_0[1];
    if (!(normalizedSkillBytes_0.buffer instanceof ArrayBuffer && normalizedSkillBytes_0.BYTES_PER_ELEMENT === 1 && normalizedSkillBytes_0.length === 64)) {
      __compactRuntime.typeError('deriveCanonicalSkillId',
                                 'argument 1',
                                 'aptor.compact line 45 char 1',
                                 'Bytes<64>',
                                 normalizedSkillBytes_0)
    }
    if (!(typeof(normalizedSkillLength_0) === 'bigint' && normalizedSkillLength_0 >= 0n && normalizedSkillLength_0 <= 255n)) {
      __compactRuntime.typeError('deriveCanonicalSkillId',
                                 'argument 2',
                                 'aptor.compact line 45 char 1',
                                 'Uint<0..256>',
                                 normalizedSkillLength_0)
    }
    return _dummyContract._deriveCanonicalSkillId_0(normalizedSkillBytes_0,
                                                    normalizedSkillLength_0);
  },
  deriveWorkCredentialDigest: (...args_0) => {
    if (args_0.length !== 1) {
      throw new __compactRuntime.CompactError(`deriveWorkCredentialDigest: expected 1 argument (as invoked from Typescript), received ${args_0.length}`);
    }
    const credential_0 = args_0[0];
    if (!(typeof(credential_0) === 'object' && credential_0.credentialId.buffer instanceof ArrayBuffer && credential_0.credentialId.BYTES_PER_ELEMENT === 1 && credential_0.credentialId.length === 32 && credential_0.holderCommitment.buffer instanceof ArrayBuffer && credential_0.holderCommitment.BYTES_PER_ELEMENT === 1 && credential_0.holderCommitment.length === 32 && typeof(credential_0.skillsRoot) === 'object' && typeof(credential_0.skillsRoot.field) === 'bigint' && credential_0.skillsRoot.field >= 0 && credential_0.skillsRoot.field <= __compactRuntime.MAX_FIELD && typeof(credential_0.durationMonths) === 'bigint' && credential_0.durationMonths >= 0n && credential_0.durationMonths <= 65535n && typeof(credential_0.deliveredToProduction) === 'boolean' && typeof(credential_0.clientRatingHundredths) === 'bigint' && credential_0.clientRatingHundredths >= 0n && credential_0.clientRatingHundredths <= 65535n)) {
      __compactRuntime.typeError('deriveWorkCredentialDigest',
                                 'argument 1',
                                 'aptor.compact line 54 char 1',
                                 'struct WorkCredentialV1<credentialId: Bytes<32>, holderCommitment: Bytes<32>, skillsRoot: struct MerkleTreeDigest<field: Field>, durationMonths: Uint<0..65536>, deliveredToProduction: Boolean, clientRatingHundredths: Uint<0..65536>>',
                                 credential_0)
    }
    return _dummyContract._deriveWorkCredentialDigest_0(credential_0);
  },
  deriveProofRequestCommitment: (...args_0) => {
    if (args_0.length !== 1) {
      throw new __compactRuntime.CompactError(`deriveProofRequestCommitment: expected 1 argument (as invoked from Typescript), received ${args_0.length}`);
    }
    const request_0 = args_0[0];
    if (!(typeof(request_0) === 'object' && request_0.requestId.buffer instanceof ArrayBuffer && request_0.requestId.BYTES_PER_ELEMENT === 1 && request_0.requestId.length === 32 && typeof(request_0.acceptedIssuerRoot) === 'object' && typeof(request_0.acceptedIssuerRoot.field) === 'bigint' && request_0.acceptedIssuerRoot.field >= 0 && request_0.acceptedIssuerRoot.field <= __compactRuntime.MAX_FIELD && typeof(request_0.checkSkill) === 'boolean' && request_0.requiredSkillId.buffer instanceof ArrayBuffer && request_0.requiredSkillId.BYTES_PER_ELEMENT === 1 && request_0.requiredSkillId.length === 32 && typeof(request_0.checkDuration) === 'boolean' && typeof(request_0.minimumDurationMonths) === 'bigint' && request_0.minimumDurationMonths >= 0n && request_0.minimumDurationMonths <= 65535n && typeof(request_0.requireProductionDelivery) === 'boolean' && typeof(request_0.checkClientRating) === 'boolean' && typeof(request_0.minimumClientRatingHundredths) === 'bigint' && request_0.minimumClientRatingHundredths >= 0n && request_0.minimumClientRatingHundredths <= 65535n)) {
      __compactRuntime.typeError('deriveProofRequestCommitment',
                                 'argument 1',
                                 'aptor.compact line 72 char 1',
                                 'struct ProofRequestV1<requestId: Bytes<32>, acceptedIssuerRoot: struct MerkleTreeDigest<field: Field>, checkSkill: Boolean, requiredSkillId: Bytes<32>, checkDuration: Boolean, minimumDurationMonths: Uint<0..65536>, requireProductionDelivery: Boolean, checkClientRating: Boolean, minimumClientRatingHundredths: Uint<0..65536>>',
                                 request_0)
    }
    return _dummyContract._deriveProofRequestCommitment_0(request_0);
  },
  deriveSkillPathRoot: (...args_0) => {
    if (args_0.length !== 1) {
      throw new __compactRuntime.CompactError(`deriveSkillPathRoot: expected 1 argument (as invoked from Typescript), received ${args_0.length}`);
    }
    const path_0 = args_0[0];
    if (!(typeof(path_0) === 'object' && path_0.leaf.buffer instanceof ArrayBuffer && path_0.leaf.BYTES_PER_ELEMENT === 1 && path_0.leaf.length === 32 && Array.isArray(path_0.path) && path_0.path.length === 5 && path_0.path.every((t) => typeof(t) === 'object' && typeof(t.sibling) === 'object' && typeof(t.sibling.field) === 'bigint' && t.sibling.field >= 0 && t.sibling.field <= __compactRuntime.MAX_FIELD && typeof(t.goes_left) === 'boolean'))) {
      __compactRuntime.typeError('deriveSkillPathRoot',
                                 'argument 1',
                                 'aptor.compact line 96 char 1',
                                 'struct MerkleTreePath<leaf: Bytes<32>, path: Vector<5, struct MerkleTreePathEntry<sibling: struct MerkleTreeDigest<field: Field>, goes_left: Boolean>>>',
                                 path_0)
    }
    return _dummyContract._deriveSkillPathRoot_0(path_0);
  },
  deriveIssuerPathRoot: (...args_0) => {
    if (args_0.length !== 1) {
      throw new __compactRuntime.CompactError(`deriveIssuerPathRoot: expected 1 argument (as invoked from Typescript), received ${args_0.length}`);
    }
    const path_0 = args_0[0];
    if (!(typeof(path_0) === 'object' && true && Array.isArray(path_0.path) && path_0.path.length === 5 && path_0.path.every((t) => typeof(t) === 'object' && typeof(t.sibling) === 'object' && typeof(t.sibling.field) === 'bigint' && t.sibling.field >= 0 && t.sibling.field <= __compactRuntime.MAX_FIELD && typeof(t.goes_left) === 'boolean'))) {
      __compactRuntime.typeError('deriveIssuerPathRoot',
                                 'argument 1',
                                 'aptor.compact line 100 char 1',
                                 'struct MerkleTreePath<leaf: Opaque<"JubjubPoint">, path: Vector<5, struct MerkleTreePathEntry<sibling: struct MerkleTreeDigest<field: Field>, goes_left: Boolean>>>',
                                 path_0)
    }
    return _dummyContract._deriveIssuerPathRoot_0(path_0);
  },
  schnorrChallenge: (...args_0) => {
    if (args_0.length !== 5) {
      throw new __compactRuntime.CompactError(`schnorrChallenge: expected 5 arguments (as invoked from Typescript), received ${args_0.length}`);
    }
    const ann_x_0 = args_0[0];
    const ann_y_0 = args_0[1];
    const pk_x_0 = args_0[2];
    const pk_y_0 = args_0[3];
    const msg_0 = args_0[4];
    if (!(typeof(ann_x_0) === 'bigint' && ann_x_0 >= 0 && ann_x_0 <= __compactRuntime.MAX_FIELD)) {
      __compactRuntime.typeError('schnorrChallenge',
                                 'argument 1',
                                 'aptor.compact line 108 char 1',
                                 'Field',
                                 ann_x_0)
    }
    if (!(typeof(ann_y_0) === 'bigint' && ann_y_0 >= 0 && ann_y_0 <= __compactRuntime.MAX_FIELD)) {
      __compactRuntime.typeError('schnorrChallenge',
                                 'argument 2',
                                 'aptor.compact line 108 char 1',
                                 'Field',
                                 ann_y_0)
    }
    if (!(typeof(pk_x_0) === 'bigint' && pk_x_0 >= 0 && pk_x_0 <= __compactRuntime.MAX_FIELD)) {
      __compactRuntime.typeError('schnorrChallenge',
                                 'argument 3',
                                 'aptor.compact line 108 char 1',
                                 'Field',
                                 pk_x_0)
    }
    if (!(typeof(pk_y_0) === 'bigint' && pk_y_0 >= 0 && pk_y_0 <= __compactRuntime.MAX_FIELD)) {
      __compactRuntime.typeError('schnorrChallenge',
                                 'argument 4',
                                 'aptor.compact line 108 char 1',
                                 'Field',
                                 pk_y_0)
    }
    if (!(Array.isArray(msg_0) && msg_0.length === 4 && msg_0.every((t) => typeof(t) === 'bigint' && t >= 0 && t <= __compactRuntime.MAX_FIELD))) {
      __compactRuntime.typeError('schnorrChallenge',
                                 'argument 5',
                                 'aptor.compact line 108 char 1',
                                 'Vector<4, Field>',
                                 msg_0)
    }
    return _dummyContract._schnorrChallenge_1(ann_x_0,
                                              ann_y_0,
                                              pk_x_0,
                                              pk_y_0,
                                              msg_0);
  }
};
export const contractReferenceLocations =
  { tag: 'publicLedgerArray', indices: { } };
//# sourceMappingURL=index.js.map
