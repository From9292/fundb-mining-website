import { network } from "hardhat";
import { assertInitialHolder, INITIAL_HOLDER } from "./deploy-guards.js";

const EXPECTED_CHAIN_ID = 97n;

async function main() {
  if (!process.env.BSC_TESTNET_PRIVATE_KEY) {
    throw new Error("Missing BSC_TESTNET_PRIVATE_KEY GitHub Actions secret.");
  }

  const connection = await network.create("bscTestnet");
  const { ethers } = connection;
  const chain = await ethers.provider.getNetwork();

  if (chain.chainId !== EXPECTED_CHAIN_ID) {
    throw new Error(`Wrong network. Expected chain ID 97, received ${chain.chainId}.`);
  }
  // ethers.getAddress validates a supplied mixed-case EIP-55 checksum.
  const initialHolder = ethers.getAddress(INITIAL_HOLDER);

  const [deployer] = await ethers.getSigners();
  if (!deployer) throw new Error("No deployment signer is configured.");
  // The deployment signer must be the nominated initial holder, not merely a funded testnet account.
  assertInitialHolder(deployer.address, initialHolder);

  const balance = await ethers.provider.getBalance(deployer.address);
  if (balance === 0n) throw new Error("Deployment wallet has no testnet tBNB for gas.");

  console.log("Verified chain ID:", chain.chainId.toString());
  console.log("Deployment wallet:", deployer.address);
  console.log("Initial token holder:", initialHolder);
  console.log("Deployer testnet balance:", ethers.formatEther(balance), "tBNB");

  const token = await ethers.deployContract("FundBToken", [initialHolder]);
  await token.waitForDeployment();

  const contractAddress = await token.getAddress();
  const [name, symbol, decimals, totalSupply, holderBalance] = await Promise.all([
    token.name(), token.symbol(), token.decimals(), token.totalSupply(), token.balanceOf(initialHolder)
  ]);
  const expectedSupply = 10_000_000_000n * 10n ** 18n;

  if (name !== "FundB" || symbol !== "FUNDB" || decimals !== 18n ||
      totalSupply !== expectedSupply || holderBalance !== expectedSupply) {
    throw new Error("Post-deployment token checks failed. Do not use this deployment.");
  }

  console.log("DEPLOYMENT_SUCCESS");
  console.log("Network: BNB Smart Chain Testnet (97)");
  console.log("Contract address:", contractAddress);
  console.log("Name:", name);
  console.log("Symbol:", symbol);
  console.log("Decimals:", decimals.toString());
  console.log("Total supply:", totalSupply.toString());
  console.log("Initial holder balance:", holderBalance.toString());
  console.log("Transaction hash:", token.deploymentTransaction()?.hash ?? "not available");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
