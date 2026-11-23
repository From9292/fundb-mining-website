# FundB wallet implementation status

Status: **preparation only — no contract has been deployed and no wallet feature is active**.

## Contract parameters in this review branch
- BNB Smart Chain target: chain ID 56 for a future mainnet release; testnet rehearsal uses chain ID 97
- BEP-20-compatible ERC-20 implementation
- Name: FundB; symbol: FUNDB
- Decimals: 18
- Fixed supply: 10,000,000,000 FUNDB
- Initial recipient: constructor argument; deployment checklist specifies the project wallet and requires a visual address match before signing
- OpenZeppelin Contracts pinned to 5.6.1
- Solidity compiler pinned to 0.8.39; EVM target Osaka; optimizer enabled (200 runs); IR pipeline disabled
- No owner, post-deployment mint, proxy, upgrade, blacklist, tax, or pause function

## Automated tests included
Metadata and decimals, exact supply, initial recipient, zero-address rejection, standard transfers and allowances, and absence of privileged mint/owner/upgrade entry points.

## Not implemented or activated
No contract address, deployment transaction, wallet key management, deposit address issuance, BNB/USDT deposit watcher, confirmation/reorg handling, withdrawal signer, internal double-entry ledger, swap router, liquidity, or payout reconciliation is included in this change. Do not display a fake address or enable wallet actions.

## Required before testnet deployment
1. Confirm the GitHub Actions compile and test workflow succeeds.
2. Confirm the compiler version, Osaka EVM target, optimizer settings, exact source commit, and constructor recipient.
3. Deploy only to BNB Smart Chain Testnet (chain ID 97) after the owner personally checks the Trust Wallet prompt.
4. Verify the testnet contract address, transaction hash, metadata, decimals, total supply, initial holder balance, and transfer behavior on the testnet explorer.
5. Keep the testnet address clearly labelled TESTNET; never present it as a production token address.

## Required before mainnet
1. Run Solidity static analysis and obtain an independent smart-contract security review.
2. Review legal, tax, token distribution, custody, sanctions, and consumer-protection obligations for each launch jurisdiction.
3. Decide and document token distribution and initial-holder controls. Fixed supply does not itself allocate tokens to users or promise value.
4. Deploy only after a separately approved mainnet release, with the owner independently verifying source, compiler settings, constructor recipient, network, and exact transaction.
5. Verify source on BscScan and independently confirm chain ID, token metadata, decimals, total supply, and holder.
6. Build and test deposit monitoring, secure non-custodial wallet connection, server-authoritative ledger, withdrawals, and swaps as separate audited components.

Never request or store seed phrases or private keys in chat, source control, browser storage, or Appwrite.
