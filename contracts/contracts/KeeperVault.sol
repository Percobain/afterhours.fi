// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC4626, ERC20, IERC20} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

/// @title KeeperVault - the Keeper (LP) pool that underwrites weekend floors.
/// @notice ERC-4626 vault over USDT. Premiums are paid straight into the vault, so share value rises as premiums accrue
///         and falls when payouts are made. Every open policy locks its maximum possible payout, so the pool is
///         fully collateralised at all times: lockedAssets can never exceed the cushion.
///
///         CPPI discipline: `floorAssets` tracks a floor equal to `floorBps` of the pool at each reset/flow.
///         cushion = totalAssets - floorAssets. New cover can only be sold while lockedAssets < cushion, so the
///         pool automatically sells less after a bad weekend and never puts the floor at risk of a single epoch.
///
///         Hackathon trust model: the owner can pause, change parameters, replace the market and rescue any token.
contract KeeperVault is ERC4626, Ownable, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using Math for uint256;

    address public market;            // the only address allowed to lock/release/pay
    uint256 public lockedAssets;      // sum of max payouts of open policies
    uint256 public floorAssets;       // CPPI floor in asset units
    uint16 public floorBps = 5000;    // 50% of pool is the floor
    uint256 public depositCap = type(uint256).max;

    // lifetime accounting for the UI
    uint256 public totalPremiumsReceived;
    uint256 public totalPayoutsPaid;
    uint256 public totalRefundsPaid;

    event MarketSet(address indexed market);
    event FloorBpsSet(uint16 floorBps);
    event FloorReset(uint256 floorAssets);
    event DepositCapSet(uint256 cap);
    event Locked(uint256 amount, uint256 lockedAssets);
    event Released(uint256 amount, uint256 lockedAssets);
    event Paid(address indexed to, uint256 amount, bool isRefund);
    event PremiumReceived(address indexed from, uint256 amount);
    event Rescued(address indexed token, address indexed to, uint256 amount);

    error NotMarket();
    error InsufficientCushion(uint256 requested, uint256 available);
    error InsufficientLocked();
    error DepositCapExceeded();

    modifier onlyMarket() {
        if (msg.sender != market) revert NotMarket();
        _;
    }

    constructor(IERC20 usdt_, address owner_)
        ERC20("afterhours.fi Keeper Share", "kUSDT")
        ERC4626(usdt_)
        Ownable(owner_)
    {}

    // ------------------------------------------------------------------ views

    /// @notice assets that are neither locked nor below the floor: what can still back new cover
    function freeCushion() public view returns (uint256) {
        uint256 ta = totalAssets();
        uint256 cushion = ta > floorAssets ? ta - floorAssets : 0;
        return cushion > lockedAssets ? cushion - lockedAssets : 0;
    }

    /// @notice assets an LP could withdraw right now without touching locked collateral
    function freeAssets() public view returns (uint256) {
        uint256 ta = totalAssets();
        return ta > lockedAssets ? ta - lockedAssets : 0;
    }

    /// @notice utilisation of the cushion in bps (locked / cushion)
    function utilisationBps() external view returns (uint256) {
        uint256 ta = totalAssets();
        uint256 cushion = ta > floorAssets ? ta - floorAssets : 0;
        if (cushion == 0) return lockedAssets == 0 ? 0 : 10_000;
        return lockedAssets.mulDiv(10_000, cushion);
    }

    function maxDeposit(address) public view override returns (uint256) {
        if (paused()) return 0;
        uint256 ta = totalAssets();
        return depositCap > ta ? depositCap - ta : 0;
    }

    function maxMint(address receiver) public view override returns (uint256) {
        return _convertToShares(maxDeposit(receiver), Math.Rounding.Floor);
    }

    function maxWithdraw(address owner_) public view override returns (uint256) {
        if (paused()) return 0;
        return Math.min(super.maxWithdraw(owner_), freeAssets());
    }

    function maxRedeem(address owner_) public view override returns (uint256) {
        if (paused()) return 0;
        uint256 byFree = _convertToShares(freeAssets(), Math.Rounding.Floor);
        return Math.min(super.maxRedeem(owner_), byFree);
    }

    // ------------------------------------------------------------------ market hooks

    /// @notice lock the maximum payout of a new policy against the cushion
    function lock(uint256 amount) external onlyMarket whenNotPaused {
        uint256 avail = freeCushion();
        if (amount > avail) revert InsufficientCushion(amount, avail);
        lockedAssets += amount;
        emit Locked(amount, lockedAssets);
    }

    /// @notice release locked collateral that was not paid out
    function release(uint256 amount) external onlyMarket {
        if (amount > lockedAssets) revert InsufficientLocked();
        lockedAssets -= amount;
        emit Released(amount, lockedAssets);
    }

    /// @notice pay a policy holder from locked collateral (payout) or from free assets (refund of premium)
    function pay(address to, uint256 amount, bool isRefund) external onlyMarket nonReentrant {
        if (amount == 0) return;
        if (isRefund) {
            totalRefundsPaid += amount;
        } else {
            if (amount > lockedAssets) revert InsufficientLocked();
            lockedAssets -= amount;
            totalPayoutsPaid += amount;
        }
        IERC20(asset()).safeTransfer(to, amount);
        emit Paid(to, amount, isRefund);
    }

    /// @notice account a premium that the market transferred into the vault
    function notePremium(address from, uint256 amount) external onlyMarket {
        totalPremiumsReceived += amount;
        // premiums raise the floor proportionally so the CPPI floor ratchets with the pool
        floorAssets += amount.mulDiv(floorBps, 10_000);
        emit PremiumReceived(from, amount);
    }

    // ------------------------------------------------------------------ admin

    function setMarket(address market_) external onlyOwner {
        market = market_;
        emit MarketSet(market_);
    }

    function setFloorBps(uint16 bps) external onlyOwner {
        require(bps <= 9_000, "floor too high");
        floorBps = bps;
        emit FloorBpsSet(bps);
    }

    /// @notice re-anchor the floor at floorBps of current assets (call at the start of an epoch)
    function resetFloor() external onlyOwner {
        floorAssets = totalAssets().mulDiv(floorBps, 10_000);
        emit FloorReset(floorAssets);
    }

    function setFloorAssets(uint256 amount) external onlyOwner {
        floorAssets = amount;
        emit FloorReset(amount);
    }

    function setDepositCap(uint256 cap) external onlyOwner {
        depositCap = cap;
        emit DepositCapSet(cap);
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    /// @notice emergency: owner can move any token out (hackathon-only power, documented in the UI)
    function rescue(address token, address to, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(to, amount);
        emit Rescued(token, to, amount);
    }

    /// @notice owner can force-unlock collateral if a policy is stuck (hackathon-only power)
    function adminSetLocked(uint256 amount) external onlyOwner {
        lockedAssets = amount;
    }

    // ------------------------------------------------------------------ flow hooks

    function _deposit(address caller, address receiver, uint256 assets, uint256 shares) internal override whenNotPaused {
        if (totalAssets() + assets > depositCap) revert DepositCapExceeded();
        super._deposit(caller, receiver, assets, shares);
        floorAssets += assets.mulDiv(floorBps, 10_000);
    }

    function _withdraw(address caller, address receiver, address owner_, uint256 assets, uint256 shares)
        internal
        override
        whenNotPaused
        nonReentrant
    {
        require(assets <= freeAssets(), "locked");
        uint256 f = assets.mulDiv(floorBps, 10_000);
        floorAssets = floorAssets > f ? floorAssets - f : 0;
        super._withdraw(caller, receiver, owner_, assets, shares);
    }

    function _decimalsOffset() internal pure override returns (uint8) {
        return 3; // mitigates inflation attacks on a 6-decimal asset
    }
}
