# FundB testnet deployment using Remix + Trust Wallet

Status: **superseded guide; use the corrected automated deployment workflow instead**.

The previous Remix instructions used an earlier initial-holder address and must not be followed. The corrected intended initial holder is:

`0xeccfc01cbf7dcbfad98f87485361f70c8080e833`

The previous testnet contract at `0x84d9AcdF08f54d23361b68881B768136268A320E` remains deployed with its original allocation. It cannot be edited to change its initial holder. A corrected deployment creates a new testnet contract address.

Use the reviewed branch and automated GitHub Actions workflow only after the corrected recipient change has been reviewed and the owner separately authorizes deployment. Network must remain BNB Smart Chain Testnet, chain ID 97. Never deploy to mainnet as part of this correction, and never share wallet recovery phrases or private keys.
