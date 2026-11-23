import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.connect();

describe("FundBToken", function () {
  async function deploy() {
    const [deployer, recipient, outsider] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("FundBToken");
    const token = await Factory.deploy(recipient.address);
    await token.waitForDeployment();
    return { token, deployer, recipient, outsider, Factory };
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
    const { Factory } = await deploy();
    let rejected = false;
    try {
      const invalid = await Factory.deploy(ethers.ZeroAddress);
      await invalid.waitForDeployment();
    } catch {
      rejected = true;
    }
    expect(rejected).to.equal(true);
  });

  it("supports standard transfers and allowance-based transfers", async function () {
    const { token, recipient, outsider } = await deploy();
    const amount = ethers.parseUnits("125", 18);
    await (await token.connect(recipient).transfer(outsider.address, amount)).wait();
    expect(await token.balanceOf(recipient.address)).to.equal(ethers.parseUnits("9999999875", 18));
    expect(await token.balanceOf(outsider.address)).to.equal(amount);

    const allowance = ethers.parseUnits("25", 18);
    await (await token.connect(recipient).approve(outsider.address, allowance)).wait();
    await (await token.connect(outsider).transferFrom(recipient.address, outsider.address, allowance)).wait();
    expect(await token.balanceOf(recipient.address)).to.equal(ethers.parseUnits("9999999850", 18));
    expect(await token.balanceOf(outsider.address)).to.equal(ethers.parseUnits("150", 18));
    expect(await token.allowance(recipient.address, outsider.address)).to.equal(0n);
  });

  it("does not expose privileged mint, owner, or upgrade entry points", async function () {
    const { token } = await deploy();
    const functionNames = token.interface.fragments
      .filter((fragment) => fragment.type === "function")
      .map((fragment) => fragment.name);
    expect(functionNames).not.to.include("mint");
    expect(functionNames).not.to.include("owner");
    expect(functionNames).not.to.include("upgradeTo");
  });

  it("rejects transfers to the zero address", async function () {
    const { token, recipient } = await deploy();
    let rejected = false;
    try {
      await (await token.connect(recipient).transfer(ethers.ZeroAddress, 1n)).wait();
    } catch {
      rejected = true;
    }
    expect(rejected).to.equal(true);
  });
});
