const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("FundBToken", function () {
  const EXPECTED_SUPPLY = 10_000_000_000n * 10n ** 18n;

  async function deploy(holder) {
    const Factory = await ethers.getContractFactory("FundBToken");
    const token = await Factory.deploy(holder);
    await token.waitForDeployment();
    return token;
  }

  it("sets the expected token name and symbol", async function () {
    const [holder] = await ethers.getSigners();
    const token = await deploy(holder.address);
    expect(await token.name()).to.equal("FundB");
    expect(await token.symbol()).to.equal("FUNDB");
    expect(await token.decimals()).to.equal(18n);
  });

  it("mints exactly 10 billion FUNDB once to the configured initial holder", async function () {
    const [holder, other] = await ethers.getSigners();
    const token = await deploy(holder.address);
    expect(await token.totalSupply()).to.equal(EXPECTED_SUPPLY);
    expect(await token.balanceOf(holder.address)).to.equal(EXPECTED_SUPPLY);
    expect(await token.balanceOf(other.address)).to.equal(0n);
    expect(await token.INITIAL_SUPPLY()).to.equal(EXPECTED_SUPPLY);
  });

  it("rejects the zero address as the initial holder", async function () {
    const Factory = await ethers.getContractFactory("FundBToken");
    await expect(Factory.deploy(ethers.ZeroAddress))
      .to.be.revertedWithCustomError(Factory, "InvalidInitialHolder");
  });

  it("allows standard ERC-20 transfers without changing total supply", async function () {
    const [holder, recipient] = await ethers.getSigners();
    const token = await deploy(holder.address);
    const amount = ethers.parseUnits("1250", 18);
    await expect(token.transfer(recipient.address, amount))
      .to.emit(token, "Transfer")
      .withArgs(holder.address, recipient.address, amount);
    expect(await token.balanceOf(recipient.address)).to.equal(amount);
    expect(await token.totalSupply()).to.equal(EXPECTED_SUPPLY);
  });

  it("does not expose owner, mint, pause, blacklist, or upgrade administration", async function () {
    const [holder] = await ethers.getSigners();
    const token = await deploy(holder.address);
    for (const method of ["owner", "mint", "pause", "unpause", "blacklist", "upgradeTo"]) {
      expect(token.interface.hasFunction(method), method + " must not exist").to.equal(false);
    }
  });
});
