import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { network } from "hardhat";

const { ethers } = await network.create();

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
    assert.equal(await token.name(), "FundB");
    assert.equal(await token.symbol(), "FUNDB");
    assert.equal(await token.decimals(), 18);
  });

  it("mints exactly 10 billion tokens once to the nominated recipient", async function () {
    const { token, deployer, recipient } = await deploy();
    const supply = ethers.parseUnits("10000000000", 18);
    assert.equal(await token.totalSupply(), supply);
    assert.equal(await token.balanceOf(recipient.address), supply);
    assert.equal(await token.balanceOf(deployer.address), 0n);
  });

  it("rejects a zero initial holder", async function () {
    const { Factory } = await deploy();
    await assert.rejects(
      async () => {
        const invalid = await Factory.deploy(ethers.ZeroAddress);
        await invalid.waitForDeployment();
      }
    );
  });

  it("supports standard transfers and allowance-based transfers", async function () {
    const { token, recipient, outsider } = await deploy();
    const amount = ethers.parseUnits("125", 18);
    await (await token.connect(recipient).transfer(outsider.address, amount)).wait();
    assert.equal(await token.balanceOf(recipient.address), ethers.parseUnits("9999999875", 18));
    assert.equal(await token.balanceOf(outsider.address), amount);

    const allowance = ethers.parseUnits("25", 18);
    await (await token.connect(recipient).approve(outsider.address, allowance)).wait();
    await (await token.connect(outsider).transferFrom(recipient.address, outsider.address, allowance)).wait();
    assert.equal(await token.balanceOf(recipient.address), ethers.parseUnits("9999999850", 18));
    assert.equal(await token.balanceOf(outsider.address), ethers.parseUnits("150", 18));
    assert.equal(await token.allowance(recipient.address, outsider.address), 0n);
  });

  it("does not expose privileged mint, owner, or upgrade entry points", async function () {
    const { token } = await deploy();
    const functionNames = token.interface.fragments
      .filter((fragment) => fragment.type === "function")
      .map((fragment) => fragment.name);
    assert.equal(functionNames.includes("mint"), false);
    assert.equal(functionNames.includes("owner"), false);
    assert.equal(functionNames.includes("upgradeTo"), false);
  });

  it("rejects transfers to the zero address", async function () {
    const { token, recipient } = await deploy();
    await assert.rejects(
      async () => (await token.connect(recipient).transfer(ethers.ZeroAddress, 1n)).wait()
    );
  });
});
