// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AptorCredentialGroth16Verifier} from "../src/AptorCredentialVerifier.sol";
import {AptorCredentialRegistry} from "../src/AptorCredentialRegistry.sol";
import {AptorProofRequests} from "../src/AptorProofRequests.sol";
import {AptorProofFixtures} from "./AptorProofFixtures.sol";

interface Vm {
    function prank(address sender) external;
}

contract AptorContractsTest {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    address private constant ISSUER = address(0x1001);
    address private constant OTHER_ISSUER = address(0x1002);
    address private constant VERIFIER = address(0x2001);
    address private constant HOLDER = address(0x3001);

    AptorCredentialGroth16Verifier private groth16;
    AptorCredentialRegistry private registry;
    AptorProofRequests private requests;

    function setUp() public {
        groth16 = new AptorCredentialGroth16Verifier();
        registry = new AptorCredentialRegistry(address(this));
        requests = new AptorProofRequests(address(groth16), address(registry));
        registry.setIssuerApproval(ISSUER, true);
    }

    function testApprovedIssuerCanRegisterCommitment() public {
        _register(AptorProofFixtures.COMMITMENT);
        require(registry.isCredentialValid(AptorProofFixtures.COMMITMENT), "credential not valid");
    }

    function testUnapprovedIssuerCannotRegister() public {
        vm.prank(OTHER_ISSUER);
        (bool ok,) = address(registry).call(
            abi.encodeCall(AptorCredentialRegistry.registerCredential, (AptorProofFixtures.COMMITMENT))
        );
        require(!ok, "unapproved issuer registered");
    }

    function testIssuerCanRevokeOwnCredential() public {
        _register(AptorProofFixtures.COMMITMENT);
        vm.prank(ISSUER);
        registry.revokeCredential(AptorProofFixtures.COMMITMENT);
        require(!registry.isCredentialValid(AptorProofFixtures.COMMITMENT), "revoked credential valid");
    }

    function testDifferentIssuerCannotRevokeCredential() public {
        _register(AptorProofFixtures.COMMITMENT);
        registry.setIssuerApproval(OTHER_ISSUER, true);
        vm.prank(OTHER_ISSUER);
        (bool ok,) = address(registry).call(
            abi.encodeCall(AptorCredentialRegistry.revokeCredential, (AptorProofFixtures.COMMITMENT))
        );
        require(!ok, "different issuer revoked credential");
    }

    function testRevokedCredentialCannotFulfillRequest() public {
        _register(AptorProofFixtures.COMMITMENT);
        _createRequest1001();
        vm.prank(ISSUER);
        registry.revokeCredential(AptorProofFixtures.COMMITMENT);
        require(!_tryFulfill1001(AptorProofFixtures.COMMITMENT, AptorProofFixtures.NULLIFIER_1001), "revoked credential fulfilled");
    }

    function testValidAptorProofFulfillsRequest() public {
        _register(AptorProofFixtures.COMMITMENT);
        _createRequest1001();
        _fulfill1001();
        (,,,,,, bool fulfilled) = requests.requests(1001);
        require(fulfilled, "request not fulfilled");
    }

    function testInsufficientExperienceRequestFails() public {
        _register(AptorProofFixtures.COMMITMENT);
        _create(1001, AptorProofFixtures.SKILL, 48, true, 400);
        require(!_tryFulfill1001(AptorProofFixtures.COMMITMENT, AptorProofFixtures.NULLIFIER_1001), "changed months accepted");
    }

    function testWrongSkillRequestFails() public {
        _register(AptorProofFixtures.COMMITMENT);
        _create(1001, AptorProofFixtures.SKILL + 1, 24, true, 400);
        require(!_tryFulfill1001(AptorProofFixtures.COMMITMENT, AptorProofFixtures.NULLIFIER_1001), "wrong skill accepted");
    }

    function testInsufficientRatingRequestFails() public {
        _register(AptorProofFixtures.COMMITMENT);
        _create(1001, AptorProofFixtures.SKILL, 24, true, 480);
        require(!_tryFulfill1001(AptorProofFixtures.COMMITMENT, AptorProofFixtures.NULLIFIER_1001), "changed rating accepted");
    }

    function testMissingProductionExperienceProofFails() public {
        _register(AptorProofFixtures.COMMITMENT);
        _create(1001, AptorProofFixtures.SKILL, 24, false, 400);
        require(!_tryFulfill1001(AptorProofFixtures.COMMITMENT, AptorProofFixtures.NULLIFIER_1001), "changed production flag accepted");
    }

    function testTamperedRegisteredCommitmentFails() public {
        uint256 changedCommitment = AptorProofFixtures.COMMITMENT + 1;
        _register(changedCommitment);
        _createRequest1001();
        require(!_tryFulfill1001(changedCommitment, AptorProofFixtures.NULLIFIER_1001), "tampered commitment accepted");
    }

    function testChangedRequestIdFails() public {
        _register(AptorProofFixtures.COMMITMENT);
        _create(1003, AptorProofFixtures.SKILL, 24, true, 400);
        require(!_tryFulfill(1003, AptorProofFixtures.COMMITMENT, AptorProofFixtures.NULLIFIER_1001, false), "changed request ID accepted");
    }

    function testMalformedProofFails() public {
        _register(AptorProofFixtures.COMMITMENT);
        _createRequest1001();
        require(!_tryFulfill(1001, AptorProofFixtures.COMMITMENT, AptorProofFixtures.NULLIFIER_1001, true), "malformed proof accepted");
    }

    function testReplayedFulfillmentFails() public {
        _register(AptorProofFixtures.COMMITMENT);
        _createRequest1001();
        _fulfill1001();
        require(!_tryFulfill1001(AptorProofFixtures.COMMITMENT, AptorProofFixtures.NULLIFIER_1001), "replay accepted");
    }

    function testSameCredentialFulfillsDifferentRequestWithDifferentNullifier() public {
        _register(AptorProofFixtures.COMMITMENT);
        _createRequest1001();
        _create(1002, AptorProofFixtures.SKILL, 12, false, 350);
        _fulfill1001();
        (uint256[2] memory a, uint256[2][2] memory b, uint256[2] memory c) = AptorProofFixtures.proof1002();
        vm.prank(HOLDER);
        requests.fulfillRequest(1002, AptorProofFixtures.COMMITMENT, AptorProofFixtures.NULLIFIER_1002, a, b, c);
        require(AptorProofFixtures.NULLIFIER_1001 != AptorProofFixtures.NULLIFIER_1002, "nullifiers equal");
    }

    function _register(uint256 commitment) private {
        vm.prank(ISSUER);
        registry.registerCredential(commitment);
    }

    function _createRequest1001() private {
        _create(1001, AptorProofFixtures.SKILL, 24, true, 400);
    }

    function _create(uint256 id, uint256 skill, uint16 months, bool production, uint16 rating) private {
        vm.prank(VERIFIER);
        requests.createRequest(id, skill, months, production, rating);
    }

    function _fulfill1001() private {
        (uint256[2] memory a, uint256[2][2] memory b, uint256[2] memory c) = AptorProofFixtures.proof1001();
        vm.prank(HOLDER);
        requests.fulfillRequest(1001, AptorProofFixtures.COMMITMENT, AptorProofFixtures.NULLIFIER_1001, a, b, c);
    }

    function _tryFulfill1001(uint256 commitment, uint256 nullifier) private returns (bool) {
        return _tryFulfill(1001, commitment, nullifier, false);
    }

    function _tryFulfill(uint256 id, uint256 commitment, uint256 nullifier, bool corruptProof) private returns (bool ok) {
        (uint256[2] memory a, uint256[2][2] memory b, uint256[2] memory c) = AptorProofFixtures.proof1001();
        if (corruptProof) a[0] += 1;
        vm.prank(HOLDER);
        (ok,) = address(requests).call(
            abi.encodeCall(AptorProofRequests.fulfillRequest, (id, commitment, nullifier, a, b, c))
        );
    }
}
