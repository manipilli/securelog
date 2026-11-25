// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract LogIntegrityRegistry {
    struct LogRecord {
        bytes32 fileHash;
        string category;
        uint256 timestamp;
        address registrant;
        bool active;
    }

    mapping(bytes32 => LogRecord) private records;
    event LogRegistered(bytes32 indexed logId, bytes32 indexed fileHash, string category, address registrant);
    event LogVerified(bytes32 indexed logId, bool matches, address verifier);
    event TamperDetected(bytes32 indexed logId, bytes32 observedHash, address verifier);

    function registerLog(bytes32 logId, bytes32 fileHash, string calldata category) external {
        require(!records[logId].active, "log already registered");
        records[logId] = LogRecord(fileHash, category, block.timestamp, msg.sender, true);
        emit LogRegistered(logId, fileHash, category, msg.sender);
    }

    function getLogRecord(bytes32 logId) external view returns (LogRecord memory) { return records[logId]; }

    function verifyLog(bytes32 logId, bytes32 currentHash) external returns (bool) {
        LogRecord memory record = records[logId];
        require(record.active, "log inactive");
        bool matches = record.fileHash == currentHash;
        emit LogVerified(logId, matches, msg.sender);
        if (!matches) emit TamperDetected(logId, currentHash, msg.sender);
        return matches;
    }

    function deactivateLog(bytes32 logId) external {
        require(records[logId].registrant == msg.sender, "only registrant");
        records[logId].active = false;
    }
}
