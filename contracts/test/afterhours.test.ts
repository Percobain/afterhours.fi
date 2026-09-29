import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";

const USD = (n: number) => BigInt(Math.round(n * 1e6));
const PX = (n: number) => BigInt(Math.round(n * 1e8));

describe("afterhours.fi", () => {
  async function setup() {
    const [owner, quoter, hermee, kip, other] = await ethers.getSigners();
    const Mock = await ethers.getContractFactory("MockERC20");
    const usdt = await Mock.deploy("Test USDT", "USDT", 6, USD(10_000), owner.address);
    const nvdab = await Mock.deploy("NVIDIA bStock", "NVDAB", 18, ethers.parseEther("100"), owner.address);
    const Oracle = await ethers.getContractFactory("ReferenceOracle");
    const oracle = await Oracle.deploy(owner.address);
    const Vault = await ethers.getContractFactory("KeeperVault");
    const vault = await Vault.deploy(await usdt.getAddress(), owner.address);
    const Market = await ethers.getContractFactory("CoverMarket");
    const market = await Market.deploy(await usdt.getAddress(), await vault.getAddress(), await oracle.getAddress(), quoter.address, owner.address);
    await vault.setMarket(await market.getAddress());
    await market.setTokenAllowed(await nvdab.getAddress(), true);
    await oracle.setKeeper(quoter.address, true);
    await oracle.setLastPrice(await nvdab.getAddress(), PX(200));

    // Kip funds the vault with $100k
    await usdt.mint(kip.address, USD(100_000));
    await usdt.connect(kip).approve(await vault.getAddress(), USD(100_000));
    await vault.connect(kip).deposit(USD(100_000), kip.address);

    // Hermee holds 50 NVDAB (= $10k at $200) and some USDT for premiums
    await nvdab.mint(hermee.address, ethers.parseEther("50"));
    await usdt.mint(hermee.address, USD(1_000));
    await usdt.connect(hermee).approve(await market.getAddress(), USD(1_000));

    const now = await time.latest();
    const epochId = BigInt(now + 3600); // "Friday close" one hour from now
    await market.openEpoch(epochId, epochId, epochId + 65n * 3600n);

    const domain = { name: "afterhours.fi CoverMarket", version: "1", chainId: (await ethers.provider.getNetwork()).chainId, verifyingContract: await market.getAddress() };
    const types = { Quote: [
      { name: "buyer", type: "address" }, { name: "token", type: "address" }, { name: "epochId", type: "uint64" },
      { name: "notionalUsd", type: "uint256" }, { name: "barrierBps", type: "uint16" }, { name: "premiumUsd", type: "uint256" },
      { name: "expiry", type: "uint64" }, { name: "nonce", type: "uint256" } ] };
    let nonce = 1;
    const signQuote = async (over: Partial<any> = {}) => {
      const q = { buyer: hermee.address, token: await nvdab.getAddress(), epochId, notionalUsd: USD(10_000), barrierBps: 300, premiumUsd: USD(6), expiry: BigInt(now + 1800), nonce: BigInt(nonce++), ...over };
      const sig = await quoter.signTypedData(domain, types, q);
      return { q, sig };
    };
    return { owner, quoter, hermee, kip, other, usdt, nvdab, oracle, vault, market, epochId, signQuote, domain, types };
  }

  it("sells a floor, locks max payout, pays premium into the vault", async () => {
    const { hermee, market, vault, usdt, signQuote } = await setup();
    const { q, sig } = await signQuote();
    const capBefore = await market.capacityNotional();
    await expect(market.connect(hermee).buyCover(q, sig)).to.emit(market, "CoverBought");
    expect(await vault.lockedAssets()).to.equal(USD(2_000)); // 20% cap of $10k
    expect(await usdt.balanceOf(await vault.getAddress())).to.equal(USD(100_006));
    expect(await market.capacityNotional()).to.be.lt(capBefore);
    const p = await market.getPolicy(0);
    expect(p.status).to.equal(1n);
  });

  it("rejects a quote not signed by the quoter, an expired quote, a reused nonce, and purchases after the bell", async () => {
    const { hermee, other, market, signQuote, domain, types, epochId } = await setup();
    const { q, sig } = await signQuote();
    const badSig = await other.signTypedData(domain, types, q);
    await expect(market.connect(hermee).buyCover(q, badSig)).to.be.revertedWithCustomError(market, "BadSignature");
    await market.connect(hermee).buyCover(q, sig);
    await expect(market.connect(hermee).buyCover(q, sig)).to.be.revertedWithCustomError(market, "NonceUsed");
    const { q: q2, sig: s2 } = await signQuote({ expiry: BigInt((await time.latest()) - 1) });
    await expect(market.connect(hermee).buyCover(q2, s2)).to.be.revertedWithCustomError(market, "QuoteExpired");
    await time.increaseTo(Number(epochId) + 1);
    const { q: q3, sig: s3 } = await signQuote({ expiry: BigInt((await time.latest()) + 600) });
    await expect(market.connect(hermee).buyCover(q3, s3)).to.be.revertedWithCustomError(market, "EpochClosed");
  });

  it("requires the buyer to hold the position", async () => {
    const { hermee, market, signQuote } = await setup();
    const { q, sig } = await signQuote({ notionalUsd: USD(50_000), premiumUsd: USD(30) }); // needs 250 NVDAB, holds 50
    await expect(market.connect(hermee).buyCover(q, sig)).to.be.revertedWithCustomError(market, "NotHoldingPosition");
  });

  it("never sells more than the cushion can back", async () => {
    const { hermee, market, vault, nvdab, signQuote, owner } = await setup();
    await nvdab.mint(hermee.address, ethers.parseEther("10000"));
    await owner; // silence
    // cushion = 100k - 50% floor = 50k -> capacity = 50k / 20% = $250k notional
    expect(await market.capacityNotional()).to.equal(USD(250_000));
    await market.setParams(2000, 100, 2000, USD(10), USD(10_000_000), false, 10000);
    const { q, sig } = await signQuote({ notionalUsd: USD(260_000), premiumUsd: USD(100) });
    await expect(market.connect(hermee).buyCover(q, sig)).to.be.revertedWithCustomError(vault, "InsufficientCushion");
  });

  it("pays out below the barrier, capped, and releases the rest; LP share value moves accordingly", async () => {
    const { hermee, kip, market, vault, oracle, nvdab, usdt, signQuote, epochId } = await setup();
    const { q, sig } = await signQuote(); // $10k notional, 3% floor, $6 premium
    await market.connect(hermee).buyCover(q, sig);
    await oracle.postClose(await nvdab.getAddress(), epochId, PX(200));
    await expect(market.settle(0)).to.be.revertedWithCustomError(market, "NotSettleable");
    await oracle.postOpen(await nvdab.getAddress(), epochId, PX(175)); // -12.5% gap
    const before = await usdt.balanceOf(hermee.address);
    await expect(market.settle(0)).to.emit(market, "CoverSettled");
    const p = await market.getPolicy(0);
    expect(p.gapBps).to.equal(-1250n);
    expect(p.payoutUsd).to.equal(USD(950)); // (12.5% - 3%) * 10k
    expect((await usdt.balanceOf(hermee.address)) - before).to.equal(USD(950));
    expect(await vault.lockedAssets()).to.equal(0n);
    // Kip's shares are now worth 100,006 - 950
    expect(await vault.convertToAssets(await vault.balanceOf(kip.address))).to.be.closeTo(USD(99_056), 10n);
  });

  it("caps the payout at payoutCapBps on a catastrophic gap", async () => {
    const { hermee, market, oracle, nvdab, signQuote, epochId } = await setup();
    const { q, sig } = await signQuote();
    await market.connect(hermee).buyCover(q, sig);
    await oracle.postClose(await nvdab.getAddress(), epochId, PX(200));
    await oracle.postOpen(await nvdab.getAddress(), epochId, PX(50)); // -75%
    await market.settle(0);
    expect((await market.getPolicy(0)).payoutUsd).to.equal(USD(2_000)); // 20% cap
  });

  it("pays nothing when the floor holds and keeps the premium", async () => {
    const { hermee, market, oracle, nvdab, vault, usdt, signQuote, epochId } = await setup();
    const { q, sig } = await signQuote();
    await market.connect(hermee).buyCover(q, sig);
    await oracle.postClose(await nvdab.getAddress(), epochId, PX(200));
    await oracle.postOpen(await nvdab.getAddress(), epochId, PX(198)); // -1%
    await market.settle(0);
    expect((await market.getPolicy(0)).payoutUsd).to.equal(0n);
    expect(await vault.lockedAssets()).to.equal(0n);
    expect(await usdt.balanceOf(await vault.getAddress())).to.equal(USD(100_006));
  });

  it("refunds the premium when the epoch is voided (corporate action)", async () => {
    const { hermee, market, oracle, nvdab, usdt, signQuote, epochId } = await setup();
    const { q, sig } = await signQuote();
    await market.connect(hermee).buyCover(q, sig);
    await oracle.voidEpoch(await nvdab.getAddress(), epochId, "stock_split");
    const before = await usdt.balanceOf(hermee.address);
    await expect(market.settle(0)).to.emit(market, "CoverRefunded");
    expect((await usdt.balanceOf(hermee.address)) - before).to.equal(USD(6));
    expect((await market.getPolicy(0)).status).to.equal(3n);
  });

  it("LP cannot withdraw locked collateral; can withdraw free assets; admin can pause and rescue", async () => {
    const { hermee, kip, owner, market, vault, usdt, signQuote } = await setup();
    const { q, sig } = await signQuote();
    await market.connect(hermee).buyCover(q, sig);
    expect(await vault.maxWithdraw(kip.address)).to.be.closeTo(USD(98_006), 10n); // 100,006 - 2,000 locked (share rounding)
    await expect(vault.connect(kip).withdraw(USD(99_000), kip.address, kip.address)).to.be.reverted;
    await vault.connect(kip).withdraw(USD(50_000), kip.address, kip.address);
    await vault.pause();
    await expect(vault.connect(kip).withdraw(USD(1), kip.address, kip.address)).to.be.reverted;
    await vault.unpause();
    await vault.rescue(await usdt.getAddress(), owner.address, USD(1_000));
    expect(await usdt.balanceOf(owner.address)).to.equal(USD(1_000));
    await market.pause();
    const { q: q2, sig: s2 } = await signQuote();
    await expect(market.connect(hermee).buyCover(q2, s2)).to.be.reverted;
  });

  it("owner can force-settle and force-refund", async () => {
    const { hermee, market, usdt, signQuote } = await setup();
    const { q, sig } = await signQuote();
    await market.connect(hermee).buyCover(q, sig);
    const { q: q2, sig: s2 } = await signQuote();
    await market.connect(hermee).buyCover(q2, s2);
    const b = await usdt.balanceOf(hermee.address);
    await market.forceSettle(0, -800, USD(500));
    await market.forceRefund(1, "oracle outage");
    expect((await usdt.balanceOf(hermee.address)) - b).to.equal(USD(506));
  });

  describe("coverFor (agent binds on the buyer's behalf after an x402 payment)", () => {
    async function withAgent() {
      const ctx = await setup();
      const [, , , , , agent] = await ethers.getSigners();
      await ctx.usdt.mint(agent.address, USD(1_000));
      await ctx.usdt.connect(agent).approve(await ctx.market.getAddress(), USD(1_000));
      return { ...ctx, agent };
    }

    it("only an authorised binder can bind, and only the owner can authorise", async () => {
      const { agent, other, market, signQuote } = await withAgent();
      const { q, sig } = await signQuote();
      await expect(market.connect(agent).coverFor(q, sig)).to.be.revertedWithCustomError(market, "NotBinder");
      await expect(market.connect(other).setBinder(agent.address, true)).to.be.revertedWithCustomError(market, "OwnableUnauthorizedAccount");
      await expect(market.setBinder(agent.address, true)).to.emit(market, "BinderSet").withArgs(agent.address, true);
      await expect(market.connect(agent).coverFor(q, sig)).to.emit(market, "CoverBoundFor").withArgs(0n, agent.address, q.buyer, q.premiumUsd);
    });

    it("records the policy under the buyer, pulls the premium from the agent, and pays the buyer on settlement", async () => {
      const { agent, hermee, quoter, market, vault, usdt, oracle, nvdab, epochId, signQuote } = await withAgent();
      await market.setBinder(agent.address, true);
      const { q, sig } = await signQuote();
      const agentBefore = await usdt.balanceOf(agent.address);
      const hermeeBefore = await usdt.balanceOf(hermee.address);
      await market.connect(agent).coverFor(q, sig);

      const p = await market.getPolicy(0);
      expect(p.buyer).to.equal(hermee.address);
      expect(await market.policiesOf(hermee.address)).to.deep.equal([0n]);
      expect(await market.policiesOf(agent.address)).to.deep.equal([]);
      expect(agentBefore - (await usdt.balanceOf(agent.address))).to.equal(q.premiumUsd); // agent relayed the premium
      expect(await usdt.balanceOf(hermee.address)).to.equal(hermeeBefore);              // hermee paid off-chain (x402)
      expect(await vault.lockedAssets()).to.equal(USD(2_000));

      // Monday opens -8%: 5% below the 3% line on $10k = $500, paid to Hermee, never to the agent
      const t = await nvdab.getAddress();
      await oracle.connect(quoter).postClose(t, epochId, PX(200));
      await time.increaseTo(Number(epochId) + 65 * 3600);
      await oracle.connect(quoter).postOpen(t, epochId, PX(184));
      await market.settle(0);
      expect((await usdt.balanceOf(hermee.address)) - hermeeBefore).to.equal(USD(500));
      expect(agentBefore - (await usdt.balanceOf(agent.address))).to.equal(q.premiumUsd);
    });

    it("still enforces the buyer's quote, holding and the sale window", async () => {
      const { agent, other, market, signQuote, epochId } = await withAgent();
      await market.setBinder(agent.address, true);
      // quote signed for someone who does not hold NVDAB
      const { q, sig } = await signQuote({ buyer: other.address });
      await expect(market.connect(agent).coverFor(q, sig)).to.be.revertedWithCustomError(market, "NotHoldingPosition");
      // agent cannot re-point a quote at a different buyer: the signature no longer matches
      const { q: q2, sig: s2 } = await signQuote();
      await expect(market.connect(agent).coverFor({ ...q2, buyer: agent.address }, s2)).to.be.revertedWithCustomError(market, "BadSignature");
      await time.increaseTo(Number(epochId) + 1);
      const { q: q3, sig: s3 } = await signQuote({ expiry: BigInt((await time.latest()) + 600) });
      await expect(market.connect(agent).coverFor(q3, s3)).to.be.revertedWithCustomError(market, "EpochClosed");
    });

    it("refunds a voided epoch to the buyer, not the agent", async () => {
      const { agent, hermee, quoter, market, usdt, oracle, nvdab, epochId, signQuote } = await withAgent();
      await market.setBinder(agent.address, true);
      const { q, sig } = await signQuote();
      await market.connect(agent).coverFor(q, sig);
      const hermeeBefore = await usdt.balanceOf(hermee.address);
      await oracle.connect(quoter).voidEpoch(await nvdab.getAddress(), epochId, "stock_split");
      await market.settle(0);
      expect((await usdt.balanceOf(hermee.address)) - hermeeBefore).to.equal(q.premiumUsd);
    });

    it("a revoked binder can no longer bind", async () => {
      const { agent, market, signQuote } = await withAgent();
      await market.setBinder(agent.address, true);
      await market.setBinder(agent.address, false);
      const { q, sig } = await signQuote();
      await expect(market.connect(agent).coverFor(q, sig)).to.be.revertedWithCustomError(market, "NotBinder");
    });
  });
});
