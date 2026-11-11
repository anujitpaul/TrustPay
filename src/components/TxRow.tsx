import { ArrowDownLeft, ArrowUpRight, ChevronDown, ExternalLink } from 'lucide-react'
import { explorerTxUrl } from '../../config/contract'
import { formatDateTime, formatNativeUsdc, formatRelative, shortAddress, shortHash } from '@/lib/format'
import type { HistoryTx } from '@/hooks/history'
import { CopyButton, ExplorerLink, StatusBadge } from '@/components/ui'

interface TxRowProps {
  tx: HistoryTx
  time?: number
  expanded?: boolean
  onToggle?: () => void
  /** Compact rows (dashboard) show no details. */
  compact?: boolean
}

export function TxRow({ tx, time, expanded = false, onToggle, compact = false }: TxRowProps) {
  const sent = tx.direction === 'sent'
  const Icon = sent ? ArrowUpRight : ArrowDownLeft
  const tone = sent ? 'var(--ink-2)' : 'var(--success)'

  const heading = (
    <div className="row-hover flex min-h-[68px] w-full items-center gap-3.5 px-2.5 text-left">
      <span
        className="flex size-11 shrink-0 items-center justify-center rounded-2xl"
        style={{ background: sent ? 'var(--surface-strong)' : 'color-mix(in srgb, var(--success) 14%, transparent)' }}
      >
        <Icon className="size-[18px]" style={{ color: tone }} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">
          {sent ? 'Sent to ' : 'Received from '}
          <span className="mono text-xs font-medium" style={{ color: 'var(--muted)' }}>
            {shortAddress(tx.counterparty)}
          </span>
        </span>
        <span className="block truncate text-xs" style={{ color: 'var(--subtle)' }}>
          {time ? (compact ? formatRelative(time) : formatDateTime(time)) : `Block ${tx.blockNumber.toLocaleString()}`}
          {tx.note ? ` · ${tx.note}` : ''}
        </span>
      </span>
      <span className="flex flex-col items-end gap-1">
        <span className="display text-[15px] font-bold tabular-nums" style={{ color: tone }}>
          {sent ? '−' : '+'}
          {formatNativeUsdc(tx.amount, 2)} <span className="text-[11px] font-semibold" style={{ color: 'var(--subtle)' }}>USDC</span>
        </span>
        {!compact && <StatusBadge status="confirmed" />}
      </span>
      {!compact && (
        <ChevronDown className={`size-4 shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`} style={{ color: 'var(--subtle)' }} aria-hidden />
      )}
    </div>
  )

  if (compact || !onToggle) return <div>{heading}</div>

  return (
    <div>
      <div className="flex items-center gap-1">
        <button type="button" className="min-w-0 flex-1 rounded-2xl text-left focus-visible:outline-2 focus-visible:outline-offset-2" style={{ outlineColor: 'var(--accent)' }} aria-expanded={expanded} onClick={onToggle}>
          {heading}
        </button>
        <a
          href={explorerTxUrl(tx.hash)}
          target="_blank"
          rel="noopener noreferrer"
          className="hidden size-10 shrink-0 items-center justify-center rounded-xl sm:flex"
          style={{ color: 'var(--subtle)' }}
          aria-label="View transaction on Arc Explorer"
          title="View on Arc Explorer"
        >
          <ExternalLink className="size-4" aria-hidden />
        </a>
      </div>
      {expanded && (
        <dl className="card-inner mx-2 mb-3 grid gap-4 p-4 text-sm sm:grid-cols-2">
          <Detail label="Status">
            <StatusBadge status="confirmed" />
          </Detail>
          <Detail label="Date">{time ? formatDateTime(time) : `Block ${tx.blockNumber.toLocaleString()}`}</Detail>
          <Detail label={sent ? 'To' : 'From'} wide>
            <span className="mono break-all text-xs">{tx.counterparty}</span>
            <ExplorerLink kind="address" value={tx.counterparty}>
              Address
            </ExplorerLink>
          </Detail>
          {tx.note && (
            <Detail label="Note" wide>
              {tx.note}
            </Detail>
          )}
          <Detail label="Transaction hash" wide>
            <span className="mono break-all text-xs">{tx.hash}</span>
            <span className="flex flex-wrap items-center gap-3">
              <ExplorerLink kind="tx" value={tx.hash} />
              <CopyButton value={tx.hash} label={shortHash(tx.hash)} />
            </span>
          </Detail>
          <Detail label="Block">{tx.blockNumber.toLocaleString()}</Detail>
        </dl>
      )}
    </div>
  )
}

function Detail({ label, children, wide = false }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={`grid content-start gap-1.5 ${wide ? 'sm:col-span-2' : ''}`}>
      <dt className="label">{label}</dt>
      <dd className="grid justify-items-start gap-1.5">{children}</dd>
    </div>
  )
}
