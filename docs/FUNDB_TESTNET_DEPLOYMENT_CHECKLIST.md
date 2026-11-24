# FundB BNB Smart Chain testnet deployment checklist

Status: **corrected recipient prepared on branch; awaiting review and a separate deployment approval**.

## Verified contract build settings

- Contract: `contracts/FundBToken.sol`
- Name / symbol: `FundB` / `FUNDB`
- Fixed supply: `10,000,000,000 FUNDB`
- Decimals: `18`
- Intended initial holder: `0xeccfc01cbf7dcbfad98f87485361f70c8080e833`
- Solidity compiler: `0.8.39`
- EVM target: `osaka`
- Optimizer: enabled, 200 runs
- IR pipeline: disabled
- OpenZeppelin Contracts: exact dependency `5.6.1`

## Testnet network details

Use BNB Smart Chain Testnet (Chapel), never mainnet:
- Network name: BSC Testnet
- Chain ID: `97`
- Currency: `tBNB` (test BNB; no real monetary value)
- RPC: `https://bsc-testnet-dataseed.bnbchain.org`
- Explorer: `https://testnet.bscscan.com/`

## Deployment safety checklist

1. Confirm the deployment signer is the preconfigured testnet deployment wallet; never expose its private key.
2. Confirm BSC Testnet (chain ID 97), not BSC Mainnet (56).
3. Compile and run all tests from the reviewed branch.
4. Inspect the deployment script and confirm its constructor argument is exactly `0xeccfc01cbf7dcbfad98f87485361f70c8080e833`.
5. Obtain only test tBNB for gas.
6. Deploy only after the owner explicitly approves the separate testnet deployment action.
7. Record the new contract address and transaction hash from the confirmed receipt.
8. Verify on the testnet explorer: metadata, 18 decimals, total supply `10000000000 × 10^18`, and full initial balance at `0xeccfc01cbf7dcbfad98f87485361f70c8080e833`.
9. Keep the old testnet contract labelled superseded; do not represent either testnet contract as a mainnet token.

## Important impact

A new deployment creates a different testnet contract. It does not alter or delete the earlier contract at `0x84d9AcdF08f54d23361b68881B768136268A320E`, and it does not change the FundB website, Appwrite accounts, points, or referral records. The earlier contract remains on-chain with its original initial-holder allocation.

Mainnet deployment is not authorized by this checklist. Never share a seed phrase or private key in chat, GitHub source, or a website.

## Product boundary

A token contract alone does not create app user balances, deposits, swaps, liquidity, or withdrawals. Those require separate backend and security work.
