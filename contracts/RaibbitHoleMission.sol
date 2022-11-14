// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import "hardhat/console.sol";

import "./interfaces/IRaibbitHoleMission.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165Checker.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

error NotApproved();
error NotEnoughQuota();
error Unauthorized();
error InvalidTime();
error InvalidInput();
error InvalidSignature();

contract RaibbitHoleMissionStorage is IMission {
    mapping(uint256 => MissionInfo) public missionMeta;
    mapping(address => mapping(uint256 => uint256)) public missionRecord;
    // User -> MissionId -> MissionTokenAddress -> MissionTokneList
    mapping(address => mapping(uint256 => mapping(address => EnumerableSet.UintSet))) internal missionDeposits;
    mapping(address => bool) public isAuthorized;
    mapping(address => bool) public isSigner;

    uint256 internal _missionId;
    address public constant rugPullFrensAddress = address(0xc9E3Ca32CAaA6ee67476C5d35d4B8ec64F58D4Ad);
    address public gfAddress;
}

contract RaibbitHoleMission is     
    IRaibbitHoleMission, 
    RaibbitHoleMissionStorage,
    ReentrancyGuard,
    Ownable,
    IERC721Receiver
{
    using EnumerableSet for EnumerableSet.UintSet;
    using ERC165Checker for address;

    constructor(
        address _gfAddress
    )
    {
        isAuthorized[owner()] = true;
        gfAddress = _gfAddress;
    }

      ///////////////
     // Modifiers //
    ///////////////

    modifier onlyAuthorized() {
        if (!isAuthorized[msg.sender]) {
            revert Unauthorized();
        }
        _;
    }

    modifier missionEntryActive() {
        if (block.timestamp <= missionMeta[_missionId].missionEntryStartTimestamp ||
            block.timestamp >= missionMeta[_missionId].missionEntryEndTimestamp) {
            revert InvalidTime();
        }
        _;
    }

      //////////////////////////////
     // User Execution Functions //
    //////////////////////////////

    /** @dev Use can go to missions by staking their tokens
     * @param addressList List of addresses of the tokens user wants to stake
     * @param tokenIds List of Ids of the tokens user wants to stake
     * @param signatureList For type five mission, only whitelisted tokens can stake
     * Note Type1: Staking for GalaxyFrens holders
     *      Type2: Staking for RugPullFrens holders
     *      Type3: Staking for GalaxyFrens & RugPullFrens holders
     *      Type4: Staking for other ERC721 token holders
     *      Type5: Staking for GalaxyFrens holders, but only whitelisted tokens allowed
     *
     *      1. One mission at a time.
     *      2. Each mission has a entry count limit.
     *      3. Each mission has a deposit available period.
     *      4. Each mission has a withdraw available timestamp.
     */
    function mission(
        address[] calldata addressList, 
        uint256[] calldata tokenIds, 
        bytes[] calldata signatureList
    )
        external
        override
        nonReentrant
        missionEntryActive
    {
        if (tokenIds.length == 0) {
            revert InvalidInput();
        }

        if ((missionMeta[_missionId].missionCurEntry + tokenIds.length) > 
            missionMeta[_missionId].missionMaxEntry) {
            revert NotEnoughQuota();
        }

        if (missionMeta[_missionId].missionType == 1 ||
            missionMeta[_missionId].missionType == 2 ||
            missionMeta[_missionId].missionType == 4) {
            address _missionAddress = missionMeta[_missionId].missionAddress;
            
            for (uint256 i; i < tokenIds.length; i++) {
                IERC721(_missionAddress).safeTransferFrom(msg.sender, address(this), tokenIds[i], "");

                missionDeposits[msg.sender][_missionId][_missionAddress].add(tokenIds[i]);
            }

            missionMeta[_missionId].missionCurEntry += tokenIds.length;
            missionRecord[msg.sender][_missionId] += tokenIds.length;

            emit Missioning(msg.sender, _missionId, missionRecord[msg.sender][_missionId]);
        }

        else if (missionMeta[_missionId].missionType == 3) {
            if (addressList.length != tokenIds.length) {
                revert InvalidInput();
            }

            for (uint256 i; i < tokenIds.length; i++) {
                address _missionAddress = addressList[i];
                if (_missionAddress != gfAddress || _missionAddress != rugPullFrensAddress) {
                    revert InvalidInput();
                }
                
                IERC721(_missionAddress).safeTransferFrom(msg.sender, address(this), tokenIds[i], "");

                missionDeposits[msg.sender][_missionId][_missionAddress].add(tokenIds[i]);
            }

            missionMeta[_missionId].missionCurEntry += tokenIds.length;
            missionRecord[msg.sender][_missionId] += tokenIds.length;

            emit Missioning(msg.sender, _missionId, missionRecord[msg.sender][_missionId]);
        }

        else if (missionMeta[_missionId].missionType == 5) {
            if (signatureList.length != tokenIds.length) {
                revert InvalidInput();
            }

            address _missionAddress = missionMeta[_missionId].missionAddress;

            for (uint256 i; i < tokenIds.length; i++) {                
                bytes32 hash = ECDSA.toEthSignedMessageHash(
                    keccak256(
                        abi.encodePacked(
                            msg.sender,
                            tokenIds[i],
                            _missionId
                        )
                    )
                );

                if (!isSigner[ECDSA.recover(hash, signatureList[i])]) {
                    revert InvalidSignature();
                }

                IERC721(_missionAddress).safeTransferFrom(msg.sender, address(this), tokenIds[i], "");

                missionDeposits[msg.sender][_missionId][_missionAddress].add(tokenIds[i]);
            }

            missionMeta[_missionId].missionCurEntry += tokenIds.length;
            missionRecord[msg.sender][_missionId] += tokenIds.length;

            emit Missioning(msg.sender, _missionId, missionRecord[msg.sender][_missionId]);
        }
    }

    function missionComplete(MissionTokens[] calldata tokensList)
        external
        override
        nonReentrant
    {
        for (uint256 i; i < tokensList.length; i++) {
            if (block.timestamp <= missionMeta[tokensList[i].missionId].missionCompleteTimestamp) {
                continue;
            }
            for (uint256 j; j < tokensList[i].tokenIds.length; j++) {
                if (missionDeposits[msg.sender][tokensList[i].missionId][tokensList[i].missionAddress].contains(tokensList[i].tokenIds[j])) {

                    IERC721(tokensList[i].missionAddress).safeTransferFrom(address(this), msg.sender, tokensList[i].tokenIds[j], "");

                    missionDeposits[msg.sender][tokensList[i].missionId][tokensList[i].missionAddress].remove(tokensList[i].tokenIds[j]);

                    emit Unmissioning(msg.sender, tokensList[i].missionAddress, tokensList[i].tokenIds[j]);
                }
            }
        }
    }

      ////////////////////////////
     // Info Getters Functions //
    ////////////////////////////

    function getLastMissionId() 
        external 
        view 
        override
        returns(uint256 missionId)
    {
        return _missionId;
    }

    function getLastMissionInfo()
        external 
        view
        override
        returns(MissionInfo memory missionsList)
    {
        return missionMeta[_missionId];
    }

    function getDepositRecordByMission(
        address owner, 
        uint256 missionId
    ) 
        public 
        view
        override
        returns(uint256 entryCount)
    {
        return missionRecord[owner][missionId];
    }

    function getAllDepositRecordByOwner(address owner) 
        external 
        view
        override
        returns(MissionRecord[] memory joinedMissionList)
    {
        MissionRecord[] memory result = new MissionRecord[](_missionId);
        for (uint256 missionId = 1; missionId <= _missionId; missionId++) {
            result[missionId] = MissionRecord(missionId, getDepositRecordByMission(owner, missionId));
        }
        return result;
    }

    function getDepositTokensByMission(
        address owner, 
        uint256 missionId,
        address missionTokenAddress
    ) 
        public 
        view
        override
        returns(uint256[] memory tokensList)
    {
        uint256[] memory tokenIds = new uint256[] (missionDeposits[owner][missionId][missionTokenAddress].length());

        for (uint256 i; i < missionDeposits[owner][missionId][missionTokenAddress].length(); i++) {
            tokenIds[i] = missionDeposits[owner][missionId][missionTokenAddress].at(i);
        }
        return tokenIds;
    }

    function getDepositTokensByOwner(address owner) 
        external 
        view
        override
        returns(MissionTokens[] memory tokensList)
    {
        MissionTokens[] memory result = new MissionTokens[](_missionId * 2);
        uint256 storagePtr = 0;
        for (uint256 missionId = 1; missionId <= _missionId; missionId++) {
            if (missionMeta[missionId].missionType == 3) {
                uint256[] memory tokenRPFIds = getDepositTokensByMission(owner, missionId, rugPullFrensAddress);
                uint256[] memory tokenGFIds = getDepositTokensByMission(owner, missionId, gfAddress);
                result[storagePtr] = MissionTokens(missionId, rugPullFrensAddress, tokenRPFIds);
                result[storagePtr + 1] = MissionTokens(missionId, gfAddress, tokenGFIds);
                storagePtr = storagePtr + 2;
            } else {
                uint256[] memory tokenIds = getDepositTokensByMission(owner, missionId, missionMeta[missionId].missionAddress);
                result[missionId - 1] = MissionTokens(missionId, missionMeta[missionId].missionAddress, tokenIds);
                storagePtr = storagePtr + 1;
            }
        }
        return result;
    }

    function getMissionInfoInBatch(
        uint256 start, 
        uint256 end
    ) 
        external 
        view
        override
        returns(MissionInfo[] memory missionsList)
    {
        MissionInfo[] memory result = new MissionInfo[](start - end + 1);
        for(uint256 i = start; i <= end; i++) {
            result[i - start] = missionMeta[i];
        }
        return result;
    }

      ////////////////////////////
     // Info Getters Functions //
    ////////////////////////////

    function addNewMission(
        uint256 newMissionType,
        uint256 newMissionMaxEntry,
        uint256 newMissionEntryStartTimestamp, 
        uint256 newMissionEntryEndTimestamp, 
        uint256 newMissionCompleteTimestamp,
        address newMissionAddress
    )
        external
        override
        onlyAuthorized
    {
        if ((newMissionMaxEntry == 0) ||
            (newMissionEntryStartTimestamp > newMissionEntryEndTimestamp) ||
            (newMissionEntryEndTimestamp > newMissionCompleteTimestamp) ||
            (!newMissionAddress.supportsInterface(type(IERC721).interfaceId)) ) { 
            revert InvalidInput();
        }

        _missionId += 1;

        if (newMissionType == 1) {
            newMissionAddress = gfAddress;
        }

        if (newMissionType == 2) {
            newMissionAddress = rugPullFrensAddress;
        }

        if (newMissionType == 3) {
            newMissionAddress = address(0);
        }

        if (newMissionType == 5) {
            newMissionAddress = gfAddress;
        }

        missionMeta[_missionId] = MissionInfo(
            newMissionType, 
            0, 
            newMissionMaxEntry,
            newMissionEntryStartTimestamp,
            newMissionEntryEndTimestamp,
            newMissionCompleteTimestamp,
            newMissionAddress);

        emit NewMissionSet(
            _missionId,
            newMissionType,
            0,
            newMissionMaxEntry,
            newMissionEntryStartTimestamp, 
            newMissionEntryEndTimestamp, 
            newMissionCompleteTimestamp, 
            newMissionAddress
            );
    }

    function changeMissionInfo(
        uint256 missionId, 
        uint256 newMissionType,
        uint256 newMissionCurEntry,
        uint256 newMissionMaxEntry,
        uint256 newMissionEntryStartTimestamp, 
        uint256 newMissionEntryEndTimestamp, 
        uint256 newMissionCompleteTimestamp, 
        address newMissionAddress
    ) 
        external
        override
        onlyAuthorized
    {
        missionMeta[missionId] = MissionInfo(
        newMissionType, 
        newMissionCurEntry, 
        newMissionMaxEntry,
        newMissionEntryStartTimestamp,
        newMissionEntryEndTimestamp,
        newMissionCompleteTimestamp,
        newMissionAddress);

        emit NewMissionSet(
        missionId,
        newMissionType,
        newMissionCurEntry,
        newMissionMaxEntry,
        newMissionEntryStartTimestamp, 
        newMissionEntryEndTimestamp, 
        newMissionCompleteTimestamp, 
        newMissionAddress
        );
    }

      ////////////////////////////////////////
     // Set Roles & Token Status Functions //
    ////////////////////////////////////////

    /** @dev Set the status of whether an address is authorized
     * @param authorizedAddress Address to change its authorized status
     * @param newAuthorizedStatus New status to assign to the authorizedAddress
     */
    function setAuthorized(
        address authorizedAddress, 
        bool newAuthorizedStatus
    )
        external
        override
        onlyOwner
    {
        isAuthorized[authorizedAddress] = newAuthorizedStatus;

        emit AuthorizeAddressChange(authorizedAddress, newAuthorizedStatus);
    }

    /** @dev Set the status of whether an address is signer
     * @param signerAddress Address to change its status as a signer
     * @param newSignerStatus New status to assign to the signerAddress
     */
    function setSigner(
        address signerAddress,
        bool newSignerStatus
    )
        external
        override
        onlyOwner
    {
        isSigner[signerAddress] = newSignerStatus;

        emit SignerAddressChange(signerAddress, newSignerStatus);
    }

    /** @dev Set the status of whether an address is authorized in batch
     * @param authorizedAddressArray Address list to change its authorized status
     * @param newAuthorizedStatusArray New status list to assign to the authorizedAddress
     */
    function setAuthorizedInBatch(
        address[] memory authorizedAddressArray, 
        bool[] memory newAuthorizedStatusArray
    )
        external
        override
        onlyOwner
    {
        if (authorizedAddressArray.length != newAuthorizedStatusArray.length) {
            revert InvalidInput();
        }
        uint256 listLength = authorizedAddressArray.length;
        for(uint256 i = 0; i < listLength; i++) {
            isAuthorized[authorizedAddressArray[i]] = newAuthorizedStatusArray[i];

            emit AuthorizeAddressChange(authorizedAddressArray[i], newAuthorizedStatusArray[i]);
        }
    }

    /** @dev Set the status of whether an address is signer in batch
     * @param signerAddressArray Address list to change its status as a signer
     * @param newSignerStatusArray New status list to assign to the signerAddress
     */
    function setSignerInBatch(
        address[] memory signerAddressArray, 
        bool[] memory newSignerStatusArray
    )
        external
        override
        onlyOwner
    {
        if (signerAddressArray.length != newSignerStatusArray.length) {
            revert InvalidInput();
        }
        uint256 listLength = signerAddressArray.length;
        for(uint256 i = 0; i < listLength; i++) {
            isSigner[signerAddressArray[i]] = newSignerStatusArray[i];

            emit SignerAddressChange(signerAddressArray[i], newSignerStatusArray[i]);
        }
    }
    
      //////////////////////////
     // Set Params Functions //
    //////////////////////////

    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) 
        external 
        pure 
        override 
        returns (bytes4) 
    {
        return IERC721Receiver.onERC721Received.selector;
    }
}
