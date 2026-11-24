# FundB testnet deployment using Remix + Trust Wallet

Status: **ready for owner-controlled testnet deployment after final visual checks; not deployed**.

## Verified source and build

- Source: `contracts/FundBToken.sol` on branch `fundb-contract-clean-review`
- Source commit tested: `341bcb75166dac545fe73070c3f611d4b7bd8683`
- GitHub Actions contract workflow run: `45198706971` — completed successfully; compile and all six tests passed.
- Compiler: Solidity `0.8.39`
- EVM target: `osaka`
- Optimizer: enabled, 200 runs
- viaIR: disabled
- OpenZeppelin Contracts: `5.6.1`
- Token name / symbol: `FundB` / `FUNDB`
- Decimals: `18`
- Fixed supply: `10,000,000,000 FUNDB`
- Initial holder (constructor argument): `0x3E020945d3e89ed84F0Fca14e01C9328BC3b67A1`

## Prepare Remix

1. Open the official Remix IDE: https://remix.ethereum.org/
2. Create a new Solidity file named `FundBToken.sol`.
3. Copy the exact contract source from this repository:
   https://github.com/From9292/fundb-mining-website/blob/fundb-contract-clean-review/contracts/FundBToken.sol
4. In the copied file, pin the OpenZeppelin import to the exact dependency version used in the passing build:
   `import {ERC20} from "@openzeppelin/contracts@5.6.1/token/ERC20/ERC20.sol";`
   Do not change any other contract code.
5. In Remix's Solidity Compiler panel select version `0.8.39`, EVM version `osaka`, enable optimizer with `200` runs, and leave viaIR disabled.
6. Compile `FundBToken.sol`. Stop if Remix reports any compiler error or if the settings differ.

## Connect Trust Wallet to BNB Testnet

Use only BNB Smart Chain Testnet (Chapel):

- Network: BSC Testnet
- Chain ID: `97`
- RPC: `https://bsc-testnet-dataseed.bnbchain.org`
- Currency: `tBNB`
- Explorer: https://testnet.bscscan.com/

Get test tBNB only from the official BNB Chain faucet:
https://testnet.bnbchain.org/faucet-smart

In Remix's Deploy & Run panel choose **WalletConnect** to connect Trust Wallet. Approve only the wallet connection first. If using Trust Wallet's in-app DApp browser and it exposes the wallet provider, use the wallet-connected browser environment instead. Do not paste a seed phrase or private key anywhere.

Before deployment, verify all of the following on the wallet connection:
- The selected account is exactly `0x3E020945d3e89ed84F0Fca14e01C9328BC3b67A1`.
- The selected chain is BSC Testnet, chain ID `97`, not BSC Mainnet chain ID `56`.
- The connected wallet has only test tBNB for testnet gas.

## Deploy only after inspecting the transaction

1. In Remix, select contract `FundBToken`.
2. Enter the constructor argument exactly:
   `0x3E020945d3e89ed84F0Fca14e01C9328BC3b67A1`
3. Leave the transaction value at zero.
4. Click Deploy. Read the Trust Wallet request carefully before signing.
5. Reject the request if the wallet shows chain ID 56, a different account, a nonzero transfer value, or any unexpected transaction.
6. Sign only the BSC Testnet deployment request. Wait for a confirmed transaction receipt.

The deploying account and initial token holder should be the same nominated wallet for this rehearsal. The contract has no owner/admin role; the initial holder receives the full fixed supply.

## Verify the deployed test contract

Record the deployed contract address and transaction hash from Remix. Open the address on https://testnet.bscscan.com/ and verify:

- Contract creation transaction is successful.
- `name()` = `FundB`
- `symbol()` = `FUNDB`
- `decimals()` = `18`
- `totalSupply()` = `10000000000000000000000000000`
- `balanceOf(0x3E020945d3e89ed84F0Fca14e01C9328BC3b67A1)` equals the total supply.
- A small test transfer works and total supply does not change.
- The deployed source is verified against the exact compiler and optimizer settings.

Keep the resulting address labelled **TESTNET ONLY**. Do not put it in the live FundB app, announce it as the production token, enable withdrawals, or deploy to mainnet based only on this rehearsal.

## Safety

Never share or upload a wallet recovery phrase or private key. Never use real BNB for this test. A successful testnet deployment is not an independent security audit and does not establish token value, liquidity, user allocations, deposits, or withdrawals. Mainnet requires a separate review and a separate explicit owner signature.
