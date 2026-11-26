const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("FundBToken", function () {
  async function deploy() {
    const [deployer, recipient, outsider] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("FundBToken");
    const token = await Factory.deploy(recipient.address);
    await token.waitForDeployment();
    return { token, deployer, recipient, outsider };
  }

  it("sets the expected token metadata and 18 decimals", async function () {
    const { token } = await deploy();
    expect(await token.name()).to.equal("FundB");
    expect(await token.symbol()).to.equal("FUNDB");
    expect(await token.decimals()).to.equal(18);
  });

  it("mints exactly 10 billion tokens once to the nominated recipient", async function () {
    const { token, deployer, recipient } = await deploy();
    const supply = ethers.parseUnits("10000000000", 18);
    expect(await token.totalSupply()).to.equal(supply);
    expect(await token.balanceOf(recipient.address)).to.equal(supply);
    expect(await token.balanceOf(deployer.address)).to.equal(0n);
  });

  it("rejects a zero initial holder", async function () {
    const Factory = await ethers.getContractFactory("FundBToken");
    await expect(Factory.deploy(ethers.ZeroAddress))
      .to.be.revertedWithCustomError(Factory, "InvalidInitialHolder");
  });

  it("supports standard transfers and allowance-based transfers", async function () {
    const { token, recipient, outsider } = await deploy();
    const amount = ethers.parseUnits("125", 18);
    await expect(token.connect(recipient).transfer(outsider.address, amount))
      .to.changeTokenBalances(token, [recipient, outsider], [-amount, amount]);

    const allowance = ethers.parseUnits("25", 18);
    await token.connect(recipient).approve(outsider.address, allowance);
    await expect(token.connect(outsider).transferFrom(recipient.address, outsider.address, allowance))
      .to.changeTokenBalances(token, [recipient, outsider], [-allowance, allowance]);
  });

  it("does not expose privileged mint, owner, or upgrade entry points", async function () {
    const { token } = await deploy();
    expect(token.mint).to.equal(undefined);
    expect(token.owner).to.equal(undefined);
    expect(token.upgradeTo).to.equal(undefined);
  });

  it("rejects transfers to the zero address", async function () {
    const { token, recipient } = await deploy();
    await expect(token.connect(recipient).transfer(ethers.ZeroAddress, 1n))
      .to.be.revertedWithCustomError(token, "ERC20InvalidReceiver");
  });
});
