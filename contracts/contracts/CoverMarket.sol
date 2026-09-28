// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {KeeperVault} from "./KeeperVault.sol";
import {ReferenceOracle} from "./ReferenceOracle.sol";

/// @title CoverMarket - sells weekend floors (gap cover) on tokenized stocks and settles them at the Monday open.
/// @notice A policy pays, per $1 of notional, max(-barrier - gap, 0) capped at payoutCapBps, where
///         gap = openPrice / closePrice - 1 on per-share reference prices from the ReferenceOracle.
///         Quotes are produced off-chain by the pricing engine (pooled vol-scaled tail, see backtest/) and signed by
///         `quoter`. The buyer submits the signed quote; the market checks the sale window, capacity and signature,
///         moves the premium into the vault and locks the policy's maximum payout.
///
///         Hackathon trust model: the owner can pause, change parameters, void/force-settle policies and rescue tokens.
contract CoverMarket is Ownable, Pausable, ReentrancyGuard, EIP712 {
    using SafeERC20 for IERC20;
    using Math for uint256;

    enum Status { None, Open, Settled, Refunded }

    struct Quote {
        address buyer;
        address token;        // tokenized stock (bStock / Ondo) the cover is attached to
        uint64 epochId;       // Friday close timestamp
        uint256 notionalUsd;  // USDT units (6 decimals)
        uint16 barrierBps;    // e.g. 300 = floor at -3%
        uint256 premiumUsd;   // USDT units
        uint64 expiry;        // quote valid until
        uint256 nonce;        // unique per quote
    }

    struct Policy {
        address buyer;
        address token;
        uint64 epochId;
        uint256 notionalUsd;
        uint16 barrierBps;
        uint256 premiumUsd;
        uint256 lockedUsd;
        uint256 payoutUsd;
        int256 gapBps;        // realised gap in bps, set on settlement
        Status status;
        uint64 boughtAt;
        uint64 settledAt;
    }

    struct Epoch {
        uint64 bindDeadline;  // no purchases after this (the Friday bell)
        uint64 expectedOpen;  // informational: next open time
        bool exists;
    }

    bytes32 public constant QUOTE_TYPEHASH = keccak256(
        "Quote(address buyer,address token,uint64 epochId,uint256 notionalUsd,uint16 barrierBps,uint256 premiumUsd,uint64 expiry,uint256 nonce)"
    );

    IERC20 public immutable usdt;
    KeeperVault public vault;
    ReferenceOracle public oracle;
    address public quoter;

    uint16 public payoutCapBps = 2000;   // pays at most 20% of notional per weekend (put spread)
    uint16 public minBarrierBps = 100;
    uint16 public maxBarrierBps = 2000;
    uint256 public minNotionalUsd = 10e6; // $10
    uint256 public maxNotionalUsd = 1_000_000e6;
    bool public requireHolding = true;   // buyer must hold the underlying token position at bind time
    uint16 public protocolFeeBps = 0;    // share of premium kept by the treasury (0 for the hackathon)
    address public treasury;

    mapping(uint64 => Epoch) public epochs;
    mapping(uint256 => bool) public nonceUsed;
    mapping(address => bool) public tokenAllowed;
    address[] public tokenList;

    Policy[] private _policies;
    mapping(address => uint256[]) private _policiesOf;

    // per-token open exposure for concentration caps
    mapping(address => uint256) public openNotionalByToken;
    uint16 public maxTokenShareBps = 2500; // one token may be at most 25% of total open notional (soft cap; see buy)
    uint256 public totalOpenNotional;

    event EpochOpened(uint64 indexed epochId, uint64 bindDeadline, uint64 expectedOpen);
    event TokenAllowed(address indexed token, bool allowed);
    event CoverBought(uint256 indexed policyId, address indexed buyer, address indexed token, uint64 epochId, uint256 notionalUsd, uint16 barrierBps, uint256 premiumUsd, uint256 lockedUsd);
    event CoverSettled(uint256 indexed policyId, address indexed buyer, int256 gapBps, uint256 payoutUsd);
    event CoverRefunded(uint256 indexed policyId, address indexed buyer, uint256 premiumUsd, string reason);
    event QuoterSet(address quoter);
    event ParamsSet(uint16 payoutCapBps, uint16 minBarrierBps, uint16 maxBarrierBps, uint256 minNotionalUsd, uint256 maxNotionalUsd, bool requireHolding, uint16 maxTokenShareBps);
    event FeeSet(uint16 protocolFeeBps, address treasury);
    event Rescued(address indexed token, address indexed to, uint256 amount);

    error BadSignature();
    error QuoteExpired();
    error NonceUsed();
    error NotBuyer();
    error EpochClosed();
    error EpochUnknown();
    error TokenNotAllowed();
    error BarrierOutOfRange();
    error NotionalOutOfRange();
    error NotHoldingPosition(uint256 required, uint256 held);
    error NotSettleable();
    error WrongStatus();
    error ConcentrationCap();

    constructor(IERC20 usdt_, KeeperVault vault_, ReferenceOracle oracle_, address quoter_, address owner_)
        Ownable(owner_)
        EIP712("afterhours.fi CoverMarket", "1")
    {
        usdt = usdt_;
        vault = vault_;
        oracle = oracle_;
        quoter = quoter_;
        treasury = owner_;
    }

    // ------------------------------------------------------------------ views

    function policyCount() external view returns (uint256) { return _policies.length; }
    function getPolicy(uint256 id) external view returns (Policy memory) { return _policies[id]; }
    function policiesOf(address user) external view returns (uint256[] memory) { return _policiesOf[user]; }
    function tokens() external view returns (address[] memory) { return tokenList; }

    /// @notice how much notional the pool can still cover right now (in USDT units)
    function capacityNotional() public view returns (uint256) {
        return vault.freeCushion().mulDiv(10_000, payoutCapBps);
    }

    /// @notice maximum payout locked for a policy
    function lockFor(uint256 notionalUsd) public view returns (uint256) {
        return notionalUsd.mulDiv(payoutCapBps, 10_000, Math.Rounding.Ceil);
    }

    function hashQuote(Quote calldata q) public view returns (bytes32) {
        return _hashTypedDataV4(keccak256(abi.encode(
            QUOTE_TYPEHASH, q.buyer, q.token, q.epochId, q.notionalUsd, q.barrierBps, q.premiumUsd, q.expiry, q.nonce
        )));
    }

    /// @notice shares of the underlying the buyer must hold for a given notional at the last reference price
    function requiredTokenBalance(address token, uint256 notionalUsd) public view returns (uint256) {
        uint128 px = oracle.lastPrice(token);
        if (px == 0) return 0;
        uint8 d = IERC20Metadata(token).decimals();
        // notional (6d) * 1e8 (price decimals) * 10^d / (price (8d) * 1e6)
        return notionalUsd.mulDiv(1e8 * (10 ** d), uint256(px) * 1e6);
    }

    // ------------------------------------------------------------------ buy

    /// @notice buy a weekend floor with a quote signed by the pricing engine
    function buyCover(Quote calldata q, bytes calldata signature) external whenNotPaused nonReentrant returns (uint256 policyId) {
        if (q.buyer != msg.sender) revert NotBuyer();
        if (block.timestamp > q.expiry) revert QuoteExpired();
        if (nonceUsed[q.nonce]) revert NonceUsed();
        if (!tokenAllowed[q.token]) revert TokenNotAllowed();
        if (q.barrierBps < minBarrierBps || q.barrierBps > maxBarrierBps) revert BarrierOutOfRange();
        if (q.notionalUsd < minNotionalUsd || q.notionalUsd > maxNotionalUsd) revert NotionalOutOfRange();

        Epoch memory e = epochs[q.epochId];
        if (!e.exists) revert EpochUnknown();
        if (block.timestamp > e.bindDeadline) revert EpochClosed();

        address signer = ECDSA.recover(hashQuote(q), signature);
        if (signer != quoter) revert BadSignature();
        nonceUsed[q.nonce] = true;

        if (requireHolding) {
            uint256 req = requiredTokenBalance(q.token, q.notionalUsd);
            uint256 held = IERC20(q.token).balanceOf(msg.sender);
            if (held < req) revert NotHoldingPosition(req, held);
        }

        // concentration cap: one token at most maxTokenShareBps of total open notional once the book is non-trivial
        uint256 newTokenNotional = openNotionalByToken[q.token] + q.notionalUsd;
        uint256 newTotal = totalOpenNotional + q.notionalUsd;
        if (newTotal > 100_000e6 && newTokenNotional.mulDiv(10_000, newTotal) > maxTokenShareBps) revert ConcentrationCap();

        uint256 locked = lockFor(q.notionalUsd);
        vault.lock(locked); // reverts if the cushion cannot back it

        // premium: fee to treasury, the rest to the vault
        uint256 fee = q.premiumUsd.mulDiv(protocolFeeBps, 10_000);
        if (fee > 0) usdt.safeTransferFrom(msg.sender, treasury, fee);
        usdt.safeTransferFrom(msg.sender, address(vault), q.premiumUsd - fee);
        vault.notePremium(msg.sender, q.premiumUsd - fee);

        policyId = _policies.length;
        _policies.push(Policy({
            buyer: msg.sender, token: q.token, epochId: q.epochId, notionalUsd: q.notionalUsd, barrierBps: q.barrierBps,
            premiumUsd: q.premiumUsd, lockedUsd: locked, payoutUsd: 0, gapBps: 0, status: Status.Open,
            boughtAt: uint64(block.timestamp), settledAt: 0
        }));
        _policiesOf[msg.sender].push(policyId);
        openNotionalByToken[q.token] = newTokenNotional;
        totalOpenNotional = newTotal;

        emit CoverBought(policyId, msg.sender, q.token, q.epochId, q.notionalUsd, q.barrierBps, q.premiumUsd, locked);
    }

    // ------------------------------------------------------------------ settle

    /// @notice settle a policy once the oracle has the Monday open (or the epoch is voided). Anyone can call.
    function settle(uint256 policyId) public nonReentrant {
        Policy storage p = _policies[policyId];
        if (p.status != Status.Open) revert WrongStatus();
        ReferenceOracle.EpochRef memory r = oracle.getRef(p.token, p.epochId);

        if (r.voided) {
            _refund(policyId, p, r.voidReason);
            return;
        }
        if (r.closePrice == 0 || r.openPrice == 0) revert NotSettleable();

        int256 gapBps = (int256(uint256(r.openPrice)) - int256(uint256(r.closePrice))) * 10_000 / int256(uint256(r.closePrice));
        int256 lossBps = -gapBps - int256(uint256(p.barrierBps));
        uint256 payout;
        if (lossBps > 0) {
            uint256 lb = uint256(lossBps);
            if (lb > payoutCapBps) lb = payoutCapBps;
            payout = p.notionalUsd.mulDiv(lb, 10_000);
            if (payout > p.lockedUsd) payout = p.lockedUsd;
        }
        p.gapBps = gapBps;
        p.payoutUsd = payout;
        p.status = Status.Settled;
        p.settledAt = uint64(block.timestamp);
        _closeExposure(p);

        if (payout > 0) vault.pay(p.buyer, payout, false);
        if (p.lockedUsd > payout) vault.release(p.lockedUsd - payout);
        emit CoverSettled(policyId, p.buyer, gapBps, payout);
    }

    function settleBatch(uint256[] calldata ids) external {
        for (uint256 i; i < ids.length; ++i) {
            Policy storage p = _policies[ids[i]];
            if (p.status != Status.Open) continue;
            (bool ok,) = oracle.isSettleable(p.token, p.epochId);
            if (ok) settle(ids[i]);
        }
    }

    function _refund(uint256 policyId, Policy storage p, string memory reason) internal {
        p.status = Status.Refunded;
        p.settledAt = uint64(block.timestamp);
        _closeExposure(p);
        vault.release(p.lockedUsd);
        vault.pay(p.buyer, p.premiumUsd, true);
        emit CoverRefunded(policyId, p.buyer, p.premiumUsd, reason);
    }

    function _closeExposure(Policy storage p) internal {
        openNotionalByToken[p.token] -= p.notionalUsd;
        totalOpenNotional -= p.notionalUsd;
    }

    // ------------------------------------------------------------------ admin

    function openEpoch(uint64 epochId, uint64 bindDeadline, uint64 expectedOpen) external onlyOwner {
        epochs[epochId] = Epoch({bindDeadline: bindDeadline, expectedOpen: expectedOpen, exists: true});
        emit EpochOpened(epochId, bindDeadline, expectedOpen);
    }

    function setTokenAllowed(address token, bool allowed) external onlyOwner {
        if (allowed && !tokenAllowed[token]) tokenList.push(token);
        tokenAllowed[token] = allowed;
        emit TokenAllowed(token, allowed);
    }

    function setQuoter(address quoter_) external onlyOwner {
        quoter = quoter_;
        emit QuoterSet(quoter_);
    }

    function setParams(uint16 payoutCapBps_, uint16 minBarrierBps_, uint16 maxBarrierBps_, uint256 minNotionalUsd_, uint256 maxNotionalUsd_, bool requireHolding_, uint16 maxTokenShareBps_) external onlyOwner {
        require(payoutCapBps_ > 0 && payoutCapBps_ <= 10_000, "cap");
        require(minBarrierBps_ <= maxBarrierBps_ && maxBarrierBps_ < payoutCapBps_ + 10_000, "barrier");
        payoutCapBps = payoutCapBps_; minBarrierBps = minBarrierBps_; maxBarrierBps = maxBarrierBps_;
        minNotionalUsd = minNotionalUsd_; maxNotionalUsd = maxNotionalUsd_; requireHolding = requireHolding_; maxTokenShareBps = maxTokenShareBps_;
        emit ParamsSet(payoutCapBps_, minBarrierBps_, maxBarrierBps_, minNotionalUsd_, maxNotionalUsd_, requireHolding_, maxTokenShareBps_);
    }

    function setFee(uint16 bps, address treasury_) external onlyOwner {
        require(bps <= 2_000, "fee");
        protocolFeeBps = bps; treasury = treasury_;
        emit FeeSet(bps, treasury_);
    }

    function setVaultAndOracle(KeeperVault vault_, ReferenceOracle oracle_) external onlyOwner {
        vault = vault_; oracle = oracle_;
    }

    /// @notice hackathon-only: owner settles a policy with an explicit payout (e.g. oracle outage)
    function forceSettle(uint256 policyId, int256 gapBps, uint256 payoutUsd) external onlyOwner nonReentrant {
        Policy storage p = _policies[policyId];
        if (p.status != Status.Open) revert WrongStatus();
        if (payoutUsd > p.lockedUsd) payoutUsd = p.lockedUsd;
        p.gapBps = gapBps; p.payoutUsd = payoutUsd; p.status = Status.Settled; p.settledAt = uint64(block.timestamp);
        _closeExposure(p);
        if (payoutUsd > 0) vault.pay(p.buyer, payoutUsd, false);
        if (p.lockedUsd > payoutUsd) vault.release(p.lockedUsd - payoutUsd);
        emit CoverSettled(policyId, p.buyer, gapBps, payoutUsd);
    }

    /// @notice hackathon-only: owner refunds a policy
    function forceRefund(uint256 policyId, string calldata reason) external onlyOwner nonReentrant {
        Policy storage p = _policies[policyId];
        if (p.status != Status.Open) revert WrongStatus();
        _refund(policyId, p, reason);
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    function rescue(address token, address to, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(to, amount);
        emit Rescued(token, to, amount);
    }
}
