// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AptorCredentialGroth16Verifier} from "../src/AptorCredentialVerifier.sol";
import {AptorCredentialRegistry} from "../src/AptorCredentialRegistry.sol";
import {AptorProofRequests} from "../src/AptorProofRequests.sol";

interface VmDeploy {
    function envUint(string calldata name) external returns (uint256);
    function envAddress(string calldata name) external returns (address);
    function startBroadcast(uint256 privateKey) external;
    function stopBroadcast() external;
}

contract DeployAptor {
    VmDeploy private constant vm = VmDeploy(address(uint160(uint256(keccak256("hevm cheat code")))));

    error WrongChain(uint256 expected, uint256 actual);

    event AptorDeployed(address verifier, address registry, address requests, address admin);

    function run()
        external
        returns (
            AptorCredentialGroth16Verifier verifier,
            AptorCredentialRegistry registry,
            AptorProofRequests requests
        )
    {
        uint256 expectedChainId = vm.envUint("HSK_EXPECTED_CHAIN_ID");
        if (block.chainid != expectedChainId) revert WrongChain(expectedChainId, block.chainid);
        address admin = vm.envAddress("APTOR_ADMIN_ADDRESS");
        uint256 deployerPrivateKey = vm.envUint("HSK_DEPLOYER_PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);
        verifier = new AptorCredentialGroth16Verifier();
        registry = new AptorCredentialRegistry(admin);
        requests = new AptorProofRequests(address(verifier), address(registry));
        vm.stopBroadcast();

        emit AptorDeployed(address(verifier), address(registry), address(requests), admin);
    }
}
