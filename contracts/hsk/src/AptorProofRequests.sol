// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AptorCredentialRegistry} from "./AptorCredentialRegistry.sol";

interface IAptorCredentialVerifier {
    function verifyProof(
        uint256[2] calldata a,
        uint256[2][2] calldata b,
        uint256[2] calldata c,
        uint256[7] calldata publicSignals
    ) external view returns (bool);
}

contract AptorProofRequests {
    error InvalidRequest();
    error RequestAlreadyExists();
    error RequestNotOpen();
    error CredentialNotValid();
    error NullifierAlreadyUsed();
    error InvalidProof();

    uint256 private constant SNARK_SCALAR_FIELD =
        21888242871839275222246405745257275088548364400416034343698204186575808495617;

    struct ProofRequest {
        address verifier;
        uint256 requiredSkillHash;
        uint16 minimumMonths;
        bool requiresProduction;
        uint16 minimumRatingHundredths;
        bool exists;
        bool fulfilled;
    }

    IAptorCredentialVerifier public immutable proofVerifier;
    AptorCredentialRegistry public immutable credentialRegistry;
    mapping(uint256 => ProofRequest) public requests;
    mapping(uint256 => bool) public usedNullifiers;

    event RequestCreated(
        uint256 indexed requestId,
        address indexed verifier,
        uint256 requiredSkillHash,
        uint16 minimumMonths,
        bool requiresProduction,
        uint16 minimumRatingHundredths
    );
    event RequestFulfilled(
        uint256 indexed requestId,
        address indexed verifier,
        uint256 indexed credentialCommitment,
        uint256 requestNullifier
    );

    constructor(address verifierContract, address registryContract) {
        if (verifierContract == address(0) || registryContract == address(0)) revert InvalidRequest();
        proofVerifier = IAptorCredentialVerifier(verifierContract);
        credentialRegistry = AptorCredentialRegistry(registryContract);
    }

    function createRequest(
        uint256 requestId,
        uint256 requiredSkillHash,
        uint16 minimumMonths,
        bool requiresProduction,
        uint16 minimumRatingHundredths
    ) external {
        if (
            requestId == 0 || requestId >= SNARK_SCALAR_FIELD || requiredSkillHash == 0
                || requiredSkillHash >= SNARK_SCALAR_FIELD || minimumRatingHundredths > 500
        ) revert InvalidRequest();
        if (requests[requestId].exists) revert RequestAlreadyExists();

        requests[requestId] = ProofRequest({
            verifier: msg.sender,
            requiredSkillHash: requiredSkillHash,
            minimumMonths: minimumMonths,
            requiresProduction: requiresProduction,
            minimumRatingHundredths: minimumRatingHundredths,
            exists: true,
            fulfilled: false
        });
        emit RequestCreated(
            requestId,
            msg.sender,
            requiredSkillHash,
            minimumMonths,
            requiresProduction,
            minimumRatingHundredths
        );
    }

    function fulfillRequest(
        uint256 requestId,
        uint256 credentialCommitment,
        uint256 requestNullifier,
        uint256[2] calldata a,
        uint256[2][2] calldata b,
        uint256[2] calldata c
    ) external {
        ProofRequest storage request = requests[requestId];
        if (!request.exists || request.fulfilled) revert RequestNotOpen();
        if (!credentialRegistry.isCredentialValid(credentialCommitment)) revert CredentialNotValid();
        if (requestNullifier == 0 || requestNullifier >= SNARK_SCALAR_FIELD || usedNullifiers[requestNullifier]) {
            revert NullifierAlreadyUsed();
        }

        uint256[7] memory publicSignals = [
            credentialCommitment,
            requestNullifier,
            request.requiredSkillHash,
            uint256(request.minimumMonths),
            request.requiresProduction ? uint256(1) : uint256(0),
            uint256(request.minimumRatingHundredths),
            requestId
        ];
        if (!proofVerifier.verifyProof(a, b, c, publicSignals)) revert InvalidProof();

        usedNullifiers[requestNullifier] = true;
        request.fulfilled = true;
        emit RequestFulfilled(requestId, request.verifier, credentialCommitment, requestNullifier);
    }
}
