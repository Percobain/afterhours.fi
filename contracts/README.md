# afterhours.fi contracts

Solidity 0.8.24, OpenZeppelin 5, Hardhat. Deploys to Ethereum Sepolia and BSC Testnet.

| contract | role |
|---|---|
| `KeeperVault` | ERC-4626 pool over USDT that underwrites weekend floors. Fully collateralised: every open policy locks its maximum payout and `lockedAssets` can never exceed the cushion above the CPPI floor (`floorBps`, default 50%). Premiums flow straight into the vault, so share value carries the P&L. |
| `CoverMarket` | Sells floors against EIP-712 quotes signed by the off-chain pricing engine, enforces the Friday bell (`bindDeadline`), barrier and notional bounds, a holding check and a per-token concentration cap; settles at the Monday-open reference print with a 20% payout cap; refunds on voided epochs. |
| `ReferenceOracle` | Per-share Friday close and Monday open per token and epoch, plus a live `lastPrice`. Owner and whitelisted keepers post; voiding an epoch (corporate action) refunds its policies. |
| `MockERC20` | Testnet USDT (6 decimals) and tokenized-stock stand-ins (18 decimals) with a public `faucet()`. |

Admin powers (hackathon): the deployer owns everything and can pause, change parameters, replace the quoter or market, force-settle or refund, correct prices, and `rescue` any token. These are stated in the UI.

## Commands
```powershell
cd contracts
npm install
copy .env.example .env      # fill DEPLOYER_PRIVATE_KEY (and QUOTER_ADDRESS if the server signs with a different key)
npm test
npm run deploy:sepolia      # writes deployments/sepolia.json and copies it to client/ and server/
npm run deploy:bscTestnet
npm run export-abi          # refreshes shared/abi/*.json
npx hardhat verify --network sepolia <address> <constructor args>
```
The deploy script also seeds the vault with 50,000 test USDT from the deployer, whitelists eight test stock tokens with starting reference prices, and opens the next two weekend epochs.

## Tests
`test/afterhours.test.ts` covers: buying a floor and locking collateral; signature, expiry, nonce and bell checks; the holding requirement; capacity against the cushion; payout below the barrier with the cap and LP share-value impact; catastrophic-gap cap; floor held (no payout); voided-epoch refund; LP withdrawal limits, pause and rescue; owner force-settle and force-refund.

## Live on Ethereum Sepolia (verified)
| contract | address |
|---|---|
| CoverMarket | https://sepolia.etherscan.io/address/0x8f80d31BaF2AbFC91fF4837107871Ed0930B091C#code |
| KeeperVault | https://sepolia.etherscan.io/address/0x3eD15ce2936909016D6767d9D109D839E4E40B52#code |
| ReferenceOracle | https://sepolia.etherscan.io/address/0x0fC24edC4A70A37E8EB5f953132550696d9F18fB#code |
| Test USDT | https://sepolia.etherscan.io/address/0x4513E017E0C77D82e920DAEDD47F653510Bb52c5#code |
| NVDAB (test) | https://sepolia.etherscan.io/address/0x7832f47D5b13255d5F745F83837Bd4ffA8f2a9F4#code |

Full list of test stock tokens and epochs: `deployments/sepolia.json`.

### First live weekend cycle (`npm run e2e:sepolia`, 28 Sep 2026, redeployed as afterhours.fi)
$1,000 of NVDAB, 3% floor, premium $0.60; Friday close $224.50; Monday open $208.79 (-7%); settlement paid **$40.00** ((7% - 3%) x $1,000) and released the $200 lock.
- buy: `0x86352ba361f0b166c54b1b59c6dfc872b498777ac6aeff719711a633c70f2fbd`
- close posted: `0x28e164a0a6c6301f8bfb82eae0984c81e3e92fe65976f62bb879cfad4b72f57e`
- open posted: `0x1ce2d321ab718b0af80d6d0336e93cf642051a27a00fa060d6735b6842bb3528`
- settle + payout: `0x74800fb6d22fa1d6402175e59f7974a49832841139de914ce9cf13390f1b962b`

