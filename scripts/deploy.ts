import { network } from "hardhat";

const EXPECTED_CHAIN_ID = 97n;
const EXPECTED_DEPLOYER = "0xcF8294de3Ad14344FDb608360622af579FC15eE6";
const INITIAL_HOLDER = "0xeccfc01cbf7dcbfad98f87485361f70c8080e833";
const EXPECTED_SUPPLY = 10_000_000_000n * 10n ** 18n;

async function main() {
  if (!process.env.BSC_TESTNET_PRIVATE_KEY) {
    throw new Error("Missing BSC_TESTNET_PRIVATE_KEY GitHub Actions secret.");
  }

  const connection = await network.connect();
  const { ethers } = connection;
  const chain = await ethers.provider.getNetwork();
  if (chain.chainId !== EXPECTED_CHAIN_ID) {
    throw new Error(`Wrong network. Expected chain ID 97, received ${chain.chainId}.`);
  }

  const [deployer] = await ethers.getSigners();
  if (!deployer) throw new Error("No deployment signer is configured.");
  const actualDeployer = ethers.getAddress(deployer.address);
  const expectedDeployer = ethers.getAddress(EXPECTED_DEPLOYER);
  if (actualDeployer !== expectedDeployer) {
    throw new Error(`Wrong deployment wallet. Expected ${expectedDeployer}, received ${actualDeployer}. Refusing to deploy.`);
  }

  const balance = await ethers.provider.getBalance(deployer.address);
  if (balance === 0n) throw new Error("Deployment wallet has no testnet tBNB for gas.");

  console.log("Verified chain ID:", chain.chainId.toString());
  console.log("Verified deployment wallet:", actualDeployer);
  console.log("Initial token holder:", INITIAL_HOLDER);
  console.log("Deployer testnet balance:", ethers.formatEther(balance), "tBNB");

  const token = await ethers.deployContract("FundBToken", [INITIAL_HOLDER]);
  const deploymentReceipt = await token.deploymentTransaction()?.wait();
  if (!deploymentReceipt || deploymentReceipt.status !== 1) {
    throw new Error("Deployment transaction was not confirmed successfully.");
  }
  await token.waitForDeployment();

  const contractAddress = await token.getAddress();
  const [name, symbol, decimals, totalSupply, holderBalance] = await Promise.all([
    token.name(), token.symbol(), token.decimals(), token.totalSupply(), token.balanceOf(INITIAL_HOLDER)
  ]);
  if (name !== "FundB" || symbol !== "FUNDB" || decimals !== 18n || totalSupply !== EXPECTED_SUPPLY || holderBalance !== EXPECTED_SUPPLY) {
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
  console.log("Transaction hash:", deploymentReceipt.hash);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
