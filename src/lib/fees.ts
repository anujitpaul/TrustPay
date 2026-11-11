import type { PublicClient } from 'viem'
import { MIN_MAX_FEE_PER_GAS } from '../../config/contract'
import { withRetry } from './rpc'

export interface FeeParams {
  maxFeePerGas: bigint
  maxPriorityFeePerGas: bigint
}

/**
 * Arc fees are paid in USDC and the mempool silently drops anything under a 20 gwei
 * maxFeePerGas. Use 2x the current base fee, never below that floor. A priority fee is not needed.
 */
export async function getFeeParams(client: PublicClient): Promise<FeeParams> {
  const block = await withRetry(() => client.getBlock({ blockTag: 'latest' }))
  const doubled = (block.baseFeePerGas ?? 0n) * 2n
  return {
    maxFeePerGas: doubled > MIN_MAX_FEE_PER_GAS ? doubled : MIN_MAX_FEE_PER_GAS,
    maxPriorityFeePerGas: 0n,
  }
}

/** Gas units reserved when the user taps Max (covers an approval plus a payment). */
export const MAX_RESERVE_GAS = 300_000n
