// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

interface IMission {
    // Struct to store metadata of each mission
    struct MissionInfo {
        uint256 missionType;
        uint256 missionCurEntry;
        uint256 missionMaxEntry;
        uint256 missionEntryStartTimestamp;
        uint256 missionEntryEndTimestamp;
        uint256 missionCompleteTimestamp;
        address missionAddress;
    }
}

interface IRaibbitHoleMission is IMission {
    // Struct to store the participant record
    struct MissionRecord {
        uint256 missionId;
        uint256 entryCount;
    }

    // Struct to store the deposited token record
    struct MissionTokens {
        uint256 missionId;
        address missionAddress;
        uint256[] tokenIds;
    }

      //////////////////////////////
     // User Execution Functions //
    //////////////////////////////

    // The tokens that match the missionMeta settings can deposit their tokens on to the mission.
    function mission(address[] calldata addressList, uint256[] calldata tokenIds, bytes[] calldata signatureList) external;

    function missionComplete(MissionTokens[] calldata tokensList) external;

      ////////////////////////////
     // Info Getters Functions //
    ////////////////////////////

    // Retrieve the missionId of the latest mission.
    function getLastMissionId() external view returns(uint256 missionId);
    // Retrieve the missionInfo of the latest mission.
    function getLastMissionInfo() external view returns(MissionInfo memory missionInfo);
    // Retrieve the amount of tokens an address deposited in a mission.
    function getDepositRecordByMission(address owner, uint256 missionId) external view returns(uint256 entryCount);
    // Retrieve the amount of tokens an address deposited in the previous missions.
    function getAllDepositRecordByOwner(address owner) external view returns(MissionRecord[] memory joinedMissionList); 

    function getDepositTokensByMission(address owner, uint256 missionId, address missionTokenAddress) external view returns(uint256[] memory tokensList);

    function getDepositTokensByOwner(address owner) external view returns(MissionTokens[] memory tokensList);

    function getMissionInfoInBatch(uint256 start, uint256 end) external view returns(MissionInfo[] memory missionsList);

      /////////////////////////
     // Set Phase Functions //
    /////////////////////////

    // Set the mission-related variables used in the missioning by owner.
    function addNewMission(uint256 newMissionType, uint256 newMissionMaxEntry, uint256 newMissionEntryStartTimestamp, uint256 newMissionEntryEndTimestamp, uint256 newMissionCompleteTimestamp, address newMissionAddress) external;

    function changeMissionInfo(uint256 missionId, uint256 newMissionType, uint256 newMissionMaxEntry, uint256 newMissionCurEntry, uint256 newMissionEntryStartTimestamp, uint256 newMissionEntryEndTimestamp, uint256 newMissionCompleteTimestamp, address newMissionAddress) external;

      ////////////////////////////////////////
     // Set Roles & Token Status Functions //
    ////////////////////////////////////////

    // Set the authorized status of an address, true to have authorized access, false otherwise.
    function setAuthorized(address authorizedAddress, bool newAuthorizedStatus) external;
    // Set the address to generate and validate the signature.
    function setSigner(address signerAddress, bool newSignerStatus) external;
    // Set the authorized status of an address, true to have authorized access, false otherwise in batch.
    function setAuthorizedInBatch(address[] memory authorizedAddressArray, bool[] memory newAuthorizedStatusArray) external;
    // Set the address to generate and validate the signature in batch.
    function setSignerInBatch(address[] memory signerAddressArray, bool[] memory newSignerStatusArray) external;

      //////////////////////////
     // Set Params Functions //
    //////////////////////////

    // This event is triggered whenever a call to #mission succeeds.
    event Missioning(address executor, uint256 missionId, uint256 depositAmount);
    // This event is triggered whenever a call to #missionComplete succeeds.
    event Unmissioning(address executor, address tokenAddress, uint256 tokenId);
    // This event is triggered whenever a call to #setMissionStatus succeeds.
    event NewMissionSet(uint256 newMissionId, uint256 newMissionType, uint256 newMissionCurEntry, uint256 newMissionMaxEntry, uint256 newMissionEntryStartTimestamp, uint256 newMissionEntryEndTimestamp, uint256 newMissionCompleteTimestamp, address newMissionAddress);
    // This event is triggered whenever a call to #setAuthorized and #setAuthorizedInBatch succeeds.
    event AuthorizeAddressChange(address addressChanges, bool newStatus);
    // This event is triggered whenever a call to #setSigner and #setSignerInBatch succeeds,
    event SignerAddressChange(address addressChanges, bool newStatus);
}