import { Amount } from '@/onchain-money'

const USDC_VIEW_DECIMALS = 6
const NATIVE_VIEW_DECIMALS = 18

export function shortAddress(address: string, head = 6, tail = 4): string {
  return address.length > head + tail + 2 ? `${address.slice(0, head)}…${address.slice(-tail)}` : address
}

export function shortHash(hash: string): string {
  return shortAddress(hash, 10, 8)
}

function withThousands(fixed: string): string {
  const [whole, fraction] = fixed.split('.')
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return fraction === undefined ? grouped : `${grouped}.${fraction}`
}

/** Format a 6-decimal ERC-20 USDC amount, truncated (never rounded up) to `digits` places. */
export function formatUsdcAmount(raw: bigint, digits = 2): string {
  return withThousands(Amount.fromRaw(raw, USDC_VIEW_DECIMALS).toFixed(digits))
}

/** Format an 18-decimal native-view USDC amount (as logged by Arc's system emitter). */
export function formatNativeUsdc(raw: bigint, digits = 2): string {
  return withThousands(Amount.fromRaw(raw, NATIVE_VIEW_DECIMALS).toFixed(digits))
}

/** Plain decimal string with trailing zeros removed, for inputs and links. */
export function plainUsdc(raw: bigint): string {
  const text = Amount.fromRaw(raw, USDC_VIEW_DECIMALS).toString()
  return text.includes('.') ? text.replace(/\.?0+$/, '') || '0' : text
}

export function formatDateTime(seconds: number): string {
  return new Date(seconds * 1000).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatRelative(seconds: number, nowMs = Date.now()): string {
  const diff = Math.max(0, Math.floor(nowMs / 1000) - seconds)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export function utf8Length(text: string): number {
  return new TextEncoder().encode(text).length
}

export function greeting(date = new Date()): string {
  const hour = date.getHours()
  if (hour < 5) return 'Good evening'
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

/** "Today", "Yesterday" or a long date, for grouping activity by day. */
export function dayLabel(seconds: number, now = new Date()): string {
  const date = new Date(seconds * 1000)
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const diffDays = Math.round((startOf(now) - startOf(date)) / 86_400_000)
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: date.getFullYear() === now.getFullYear() ? undefined : 'numeric' })
}
