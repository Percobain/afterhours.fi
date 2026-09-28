// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title ReferenceOracle - per-share reference prices for each weekend epoch.
/// @notice Prices are USD with 8 decimals, already divided by the issuer's sharesMultiplier (per share, not per token).
///         An epoch is identified by the unix timestamp of the Friday close it starts at (16:00 New York).
///         `close` is the Friday closing print, `open` the first official Monday opening print at or after nextOpenTime.
///         Corporate actions (`ASSET_PAUSED`, splits, dividends in kind) void the epoch for that token; policies are refunded.
///         Hackathon trust model: the owner and whitelisted keepers post prices. Production would read the RWA Data API through an attested relayer.
contract ReferenceOracle is Ownable {
    struct EpochRef {
        uint128 closePrice; // 8 decimals, per share
        uint128 openPrice;  // 8 decimals, per share, 0 until Monday
        uint64 closeAt;     // when close was posted
        uint64 openAt;      // when open was posted
        bool voided;
        string voidReason;  // e.g. "cash_dividend", "stock_split", "ASSET_PAUSED"
    }

    mapping(address => bool) public keepers;
    mapping(address => mapping(uint64 => EpochRef)) private _refs; // token => epochId => ref
    mapping(address => uint128) public lastPrice;                  // latest per-share reference, for bind-time holding checks
    mapping(address => uint64) public lastPriceAt;

    event KeeperSet(address indexed keeper, bool allowed);
    event ClosePosted(address indexed token, uint64 indexed epochId, uint128 price);
    event OpenPosted(address indexed token, uint64 indexed epochId, uint128 price);
    event EpochVoided(address indexed token, uint64 indexed epochId, string reason);
    event LastPriceUpdated(address indexed token, uint128 price);

    error NotKeeper();
    error ZeroPrice();
    error AlreadyPosted();

    modifier onlyKeeper() {
        if (msg.sender != owner() && !keepers[msg.sender]) revert NotKeeper();
        _;
    }

    constructor(address owner_) Ownable(owner_) {}

    function setKeeper(address keeper, bool allowed) external onlyOwner {
        keepers[keeper] = allowed;
        emit KeeperSet(keeper, allowed);
    }

    /// @notice Update the live per-share reference (used for the holding check at bind time and the UI).
    function setLastPrice(address token, uint128 price) public onlyKeeper {
        if (price == 0) revert ZeroPrice();
        lastPrice[token] = price;
        lastPriceAt[token] = uint64(block.timestamp);
        emit LastPriceUpdated(token, price);
    }

    function setLastPrices(address[] calldata tokens, uint128[] calldata prices) external onlyKeeper {
        for (uint256 i; i < tokens.length; ++i) setLastPrice(tokens[i], prices[i]);
    }

    /// @notice Post the Friday close for an epoch. Can be re-posted by the owner only (correction path).
    function postClose(address token, uint64 epochId, uint128 price) external onlyKeeper {
        if (price == 0) revert ZeroPrice();
        EpochRef storage r = _refs[token][epochId];
        if (r.closePrice != 0 && msg.sender != owner()) revert AlreadyPosted();
        r.closePrice = price;
        r.closeAt = uint64(block.timestamp);
        lastPrice[token] = price;
        lastPriceAt[token] = uint64(block.timestamp);
        emit ClosePosted(token, epochId, price);
    }

    /// @notice Post the Monday opening print for an epoch. Can be re-posted by the owner only.
    function postOpen(address token, uint64 epochId, uint128 price) external onlyKeeper {
        if (price == 0) revert ZeroPrice();
        EpochRef storage r = _refs[token][epochId];
        if (r.openPrice != 0 && msg.sender != owner()) revert AlreadyPosted();
        r.openPrice = price;
        r.openAt = uint64(block.timestamp);
        lastPrice[token] = price;
        lastPriceAt[token] = uint64(block.timestamp);
        emit OpenPosted(token, epochId, price);
    }

    function postCloseBatch(address[] calldata tokens, uint64 epochId, uint128[] calldata prices) external onlyKeeper {
        for (uint256 i; i < tokens.length; ++i) {
            if (prices[i] == 0) revert ZeroPrice();
            EpochRef storage r = _refs[tokens[i]][epochId];
            if (r.closePrice != 0 && msg.sender != owner()) revert AlreadyPosted();
            r.closePrice = prices[i];
            r.closeAt = uint64(block.timestamp);
            lastPrice[tokens[i]] = prices[i];
            lastPriceAt[tokens[i]] = uint64(block.timestamp);
            emit ClosePosted(tokens[i], epochId, prices[i]);
        }
    }

    function postOpenBatch(address[] calldata tokens, uint64 epochId, uint128[] calldata prices) external onlyKeeper {
        for (uint256 i; i < tokens.length; ++i) {
            if (prices[i] == 0) revert ZeroPrice();
            EpochRef storage r = _refs[tokens[i]][epochId];
            if (r.openPrice != 0 && msg.sender != owner()) revert AlreadyPosted();
            r.openPrice = prices[i];
            r.openAt = uint64(block.timestamp);
            lastPrice[tokens[i]] = prices[i];
            lastPriceAt[tokens[i]] = uint64(block.timestamp);
            emit OpenPosted(tokens[i], epochId, prices[i]);
        }
    }

    /// @notice Void an epoch for a token (corporate action, halted asset, oracle failure). Policies are refunded.
    function voidEpoch(address token, uint64 epochId, string calldata reason) external onlyKeeper {
        EpochRef storage r = _refs[token][epochId];
        r.voided = true;
        r.voidReason = reason;
        emit EpochVoided(token, epochId, reason);
    }

    function getRef(address token, uint64 epochId) external view returns (EpochRef memory) {
        return _refs[token][epochId];
    }

    /// @return settled true when both prints exist or the epoch is voided
    function isSettleable(address token, uint64 epochId) external view returns (bool settled, bool voided) {
        EpochRef storage r = _refs[token][epochId];
        voided = r.voided;
        settled = voided || (r.closePrice != 0 && r.openPrice != 0);
    }
}
