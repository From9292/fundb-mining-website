# FundB wallet implementation status

This repository change adds a proposed fixed-supply token contract and automated tests. It does **not** deploy the contract or activate a wallet.

## Contract parameters
- BNB Smart Chain mainnet target: chain ID 56
- BEP-20-compatible ERC-20 implementation
- Name: FundB; symbol: FUNDB
- Decimals: 18
- Fixed supply: 10,000,000,000 FUNDB
- Initial recipient: explicitly supplied at deployment; zero address rejected
- OpenZeppelin Contracts pinned to 5.1.0
- Solidity compiler pinned to 0.8.24; optimizer enabled (200 runs)
- No owner, post-deployment mint, proxy, upgrade, blacklist, tax, or pause function

## What the tests cover
Metadata and decimals, exact supply, initial recipient, zero-address rejection, standard transfers and allowances, and absence of privileged mint/owner/upgrade entry points.

## Not implemented or activated
No contract address, deployment transaction, wallet key management, deposit address issuance, BNB/USDT deposit watcher, confirmation/reorg handling, withdrawal signer, internal double-entry ledger, swap router, liquidity, or payout reconciliation is included in this change. Do not display a fake address or enable wallet actions.

## Required before mainnet
1. Generate and commit a reproducible dependency lockfile; install and test using a clean environment.
2. Run the automated CI workflow and inspect its full logs.
3. Run Solidity static analysis and an independent smart-contract audit.
4. Review legal, tax, token distribution, custody, sanctions, and consumer-protection obligations for each launch jurisdiction.
5. Decide and document the token distribution and initial-holder controls. The fixed supply does not itself allocate tokens to users or promise value.
6. Deploy only from a project-owner-controlled wallet after the owner independently verifies source, compiler settings, constructor recipient, and exact transaction.
7. Verify source on BscScan and independently confirm chain ID, token metadata, decimals, total supply, and holder.
8. Build and test deposit monitoring, secure non-custodial wallet connection, server-authoritative ledger, withdrawals, and swaps as separate audited components.

Never request or store seed phrases or private keys in chat, source control, browser storage, or Appwrite.
