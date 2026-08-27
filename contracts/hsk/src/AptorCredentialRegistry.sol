// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract AptorCredentialRegistry {
    error NotOwner();
    error IssuerNotApproved();
    error InvalidCommitment();
    error CredentialAlreadyRegistered();
    error NotCredentialIssuer();
    error CredentialAlreadyRevoked();

    struct CredentialStatus {
        address issuer;
        bool revoked;
    }

    address public immutable owner;
    mapping(address => bool) public approvedIssuers;
    mapping(uint256 => CredentialStatus) public credentials;

    event IssuerApprovalChanged(address indexed issuer, bool approved);
    event CredentialRegistered(uint256 indexed commitment, address indexed issuer);
    event CredentialRevoked(uint256 indexed commitment, address indexed issuer);

    constructor(address admin) {
        if (admin == address(0)) revert NotOwner();
        owner = admin;
    }

    function setIssuerApproval(address issuer, bool approved) external {
        if (msg.sender != owner) revert NotOwner();
        if (issuer == address(0)) revert IssuerNotApproved();
        approvedIssuers[issuer] = approved;
        emit IssuerApprovalChanged(issuer, approved);
    }

    function registerCredential(uint256 commitment) external {
        if (!approvedIssuers[msg.sender]) revert IssuerNotApproved();
        if (commitment == 0) revert InvalidCommitment();
        if (credentials[commitment].issuer != address(0)) revert CredentialAlreadyRegistered();
        credentials[commitment] = CredentialStatus({issuer: msg.sender, revoked: false});
        emit CredentialRegistered(commitment, msg.sender);
    }

    function revokeCredential(uint256 commitment) external {
        CredentialStatus storage credential = credentials[commitment];
        if (credential.issuer != msg.sender) revert NotCredentialIssuer();
        if (credential.revoked) revert CredentialAlreadyRevoked();
        credential.revoked = true;
        emit CredentialRevoked(commitment, msg.sender);
    }

    function isCredentialValid(uint256 commitment) external view returns (bool) {
        CredentialStatus memory credential = credentials[commitment];
        return credential.issuer != address(0) && !credential.revoked && approvedIssuers[credential.issuer];
    }
}
