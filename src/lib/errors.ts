/** Turn wallet / RPC / contract errors into short, human messages. Never shows raw error dumps. */

interface ErrorLike {
  code?: number
  name?: string
  shortMessage?: string
  message?: string
  cause?: unknown
  details?: string
}

function collect(error: unknown): string {
  const parts: string[] = []
  let current: unknown = error
  for (let depth = 0; depth < 5 && current; depth += 1) {
    const e = current as ErrorLike
    parts.push(e.name ?? '', e.shortMessage ?? '', e.message ?? '', e.details ?? '')
    current = e.cause
  }
  return parts.join(' ').toLowerCase()
}

function codeOf(error: unknown): number | undefined {
  let current: unknown = error
  for (let depth = 0; depth < 5 && current; depth += 1) {
    const code = (current as ErrorLike).code
    if (typeof code === 'number') return code
    current = (current as ErrorLike).cause
  }
  return undefined
}

export function isUserRejection(error: unknown): boolean {
  const text = collect(error)
  return codeOf(error) === 4001 || text.includes('user rejected') || text.includes('user denied') || text.includes('rejected the request')
}

export function parseOnchainError(error: unknown): string {
  const text = collect(error)
  if (isUserRejection(error)) return 'You cancelled the request in your wallet.'
  if (text.includes('insufficient funds') || text.includes('exceeds balance') || text.includes('transfer amount exceeds')) {
    return 'Insufficient USDC balance for this payment and the network fee.'
  }
  if (text.includes('allowance')) return 'USDC allowance is too low. Approve the payment again.'
  if (text.includes('notetoolong')) return 'The note is too long.'
  if (text.includes('invalidrecipient') || text.includes('zeroaddress')) return 'That recipient address is not allowed.'
  if (text.includes('blocklist') || text.includes('blacklist')) {
    return 'USDC blocked this transfer because the sender or recipient is on the blocklist.'
  }
  if (text.includes('chain mismatch') || text.includes('chainid') || text.includes('wrong network')) {
    return 'Switch your wallet to Arc Mainnet and try again.'
  }
  if (text.includes('rate limit') || text.includes('429') || text.includes('-32005')) {
    return 'The network is busy. Wait a moment and try again.'
  }
  if (text.includes('timeout') || text.includes('timed out') || text.includes('network') || text.includes('failed to fetch')) {
    return 'Network issue. Check your connection and try again.'
  }
  if (text.includes('reverted')) return 'The transaction was reverted by the network.'
  return 'Something went wrong. Please try again.'
}
