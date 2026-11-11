import { useMemo, useState } from 'react'
import { Inbox, RefreshCw, Search, SearchX } from 'lucide-react'
import { useAccount } from 'wagmi'
import { useHistory, type HistoryTx } from '@/hooks/history'
import { dayLabel, formatNativeUsdc } from '@/lib/format'
import { ConnectPrompt, Notice, PageTitle, Skeleton, Spinner } from '@/components/ui'
import { TxRow } from '@/components/TxRow'

type Filter = 'all' | 'sent' | 'received'
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'sent', label: 'Sent' },
  { id: 'received', label: 'Received' },
]
const PAGE = 25

function matches(tx: HistoryTx, query: string): boolean {
  if (!query) return true
  const haystack = `${tx.counterparty} ${tx.hash} ${tx.note ?? ''} ${formatNativeUsdc(tx.amount, 2)} ${tx.blockNumber}`.toLowerCase()
  return haystack.includes(query)
}

export function HistoryPage() {
  const { isConnected } = useAccount()
  const history = useHistory()
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [visible, setVisible] = useState(PAGE)

  const normalized = query.trim().toLowerCase()
  const filtered = useMemo(
    () => history.items.filter((item) => (filter === 'all' || item.direction === filter) && matches(item, normalized)),
    [history.items, filter, normalized],
  )

  const groups = useMemo(() => {
    const result: { label: string; rows: HistoryTx[] }[] = []
    for (const tx of filtered.slice(0, visible)) {
      const time = history.blockTimes.get(tx.blockNumber)
      const label = time ? dayLabel(time) : 'Earlier'
      const last = result[result.length - 1]
      if (last && last.label === label) last.rows.push(tx)
      else result.push({ label, rows: [tx] })
    }
    return result
  }, [filtered, visible, history.blockTimes])

  if (!isConnected) {
    return (
      <>
        <PageTitle title="History" />
        <ConnectPrompt body="Connect your wallet to see the USDC payments you sent and received on Arc Mainnet." />
      </>
    )
  }

  const scanned =
    history.oldestBlock !== null && history.newestBlock !== null
      ? `Searched blocks ${history.oldestBlock.toLocaleString()} to ${history.newestBlock.toLocaleString()}`
      : null
  const loading = history.status === 'loading' && history.items.length === 0
  const searching = normalized.length > 0 || filter !== 'all'

  return (
    <>
      <PageTitle title="History" subtitle="Payments read directly from Arc Mainnet logs. Nothing here is simulated." />

      <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2" style={{ color: 'var(--subtle)' }} aria-hidden />
          <input
            type="search"
            className="field !pl-11"
            placeholder="Search address, hash, note or amount"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setVisible(PAGE)
            }}
            aria-label="Search transactions"
          />
        </div>
        <div className="flex items-center gap-2" role="group" aria-label="Filter transactions">
          {FILTERS.map(({ id, label }) => (
            <button key={id} type="button" className="chip" aria-pressed={filter === id} onClick={() => setFilter(id)}>
              {label}
            </button>
          ))}
          <button type="button" className="chip !px-3" onClick={() => void history.refresh()} disabled={history.isScanning} aria-label="Refresh">
            {history.isScanning ? <Spinner className="size-3.5" /> : <RefreshCw className="size-3.5" aria-hidden />}
          </button>
        </div>
      </div>

      {history.error && (
        <div className="mb-4">
          <Notice tone="danger">
            {history.error}{' '}
            <button type="button" className="font-semibold underline" onClick={() => void history.refresh()}>
              Retry
            </button>
          </Notice>
        </div>
      )}

      <section className="card p-2 sm:p-3" aria-live="polite" aria-busy={history.status === 'loading'}>
        {loading ? (
          <div className="grid gap-3 p-3">
            {[0, 1, 2, 3, 4].map((n) => (
              <Skeleton key={n} className="h-14 w-full" />
            ))}
          </div>
        ) : groups.length === 0 ? (
          <div className="flex flex-col items-center px-4 py-14 text-center">
            <span className="icon-tile mb-3 !size-12">{searching ? <SearchX className="size-5" aria-hidden /> : <Inbox className="size-5" aria-hidden />}</span>
            <p className="text-sm font-semibold">{searching ? 'No matching transactions' : 'No transactions found yet'}</p>
            <p className="mx-auto mt-1 max-w-sm text-xs text-pretty" style={{ color: 'var(--subtle)' }}>
              {searching ? 'Try a different search or filter, or search older blocks below.' : 'Only the blocks listed below have been searched. Search older blocks to look further back.'}
            </p>
          </div>
        ) : (
          groups.map((group) => (
            <div key={group.label} className="mb-1">
              <h2 className="label px-3 pb-1 pt-3">{group.label}</h2>
              <ul>
                {group.rows.map((tx) => (
                  <li key={tx.key}>
                    <TxRow
                      tx={tx}
                      time={history.blockTimes.get(tx.blockNumber)}
                      expanded={expanded === tx.key}
                      onToggle={() => setExpanded((current) => (current === tx.key ? null : tx.key))}
                    />
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}

        <div className="flex flex-col items-center gap-2.5 px-2 pb-3 pt-4">
          {filtered.length > visible && (
            <button type="button" className="btn btn-ghost w-full sm:w-auto" onClick={() => setVisible((n) => n + PAGE)}>
              Show more
            </button>
          )}
          {history.canLoadOlder && (
            <button type="button" className="btn btn-ghost w-full sm:w-auto" onClick={() => void history.loadOlder()} disabled={history.isScanning}>
              {history.isScanning && <Spinner />}
              Search older blocks
            </button>
          )}
          {scanned && (
            <p className="mono text-center text-[11px]" style={{ color: 'var(--subtle)' }}>
              {scanned}
              {history.headBlock !== null ? ` · head ${history.headBlock.toLocaleString()}` : ''}
            </p>
          )}
          <p className="max-w-md text-center text-[11px] text-pretty" style={{ color: 'var(--subtle)' }}>
            Only confirmed payments appear. Reverted transactions leave no log, so check your wallet or Arc Explorer for those.
          </p>
        </div>
      </section>
    </>
  )
}
