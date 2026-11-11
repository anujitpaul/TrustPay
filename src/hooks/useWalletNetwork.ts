import { useCallback, useEffect, useRef } from 'react'
import { useAccount, useSwitchChain } from 'wagmi'
import { toast } from 'sonner'
import { CONTRACT_CONFIG } from '../../config/contract'
import { isUserRejection } from '@/lib/errors'

/** `autoSwitch` must be enabled in exactly one mounted component (the app shell). */
export function useWalletNetwork({ autoSwitch = false }: { autoSwitch?: boolean } = {}) {
  const { address, chainId, isConnected, connector } = useAccount()
  const { switchChainAsync, isPending } = useSwitchChain()
  const attempted = useRef<string | null>(null)

  const onArc = chainId === CONTRACT_CONFIG.chainId
  const wrongNetwork = isConnected && !onArc

  const switchToArc = useCallback(() => {
    switchChainAsync({ chainId: CONTRACT_CONFIG.chainId }).catch((error: unknown) => {
      if (!isUserRejection(error)) toast.error('Could not switch networks. Add Arc Mainnet in your wallet and try again.')
    })
  }, [switchChainAsync])

  // Ask once per connection to move the wallet onto Arc Mainnet. If it is refused, the banner stays.
  const connectorId = connector?.uid
  useEffect(() => {
    if (!autoSwitch) return
    if (!isConnected || !address || onArc) {
      if (!isConnected) attempted.current = null
      return
    }
    const id = `${connectorId ?? 'wallet'}:${address}`
    if (attempted.current === id) return
    attempted.current = id
    switchToArc()
  }, [autoSwitch, isConnected, address, onArc, connectorId, switchToArc])

  return { address, isConnected, onArc, wrongNetwork, switchToArc, isSwitching: isPending }
}
