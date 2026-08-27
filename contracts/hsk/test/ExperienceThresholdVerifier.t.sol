// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Groth16Verifier} from "../src/ExperienceThresholdVerifier.sol";

contract ExperienceThresholdVerifierTest {
    Groth16Verifier private verifier;

    uint256[2] private a = [
        uint256(0x06ec7ead9dfe76ade9948bab537b5138144b4bf786d2c37a239db8e08c8f3fc1),
        uint256(0x0751a91a8cb13824ad46cd5ba77783460a8aafea399cb18058ef00b7690b3a93)
    ];
    uint256[2][2] private b = [
        [uint256(0x2546d97d961ed025e2dc42b471b085d88800ae5080074063e15c183e48e79a8e), uint256(0x08cfa9d30214be210dd00d98d908c1ab4c4053105ba95d0d920eaf2124c23905)],
        [uint256(0x1c8296517f5e38ad8584475089470f65116eefeec37376e888b5aa724592847c), uint256(0x0d736a0bedb878bc503ecba73076e5d8f615edda14bbdbfd954cbe5c29efc9c9)]
    ];
    uint256[2] private c = [
        uint256(0x21263dbc1f5bce304c22f7783418c20ccd716a93542d56f0f94a397e6490d426),
        uint256(0x206453d059cbb4f91a02a07cb0b6a32644997fb975b122b824ae79e6b4a98fe2)
    ];

    function setUp() public {
        verifier = new Groth16Verifier();
    }

    function testValidProofVerifies() public view {
        uint256[1] memory input = [uint256(24)];
        require(verifier.verifyProof(a, b, c, input), "valid proof rejected");
    }

    function testTamperedPublicInputFails() public view {
        uint256[1] memory input = [uint256(48)];
        require(!verifier.verifyProof(a, b, c, input), "tampered input accepted");
    }

    function testTamperedProofFails() public view {
        uint256[2] memory changedA = a;
        changedA[0] += 1;
        uint256[1] memory input = [uint256(24)];
        require(!verifier.verifyProof(changedA, b, c, input), "tampered proof accepted");
    }

    function testUnrelatedProofAndInputFail() public view {
        uint256[2] memory zeroA;
        uint256[2][2] memory zeroB;
        uint256[2] memory zeroC;
        uint256[1] memory input = [uint256(7)];
        require(!verifier.verifyProof(zeroA, zeroB, zeroC, input), "unrelated proof accepted");
    }

    function testMalformedCalldataFails() public {
        (bool ok,) = address(verifier).call(abi.encodePacked(verifier.verifyProof.selector, bytes32(uint256(1))));
        require(!ok, "malformed calldata accepted");
    }
}
