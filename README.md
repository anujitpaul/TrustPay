# TrustPay

A simple, fast USDC payment app for Arc Mainnet (chain ID 5042). Connect a wallet, see your balance, send and receive USDC, share payment request links and QR codes, and browse your real payment history.

Built with [Arc Studio](https://studio.arc.io)

## Features

- Dashboard with your USDC balance, totals, recent payments and live network status
- Send USDC with address and amount checks, a fee estimate and a review step before you confirm
- Receive with a QR code and shareable payment request links
- History of payments sent and received, with filters and Arc Explorer links
- Automatic switch to Arc Mainnet, with backup RPC endpoints if the primary one fails
- Optional TrustPay contract that adds public payment notes. Without it, payments are plain USDC transfers.

TrustPay never asks for or stores a private key or seed phrase.

## Tech stack

React, Vite, TypeScript, Tailwind CSS, wagmi, viem, ConnectKit, Solidity 0.8.28 and Foundry.

## Development

Prerequisites: [Bun](https://bun.sh) and [Foundry](https://book.getfoundry.sh).

```bash
bun install
bun run dev          # start the app
bun run build        # type check and production build
bun run check        # lint and type check
bun run contracts:build
bun run contracts:test
```

### Configuration

Copy `.env.example` to `.env`. All values are public (Vite ships `VITE_` variables to the browser), so never put a secret in them. The app reads them through `config/contract.ts`.

| Variable | Purpose |
| --- | --- |
| `VITE_TRUSTPAY_CONTRACT_ADDRESS` | Address of your deployed TrustPay contract. Leave empty until deployed. |
| `VITE_USDC_ADDRESS` | Optional USDC token override. Defaults to Arc USDC. |
| `VITE_ARC_RPC_URL` | Optional primary RPC override. |
| `VITE_ARC_BACKUP_RPC_URLS` | Optional comma-separated backup RPC URLs. |
| `VITE_ARC_EXPLORER_URL` | Optional explorer override. |
| `VITE_WALLETCONNECT_PROJECT_ID` | Optional. Enables WalletConnect. Get an ID at cloud.walletconnect.com. |

### Deploying the contract yourself

The contract is `contracts/TrustPay.sol`. You deploy it from your own wallet; the repository contains no keys.

```bash
forge script contracts/script/DeployTrustPay.s.sol:DeployTrustPay \
  --rpc-url https://rpc.mainnet.arc.io --account <your-keystore-name> --broadcast
```

Then set `VITE_TRUSTPAY_CONTRACT_ADDRESS` in `.env` and restart the dev server. No UI change is needed. Review and test everything, and get an independent audit, before using real funds.
