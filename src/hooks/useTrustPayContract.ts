import { useQuery } from '@tanstack/react-query'
import { isAddressEqual } from 'viem'
import { usePublicClient } from 'wagmi'
import { CONTRACT_CONFIG } from '../../config/contract'
import { DEFAULT_MAX_NOTE_BYTES, trustPayAbi } from '@/lib/abi'
import { withRetry } from '@/lib/rpc'

export type TrustPayStatus =
  | { state: 'unset' }
  | { state: 'checking' }
  | { state: 'invalid'; reason: string }
  | { state: 'ready'; maxNoteBytes: number }

/**
 * Checks that the configured TrustPay address really is a TrustPay contract for the configured USDC
 * token. Until it is verified, payments go straight through USDC and the contract path stays off.
 */
export function useTrustPayContract(): TrustPayStatus & { address?: `0x${string}` } {
  const client = usePublicClient({ chainId: CONTRACT_CONFIG.chainId })
  const address = CONTRACT_CONFIG.trustPayAddress

  const query = useQuery({
    queryKey: ['trustpay-contract', address],
    enabled: Boolean(client && address),
    staleTime: 5 * 60_000,
    retry: 1,
    queryFn: async (): Promise<TrustPayStatus> => {
      if (!client || !address) return { state: 'unset' }
      const code = await withRetry(() => client.getCode({ address }))
      if (!code || code === '0x') return { state: 'invalid', reason: 'No contract code at the configured address on Arc Mainnet.' }
      try {
        const [token, maxNote] = await Promise.all([
          withRetry(() => client.readContract({ address, abi: trustPayAbi, functionName: 'usdc' })),
          withRetry(() => client.readContract({ address, abi: trustPayAbi, functionName: 'MAX_NOTE_LENGTH' })),
        ])
        if (!isAddressEqual(token, CONTRACT_CONFIG.usdcAddress)) {
          return { state: 'invalid', reason: 'The contract is configured for a different USDC token.' }
        }
        return { state: 'ready', maxNoteBytes: Number(maxNote) }
      } catch {
        return { state: 'invalid', reason: 'The address does not look like a TrustPay contract.' }
      }
    },
  })

  if (!address) return { state: 'unset' }
  if (query.isPending) return { state: 'checking', address }
  if (query.isError) return { state: 'invalid', reason: 'Could not verify the contract. Check your connection.', address }
  return { ...query.data, address }
}

export { DEFAULT_MAX_NOTE_BYTES }
