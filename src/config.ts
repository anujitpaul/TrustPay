/**
 * wagmi configuration: Arc Mainnet only.
 * Built with Arc Studio — https://studio.arc.io
 */

import { createConfig, fallback, http } from 'wagmi'
import { defineChain } from 'viem'
import { injected, walletConnect } from 'wagmi/connectors'
import { CONTRACT_CONFIG } from '../config/contract'
import { registerChain } from './tracing'

export const arcMainnet = defineChain({
  id: CONTRACT_CONFIG.chainId,
  name: CONTRACT_CONFIG.chainName,
  nativeCurrency: { name: 'USD Coin', symbol: 'USDC', decimals: 18 },
  rpcUrls: { default: { http: [...CONTRACT_CONFIG.rpcUrls] } },
  blockExplorers: { default: { name: 'Arc Explorer', url: CONTRACT_CONFIG.explorerUrl } },
})

for (const url of CONTRACT_CONFIG.rpcUrls) registerChain(arcMainnet.id, url)

/**
 * Primary RPC first, backups only on failure. Each endpoint has a timeout and retries with
 * backoff (including on rate limits) before the next one is tried. Requests made in the
 * same tick are batched into one HTTP call.
 */
const transport = fallback(
  CONTRACT_CONFIG.rpcUrls.map((url) =>
    http(url, {
      timeout: 10_000,
      retryCount: 2,
      retryDelay: 400,
      batch: { wait: 25, batchSize: 50 },
    }),
  ),
  { rank: false, retryCount: 1, retryDelay: 300 },
)

const connectors = [
  injected(),
  ...(CONTRACT_CONFIG.walletConnectProjectId
    ? [
        walletConnect({
          projectId: CONTRACT_CONFIG.walletConnectProjectId,
          showQrModal: false,
          metadata: {
            name: 'TrustPay',
            description: 'Simple USDC payments on Arc Mainnet',
            url: window.location.origin,
            icons: [],
          },
        }),
      ]
    : []),
]

export const config = createConfig({
  chains: [arcMainnet],
  connectors,
  transports: { [arcMainnet.id]: transport },
  // Arc finalizes in under a second, so poll receipts quickly.
  pollingInterval: 1_500,
})
