# FundB BNB Smart Chain testnet deployment checklist

Status: **preparation only — no testnet or mainnet deployment has been made**.

## Verified contract build settings

- Contract: `contracts/FundBToken.sol`
- Name / symbol: `FundB` / `FUNDB`
- Fixed supply: `10,000,000,000 FUNDB`
- Decimals: `18`
- Initial holder: `0x3E020945d3e89ed84F0Fca14e01C9328BC3b67A1`
- Solidity compiler: `0.8.39`
- EVM target: `osaka`
- Optimizer: enabled, 200 runs
- IR pipeline: disabled
- OpenZeppelin Contracts: exact dependency `5.6.1`

## Testnet network details

Use BNB Smart Chain Testnet (Chapel), never mainnet for this rehearsal:

- Network name: BSC Testnet
- Chain ID: `97`
- Currency: `tBNB` (test BNB; no real monetary value)
- Official RPC: `https://bsc-testnet-dataseed.bnbchain.org`
- Official explorer: `https://testnet.bscscan.com/`
- Official faucet instructions: `https://docs.bnbchain.org/docs/bsc-faucet/`

Network and faucet details are from the BNB Chain developer documentation. Confirm the wallet shows chain ID 97 before signing any deployment transaction.

## Deployment safety checklist

1. Confirm the connected wallet address exactly matches the intended initial holder above.
2. Confirm the wallet is on BSC Testnet (chain ID 97), not BSC Mainnet (56).
3. Obtain only test tBNB from the official faucet; never send real BNB to a faucet.
4. Compile the exact committed source using the settings listed above.
5. Deploy with the constructor argument set to the intended initial-holder address.
6. Before signing, inspect the wallet prompt: it must be a contract deployment on BSC Testnet. Reject it if the network, recipient/constructor, or transaction details differ.
7. After deployment, record the test contract address and transaction hash from the confirmed receipt.
8. On the testnet explorer, confirm the contract is deployed and verify:
   - `name()` returns `FundB`
   - `symbol()` returns `FUNDB`
   - `decimals()` returns `18`
   - `totalSupply()` equals `10000000000 × 10^18`
   - the intended holder's balance equals the full supply
   - ordinary transfers work and do not change total supply
   - no owner, mint, pause, blacklist, tax, proxy, or upgrade controls exist
9. Keep the test address clearly labelled TESTNET. Never publish it as the production token address.

## Mainnet gate

Testnet success does not authorize mainnet deployment. Mainnet remains blocked until the exact release commit is reviewed independently, the deployment transaction and constructor arguments are rehearsed, the token allocation and legal disclosures are approved, and the owner personally signs the BSC Mainnet transaction from the intended wallet. Never share a seed phrase or private key with anyone or store it in GitHub, a browser page, this repository, or chat.

## Important product boundary

A deployed token does not create app user balances, deposits, swaps, liquidity, or withdrawals. Those features remain disabled until a separate server-authoritative ledger, custody/signing design where applicable, chain monitoring, reconciliation, and end-to-end security testing are complete.
