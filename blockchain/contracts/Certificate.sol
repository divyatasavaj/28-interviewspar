// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title InterviewSpar Certificate
/// @notice Mints a tamper-proof, publicly verifiable certificate record on Sepolia
///         when a student crosses a score threshold. Testnet only — no real funds.
contract Certificate {
    address public owner;

    struct CertRecord {
        address candidate;
        string sessionId;
        uint256 score;
        uint256 issuedAt;
        bool exists;
    }

    // sessionId => record
    mapping(string => CertRecord) public certificates;
    // candidate => list of sessionIds
    mapping(address => string[]) public candidateCerts;

    event CertificateMinted(address indexed candidate, string sessionId, uint256 score);

    constructor() {
        owner = msg.sender;
    }

    /// @notice Mint a certificate for a completed session (caller pays gas on testnet).
    function mint(address candidate, string calldata sessionId, uint256 score)
        external
        returns (bool)
    {
        require(!certificates[sessionId].exists, "already minted");
        certificates[sessionId] = CertRecord({
            candidate: candidate,
            sessionId: sessionId,
            score: score,
            issuedAt: block.timestamp,
            exists: true
        });
        candidateCerts[candidate].push(sessionId);
        emit CertificateMinted(candidate, sessionId, score);
        return true;
    }

    function verify(string calldata sessionId) external view returns (bool, uint256) {
        CertRecord storage r = certificates[sessionId];
        return (r.exists, r.score);
    }
}
