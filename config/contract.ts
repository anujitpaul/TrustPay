/**
 * TrustPay deployment configuration (Arc Mainnet only).
 *
 * This is the one file to edit after you deploy the TrustPay contract. The UI reads
 * everything from here, so no component changes when an address changes.
 *
 * Preferred: set the values in `.env` (see `.env.example`). Vite exposes only
 * `VITE_`-prefixed variables to the browser, so never put a secret in them.
 *
 *   VITE_TRUSTPAY_CONTRACT_ADDRESS   TrustPay contract address (leave empty until deployed)
 *   VITE_USDC_ADDRESS                USDC token address override (defaults to Arc USDC)
 *   VITE_ARC_RPC_URL                 Primary RPC override
 *   VITE_ARC_BACKUP_RPC_URLS         Comma-separated backup RPC URLs
 *   VITE_ARC_EXPLORER_URL            Explorer base URL override
 *   VITE_WALLETCONNECT_PROJECT_ID    WalletConnect project ID (enables WalletConnect)
 */

import { getAddress, isAddress, type Address } from 'viem'
import { getUsdc, requireChain } from '../src/onchain-facts'

/** Arc Mainnet. TrustPay is built for this network only. */
export const ARC_MAINNET_CHAIN_ID = 5042

const arc = requireChain(ARC_MAINNET_CHAIN_ID)
const arcUsdc = getUsdc(ARC_MAINNET_CHAIN_ID)

if (!arcUsdc) {
  throw new Error('USDC is missing for Arc Mainnet in the onchain facts registry')
}

const env = import.meta.env as Record<string, string | undefined>

function cleanUrl(value: string | undefined): string | undefined {
  const trimmed = value?.trim().replace(/\/+$/, '')
  if (!trimmed) return undefined
  try {
    const url = new URL(trimmed)
    return url.protocol === 'https:' ? trimmed : undefined
  } catch {
    return undefined
  }
}

function cleanAddress(value: string | undefined): Address | undefined {
  const trimmed = value?.trim()
  if (!trimmed || !isAddress(trimmed, { strict: false })) return undefined
  return getAddress(trimmed)
}

function unique(urls: (string | undefined)[]): string[] {
  return [...new Set(urls.filter((url): url is string => Boolean(url)))]
}

/**
 * Backup RPC providers listed in the Arc docs (docs.arc.io/arc/references/rpc-endpoints).
 * They are used only when the primary endpoint fails or is rate limited.
 */
const DEFAULT_BACKUP_RPC_URLS = [
  'https://rpc.blockdaemon.mainnet.arc.io',
  'https://rpc.drpc.mainnet.arc.io',
  'https://rpc.quicknode.mainnet.arc.io',
]

const primaryRpcUrl = cleanUrl(env.VITE_ARC_RPC_URL) ?? arc.rpcUrls[0]

const configuredBackups = (env.VITE_ARC_BACKUP_RPC_URLS ?? '')
  .split(',')
  .map((url) => cleanUrl(url))

export const CONTRACT_CONFIG = {
  chainId: ARC_MAINNET_CHAIN_ID,
  chainName: 'Arc Mainnet',
  /** Primary RPC first, then backups in priority order. */
  rpcUrls: unique([primaryRpcUrl, ...configuredBackups, ...DEFAULT_BACKUP_RPC_URLS]),
  explorerUrl: cleanUrl(env.VITE_ARC_EXPLORER_URL) ?? arc.explorerBase,
  /** ERC-20 view of USDC (6 decimals). Native gas is the same USDC at 18 decimals. */
  usdcAddress: cleanAddress(env.VITE_USDC_ADDRESS) ?? getAddress(arcUsdc.address),
  /** Set after deploying `contracts/TrustPay.sol`. Undefined means payments go straight through USDC. */
  trustPayAddress: cleanAddress(env.VITE_TRUSTPAY_CONTRACT_ADDRESS),
  walletConnectProjectId: env.VITE_WALLETCONNECT_PROJECT_ID?.trim() || undefined,
} as const

/** Arc's system emitter logs every USDC movement (native and ERC-20) at 18 decimals (EIP-7708). */
export const ARC_SYSTEM_EMITTER: Address = '0xffffFFFfFFffffffffffffffFfFFFfffFFFfFFfE'

/** Arc's mempool silently drops transactions with maxFeePerGas below 20 gwei. */
export const MIN_MAX_FEE_PER_GAS = 20_000_000_000n

export function explorerTxUrl(hash: string): string {
  return `${CONTRACT_CONFIG.explorerUrl}/tx/${hash}`
}

export function explorerAddressUrl(address: string): string {
  return `${CONTRACT_CONFIG.explorerUrl}/address/${address}`
}
