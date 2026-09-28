// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title MockERC20 - testnet stand-in for USDT (6 decimals) and tokenized stocks (18 decimals).
/// @notice Anyone can call `faucet` on testnets; the owner can mint arbitrary amounts.
contract MockERC20 is ERC20, Ownable {
    uint8 private immutable _decimals;
    uint256 public faucetAmount;

    constructor(string memory name_, string memory symbol_, uint8 decimals_, uint256 faucetAmount_, address owner_)
        ERC20(name_, symbol_)
        Ownable(owner_)
    {
        _decimals = decimals_;
        faucetAmount = faucetAmount_;
    }

    function decimals() public view override returns (uint8) {
        return _decimals;
    }

    function faucet() external {
        _mint(msg.sender, faucetAmount);
    }

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    function setFaucetAmount(uint256 amount) external onlyOwner {
        faucetAmount = amount;
    }
}
