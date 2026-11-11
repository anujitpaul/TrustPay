import { useQuery } from '@tanstack/react-query'
import { erc20Abi } from 'viem'
import { usePublicClient } from 'wagmi'
import type { Address } from 'viem'
import { CONTRACT_CONFIG } from '../../config/contract'
import { getFeeParams } from '@/lib/fees'
import { withRetry } from '@/lib/rpc'

/**
 * The single USDC balance, read from the 6-decimal ERC-20 view. On Arc this is the same pool of funds
 * that pays gas, so the native balance is deliberately not shown as a second amount.
 */
export function useUsdcBalance(address: Address | undefined) {
  const client = usePublicClient({ chainId: CONTRACT_CONFIG.chainId })
  return useQuery({
    queryKey: ['usdc-balance', address],
    enabled: Boolean(client && address),
    refetchInterval: 20_000,
    staleTime: 10_000,
    queryFn: async () => {
      if (!client || !address) return 0n
      return withRetry(() =>
        client.readContract({ address: CONTRACT_CONFIG.usdcAddress, abi: erc20Abi, functionName: 'balanceOf', args: [address] }),
      )
    },
  })
}

export function useFeeParams() {
  const client = usePublicClient({ chainId: CONTRACT_CONFIG.chainId })
  return useQuery({
    queryKey: ['fee-params'],
    enabled: Boolean(client),
    refetchInterval: 30_000,
    staleTime: 15_000,
    queryFn: async () => {
      if (!client) throw new Error('No client')
      return getFeeParams(client)
    },
  })
}

export function useChainStatus() {
  const client = usePublicClient({ chainId: CONTRACT_CONFIG.chainId })
  return useQuery({
    queryKey: ['chain-status'],
    enabled: Boolean(client),
    refetchInterval: 15_000,
    staleTime: 10_000,
    retry: 1,
    queryFn: async () => {
      if (!client) throw new Error('No client')
      const started = performance.now()
      const [block, chainId] = await Promise.all([
        withRetry(() => client.getBlockNumber({ cacheTime: 0 })),
        withRetry(() => client.getChainId()),
      ])
      return { block, chainId, latencyMs: Math.round(performance.now() - started) }
    },
  })
}
