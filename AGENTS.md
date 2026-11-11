# TrustPay

> Built with Arc Studio - money-powered apps in minutes

This is the **project memory** - what Arc Studio remembers about building this app. It helps future agents (or humans) understand and extend the project.

---

## What This App Does

TrustPay is a simple USDC payment dApp for Arc Mainnet only (chain ID 5042): dashboard, send, receive (QR and payment-request links), history, settings. Arc Testnet is intentionally not configured. The user deploys contracts/TrustPay.sol themselves; Arc Studio never deploys to mainnet.

## Tech Stack

- Frontend: React 18, Vite, TypeScript, Tailwind CSS
- Web3: wagmi v2, viem v2, ConnectKit
- Contracts: Solidity 0.8.28 + Foundry. Sources in `contracts/`, unit tests in `contracts/test/*.t.sol`. Build with `bun run contracts:build` (`forge build`), test with `bun run contracts:test` (`forge test`).
- Wallet: injected (MetaMask, etc.) plus WalletConnect when VITE_WALLETCONNECT_PROJECT_ID is set
- Chain: Arc Mainnet (Chain ID: 5042), defined in `src/config.ts` from `config/contract.ts`
- Token: USDC (6 decimals) (Address: 0x3600000000000000000000000000000000000000, Chain: Arc Mainnet)
- Toasts: Sonner

## Key Files

- `config/contract.ts` - the ONE place for TrustPay address, USDC, RPC URLs (primary + backups), explorer (reads VITE_ env vars)
- `src/App.tsx` - route switch (history-API router in `src/lib/router.tsx`)
- `src/hooks/history.tsx` - real history: scans Arc's system emitter (0xffff...fffE, EIP-7708, 18 decimals) in 9,000-block chunks (RPC rejects ~10,000), cached per wallet in localStorage. Do NOT also count the ERC-20 contract's Transfer logs (double counting).
- `contracts/TrustPay.sol` - non-custodial pay(recipient, amount, note) with PaymentSent event; no owner, no withdrawal. Deploy script `contracts/script/DeployTrustPay.s.sol`, tests `contracts/test/TrustPay.t.sol`.
- `src/components/` - UI components
- `src/config.ts` - wagmi config (Arc Mainnet only, fallback RPC transport with timeout/retry/batching)

## Share links

- Starter apps already ship `getShareBase`, `buildShareLink` and `installShareSync` in `src/lib/share.ts`; import them instead of rewriting them.
- Keep shareable state in the URL path or query, not in the `#fragment`.
- Never put a secret (private key, claim secret, seed phrase, session token, API key) in the URL path or query, encoded or not: every in-app path and query is mirrored to the visitor's studio.arc.io address bar and browser history and reaches servers. A bearer claim secret goes only in the `#fragment` appended to the share link (`` `${await buildShareLink('/claim')}#${secret}` ``) and is read from `location.hash` on load. A link to the app's own share URL shown inside the app must be copy-only or open in a new tab with `target="_blank" rel="noopener noreferrer"`.
- Build every link a user copies or sends with `buildShareLink()` from `src/lib/share.ts`.
- Keep the `installShareSync()` call in `src/main.tsx` when editing it; it keeps the Studio address bar in step with in-app navigation.
- Navigate inside the app with relative links.

## To Run

```bash
bun install
bun run dev
```


## Arc notes

- Native gas is USDC: show ONE balance (ERC-20 view, 6 decimals). Fees are 18-decimal native units.
- Mempool drops maxFeePerGas under 20 gwei; `src/lib/fees.ts` enforces the floor.
- Primary RPC is load-balanced: error -32014 means retry; log queries over ~10,000 blocks fail (measured).
- Deployed contract address: none yet (user deploys; set VITE_TRUSTPAY_CONTRACT_ADDRESS).
