import { useQuery } from '@tanstack/react-query'
import { erc20Abi, type Address } from 'viem'
import { usePublicClient } from 'wagmi'
import { CONTRACT_CONFIG } from '../../config/contract'
import { trustPayAbi } from '@/lib/abi'
import { withRetry } from '@/lib/rpc'
import { useFeeParams } from '@/hooks/useUsdcBalance'

interface Args {
  owner: Address | undefined
  to: Address | undefined
  amount: bigint | undefined
  note: string
  useContract: boolean
}

/** Upper-bound network fee (18-decimal USDC) for the next transaction the wallet will ask you to sign. */
export function useSendFee({ owner, to, amount, note, useContract }: Args) {
  const client = usePublicClient({ chainId: CONTRACT_CONFIG.chainId })
  const fees = useFeeParams()
  const trustPay = CONTRACT_CONFIG.trustPayAddress

  return useQuery({
    queryKey: ['send-fee', owner, to, amount?.toString(), note, useContract, fees.data?.maxFeePerGas.toString()],
    enabled: Boolean(client && owner && to && amount && fees.data),
    staleTime: 15_000,
    retry: 0,
    queryFn: async () => {
      if (!client || !owner || !to || !amount || !fees.data) throw new Error('missing input')
      let gas: bigint
      let needsApproval = false

      if (useContract && trustPay) {
        const allowance = await withRetry(() =>
          client.readContract({ address: CONTRACT_CONFIG.usdcAddress, abi: erc20Abi, functionName: 'allowance', args: [owner, trustPay] }),
        )
        needsApproval = allowance < amount
        gas = needsApproval
          ? await withRetry(() =>
              client.estimateContractGas({
                account: owner,
                address: CONTRACT_CONFIG.usdcAddress,
                abi: erc20Abi,
                functionName: 'approve',
                args: [trustPay, amount],
              }),
            )
          : await withRetry(() =>
              client.estimateContractGas({ account: owner, address: trustPay, abi: trustPayAbi, functionName: 'pay', args: [to, amount, note] }),
            )
      } else {
        gas = await withRetry(() =>
          client.estimateContractGas({ account: owner, address: CONTRACT_CONFIG.usdcAddress, abi: erc20Abi, functionName: 'transfer', args: [to, amount] }),
        )
      }
      return { gas, fee: gas * fees.data.maxFeePerGas, needsApproval }
    },
  })
}
