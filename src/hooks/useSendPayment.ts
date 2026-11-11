import { useCallback, useState } from 'react'
import { erc20Abi, type Address, type Hex } from 'viem'
import { useAccount, usePublicClient, useSwitchChain, useWriteContract } from 'wagmi'
import { CONTRACT_CONFIG } from '../../config/contract'
import { trustPayAbi } from '@/lib/abi'
import { isUserRejection, parseOnchainError } from '@/lib/errors'
import { getFeeParams } from '@/lib/fees'
import { withRetry } from '@/lib/rpc'
import { requestHistoryRefresh } from '@/hooks/history'

export type SendPhase =
  | 'idle'
  | 'switching'
  | 'approve-wallet'
  | 'approve-confirming'
  | 'pay-wallet'
  | 'pay-confirming'
  | 'success'
  | 'failed'

export interface SendState {
  phase: SendPhase
  approvalHash?: Hex
  hash?: Hex
  error?: string
  /** True when the transaction was submitted but not confirmed within the wait window. */
  unconfirmed?: boolean
}

export interface SendRequest {
  to: Address
  /** 6-decimal ERC-20 USDC amount. */
  amount: bigint
  note: string
  /** Route through the TrustPay contract (records the note) instead of a plain USDC transfer. */
  useContract: boolean
}

const RECEIPT_TIMEOUT_MS = 90_000

export function useSendPayment() {
  const { address } = useAccount()
  const client = usePublicClient({ chainId: CONTRACT_CONFIG.chainId })
  const { switchChainAsync } = useSwitchChain()
  const { writeContractAsync } = useWriteContract()
  const [state, setState] = useState<SendState>({ phase: 'idle' })

  const reset = useCallback(() => setState({ phase: 'idle' }), [])

  const send = useCallback(
    async ({ to, amount, note, useContract }: SendRequest) => {
      if (!client || !address) return
      const trustPay = CONTRACT_CONFIG.trustPayAddress
      let approvalHash: Hex | undefined
      let hash: Hex | undefined

      const waitFor = async (txHash: Hex) => {
        const receipt = await client.waitForTransactionReceipt({ hash: txHash, timeout: RECEIPT_TIMEOUT_MS })
        if (receipt.status !== 'success') throw new Error('reverted')
        return receipt
      }

      try {
        setState({ phase: 'switching' })
        await switchChainAsync({ chainId: CONTRACT_CONFIG.chainId })

        const fees = await getFeeParams(client)

        if (useContract) {
          if (!trustPay) throw new Error('TrustPay contract is not configured')
          const allowance = await withRetry(() =>
            client.readContract({
              address: CONTRACT_CONFIG.usdcAddress,
              abi: erc20Abi,
              functionName: 'allowance',
              args: [address, trustPay],
            }),
          )
          if (allowance < amount) {
            setState({ phase: 'approve-wallet' })
            // Approve exactly this payment, never an unlimited allowance.
            approvalHash = await writeContractAsync({
              chainId: CONTRACT_CONFIG.chainId,
              address: CONTRACT_CONFIG.usdcAddress,
              abi: erc20Abi,
              functionName: 'approve',
              args: [trustPay, amount],
              ...fees,
            })
            setState({ phase: 'approve-confirming', approvalHash })
            await waitFor(approvalHash)
          }
          setState({ phase: 'pay-wallet', approvalHash })
          hash = await writeContractAsync({
            chainId: CONTRACT_CONFIG.chainId,
            address: trustPay,
            abi: trustPayAbi,
            functionName: 'pay',
            args: [to, amount, note],
            ...fees,
          })
        } else {
          setState({ phase: 'pay-wallet' })
          hash = await writeContractAsync({
            chainId: CONTRACT_CONFIG.chainId,
            address: CONTRACT_CONFIG.usdcAddress,
            abi: erc20Abi,
            functionName: 'transfer',
            args: [to, amount],
            ...fees,
          })
        }

        setState({ phase: 'pay-confirming', approvalHash, hash })
        await waitFor(hash)
        setState({ phase: 'success', approvalHash, hash })
        requestHistoryRefresh()
      } catch (error) {
        if (isUserRejection(error)) {
          // Cancelling is not a failure. Return to the form with the transaction (if any) untouched.
          setState(approvalHash && !hash ? { phase: 'idle', approvalHash } : { phase: 'idle' })
          return
        }
        const message = error instanceof Error ? error.message.toLowerCase() : ''
        const timedOut = message.includes('timed out') || message.includes('timeout')
        const reverted = message === 'reverted'
        setState({
          phase: 'failed',
          approvalHash,
          hash,
          unconfirmed: timedOut && Boolean(hash ?? approvalHash),
          error: reverted
            ? 'The network rejected this transaction. No payment was made. Gas may still have been used.'
            : timedOut
              ? 'Not confirmed yet. Check the explorer before trying again, so you do not pay twice.'
              : parseOnchainError(error),
        })
      }
    },
    [address, client, switchChainAsync, writeContractAsync],
  )

  return { state, send, reset }
}
