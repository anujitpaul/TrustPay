import { useMemo } from 'react'
import { ArrowDownLeft, ArrowUpRight, Inbox, ListOrdered, TrendingDown, TrendingUp } from 'lucide-react'
import { TokenUSDC } from '@web3icons/react'
import { useAccount } from 'wagmi'
import { CONTRACT_CONFIG } from '../../config/contract'
import { useHistory } from '@/hooks/history'
import { useChainStatus, useUsdcBalance } from '@/hooks/useUsdcBalance'
import { useTrustPayContract } from '@/hooks/useTrustPayContract'
import { formatNativeUsdc, formatUsdcAmount, greeting, shortAddress } from '@/lib/format'
import { Link } from '@/lib/router'
import { AmountDisplay, ConnectPrompt, CopyButton, ExplorerLink, Notice, Skeleton } from '@/components/ui'
import { NetworkBadge } from '@/components/AppShell'
import { TxRow } from '@/components/TxRow'

function Stat({ label, value, loading, icon: Icon, tone }: { label: string; value: string; loading: boolean; icon: typeof ListOrdered; tone?: string }) {
  return (
    <div className="card card-hover p-4 sm:p-5">
      <span className="icon-tile" style={tone ? { color: tone } : undefined}>
        <Icon className="size-4" aria-hidden />
      </span>
      <p className="label mt-3.5">{label}</p>
      {loading ? <Skeleton className="mt-1.5 h-7 w-full max-w-24" /> : <p className="display mt-0.5 truncate text-xl tabular-nums sm:text-2xl">{value}</p>}
    </div>
  )
}

export function Dashboard() {
  const { address, isConnected } = useAccount()
  const balance = useUsdcBalance(address)
  const history = useHistory()
  const chain = useChainStatus()
  const contract = useTrustPayContract()

  const totals = useMemo(() => {
    let sent = 0n
    let received = 0n
    for (const tx of history.items) {
      if (tx.direction === 'sent') sent += tx.amount
      else received += tx.amount
    }
    return { sent, received }
  }, [history.items])

  if (!isConnected || !address) return <ConnectPrompt />

  const loadingHistory = history.status === 'loading' && history.items.length === 0

  return (
    <div className="grid gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium" style={{ color: 'var(--subtle)' }}>
            {greeting()}
          </p>
          <h1 className="display text-[1.75rem] sm:text-3xl">Welcome back</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="mono inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs" style={{ background: 'var(--inner)', border: '1px solid var(--border)', color: 'var(--ink-2)' }}>
            <span className="size-2 rounded-full" style={{ background: 'var(--success)' }} aria-hidden />
            {shortAddress(address)}
          </span>
          <NetworkBadge />
        </div>
      </header>

      <section className="card hero p-6 sm:p-8" aria-label="Wallet balance">
        <p className="label">Total balance</p>
        <div className="mt-3 flex items-center gap-3.5">
          <TokenUSDC variant="branded" size={40} />
          {balance.isPending ? (
            <Skeleton className="h-12 w-52" />
          ) : balance.isError ? (
            <span className="text-sm" style={{ color: 'var(--danger)' }}>
              Balance unavailable
            </span>
          ) : (
            <p className="flex items-baseline gap-2">
              <AmountDisplay text={formatUsdcAmount(balance.data ?? 0n, 2)} className="text-5xl sm:text-6xl" />
              <span className="text-base font-semibold" style={{ color: 'var(--subtle)' }}>
                USDC
              </span>
            </p>
          )}
        </div>
        <p className="mt-3 max-w-sm text-xs text-pretty" style={{ color: 'var(--subtle)' }}>
          One USDC balance on Arc Mainnet. It also pays your network fees.
        </p>
        <div className="mt-7 grid max-w-md grid-cols-2 gap-3">
          <Link to="/send" className="btn btn-primary">
            <ArrowUpRight className="size-4" aria-hidden />
            Send
          </Link>
          <Link to="/receive" className="btn btn-ghost">
            <ArrowDownLeft className="size-4" aria-hidden />
            Receive
          </Link>
        </div>
      </section>

      {balance.isError && <Notice tone="danger">Could not read your balance from Arc. The app is retrying through backup RPC endpoints.</Notice>}

      <section aria-label="Activity totals">
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Total sent" value={formatNativeUsdc(totals.sent, 2)} loading={loadingHistory} icon={TrendingUp} />
          <Stat label="Total received" value={formatNativeUsdc(totals.received, 2)} loading={loadingHistory} icon={TrendingDown} tone="var(--success)" />
          <Stat label="Transactions" value={history.items.length.toLocaleString()} loading={loadingHistory} icon={ListOrdered} tone="var(--accent-2)" />
        </div>
        <p className="mt-2.5 px-1 text-[11px]" style={{ color: 'var(--subtle)' }}>
          {history.oldestBlock !== null && history.newestBlock !== null ? `Totals cover blocks ${history.oldestBlock.toLocaleString()} to ${history.newestBlock.toLocaleString()}. ` : ''}
          <Link to="/history" className="underline">
            Search older blocks in History
          </Link>
          .
        </p>
      </section>

      <div className="grid gap-5 lg:grid-cols-5">
        <section className="card p-3 sm:p-4 lg:col-span-3" aria-label="Recent transactions">
          <div className="flex items-center justify-between px-2.5 pb-2 pt-1.5">
            <h2 className="display text-lg">Recent activity</h2>
            <Link to="/history" className="text-xs font-semibold" style={{ color: 'var(--accent)' }}>
              View all
            </Link>
          </div>
          {loadingHistory ? (
            <div className="grid gap-3 p-2">
              {[0, 1, 2].map((n) => (
                <Skeleton key={n} className="h-14 w-full" />
              ))}
            </div>
          ) : history.items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-2 py-12 text-center">
              <span className="icon-tile !size-12">
                <Inbox className="size-5" aria-hidden />
              </span>
              <p className="mt-1 text-sm font-semibold">No payments yet</p>
              <p className="max-w-xs text-xs text-pretty" style={{ color: 'var(--subtle)' }}>
                Nothing found in the blocks searched so far. Send or receive USDC and it will show up here.
              </p>
            </div>
          ) : (
            <ul>
              {history.items.slice(0, 5).map((tx) => (
                <li key={tx.key}>
                  <TxRow tx={tx} time={history.blockTimes.get(tx.blockNumber)} compact />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card p-5 lg:col-span-2" aria-label="Network status">
          <h2 className="display text-lg">Network</h2>
          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-4 text-sm">
            <div>
              <dt className="label">Status</dt>
              <dd className="mt-1 font-semibold" style={{ color: chain.isError ? 'var(--danger)' : 'var(--success)' }}>
                {chain.isPending ? 'Checking…' : chain.isError ? 'RPC unreachable' : 'Connected'}
              </dd>
            </div>
            <div>
              <dt className="label">Chain ID</dt>
              <dd className="mt-1 font-semibold tabular-nums">{CONTRACT_CONFIG.chainId}</dd>
            </div>
            <div>
              <dt className="label">Latest block</dt>
              <dd className="mono mt-1 text-xs tabular-nums">{chain.data ? chain.data.block.toLocaleString() : '—'}</dd>
            </div>
            <div>
              <dt className="label">RPC latency</dt>
              <dd className="mt-1 font-semibold tabular-nums">{chain.data ? `${chain.data.latencyMs} ms` : '—'}</dd>
            </div>
            <div className="col-span-2">
              <dt className="label">Wallet address</dt>
              <dd className="mt-1.5 grid gap-2">
                <span className="mono break-all text-xs">{address}</span>
                <span className="flex flex-wrap items-center gap-3">
                  <CopyButton value={address} />
                  <ExplorerLink kind="address" value={address}>
                    Explorer
                  </ExplorerLink>
                </span>
              </dd>
            </div>
          </dl>
          {contract.state !== 'ready' && (
            <p className="mt-4 text-xs text-pretty" style={{ color: 'var(--subtle)' }}>
              {contract.state === 'invalid'
                ? 'The configured TrustPay contract could not be verified, so payments use a direct USDC transfer.'
                : 'TrustPay contract not configured yet. Payments use a direct USDC transfer without an onchain note.'}
            </p>
          )}
        </section>
      </div>
    </div>
  )
}
