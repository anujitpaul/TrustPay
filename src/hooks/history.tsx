import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useAccount, usePublicClient } from 'wagmi'
import { getAddress, type Address, type Hex, type PublicClient } from 'viem'
import { ARC_SYSTEM_EMITTER, CONTRACT_CONFIG } from '../../config/contract'
import { paymentSentEvent, transferEvent } from '@/lib/abi'
import { mapLimit, withRetry } from '@/lib/rpc'

/**
 * Real transaction history, read from Arc's system emitter (EIP-7708). That one stream logs every
 * USDC movement (native sends and ERC-20 transfers) exactly once, at 18 decimals. Notes come from
 * TrustPay `PaymentSent` events when the contract is configured.
 *
 * The RPC limits log queries to about 10,000 blocks, so history is scanned backwards in
 * 9,000-block chunks from the chain head. Results are cached per wallet in localStorage so a reload
 * only scans new blocks, and older history loads on demand.
 */

const CHUNK_BLOCKS = 9_000
const INITIAL_CHUNKS = 6
const OLDER_CHUNKS = 6
const MAX_FORWARD_GAP_CHUNKS = 12
const CONCURRENCY = 3
const POLL_MS = 30_000
const MAX_CACHED_ITEMS = 500
const CACHE_VERSION = 'v2'
const SCALE_18_TO_6 = 10n ** 12n

export interface HistoryTx {
  key: string
  hash: Hex
  blockNumber: number
  logIndex: number
  direction: 'sent' | 'received'
  counterparty: Address
  /** 18-decimal native view of USDC, as logged by the system emitter. */
  amount: bigint
  note?: string
}

interface StoredHistory {
  newest: number
  oldest: number
  items: (Omit<HistoryTx, 'amount'> & { amount: string })[]
}

export interface HistoryValue {
  items: HistoryTx[]
  status: 'idle' | 'loading' | 'ready' | 'error'
  isScanning: boolean
  error?: string
  /** Newest block scanned (inclusive). */
  newestBlock: number | null
  /** Oldest block scanned (inclusive). */
  oldestBlock: number | null
  headBlock: number | null
  canLoadOlder: boolean
  blockTimes: ReadonlyMap<number, number>
  loadOlder: () => Promise<void>
  refresh: () => Promise<void>
}

const HistoryContext = createContext<HistoryValue | null>(null)

const REFRESH_EVENT = 'trustpay:history-refresh'
export function requestHistoryRefresh(): void {
  window.dispatchEvent(new Event(REFRESH_EVENT))
}

function storageKey(address: Address): string {
  return `trustpay:${CACHE_VERSION}:${CONTRACT_CONFIG.chainId}:${CONTRACT_CONFIG.trustPayAddress ?? 'none'}:${address.toLowerCase()}`
}

function loadCache(address: Address): { newest: number; oldest: number; items: HistoryTx[] } | null {
  try {
    const raw = localStorage.getItem(storageKey(address))
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredHistory
    if (typeof parsed.newest !== 'number' || typeof parsed.oldest !== 'number' || !Array.isArray(parsed.items)) return null
    return { newest: parsed.newest, oldest: parsed.oldest, items: parsed.items.map((item) => ({ ...item, amount: BigInt(item.amount) })) }
  } catch {
    return null
  }
}

function saveCache(address: Address, newest: number, oldest: number, items: HistoryTx[]): void {
  try {
    const stored: StoredHistory = {
      newest,
      oldest,
      items: items.slice(0, MAX_CACHED_ITEMS).map((item) => ({ ...item, amount: item.amount.toString() })),
    }
    // Only keep the cache contiguous: if we truncated, shrink the claimed oldest block to match.
    if (items.length > MAX_CACHED_ITEMS) stored.oldest = items[MAX_CACHED_ITEMS - 1].blockNumber
    localStorage.setItem(storageKey(address), JSON.stringify(stored))
  } catch {
    // Storage may be full or disabled. History still works, it just rescans on reload.
  }
}

function sortItems(items: HistoryTx[]): HistoryTx[] {
  return [...items].sort((a, b) => b.blockNumber - a.blockNumber || b.logIndex - a.logIndex)
}

function mergeItems(existing: HistoryTx[], incoming: HistoryTx[]): HistoryTx[] {
  const map = new Map(existing.map((item) => [item.key, item]))
  for (const item of incoming) map.set(item.key, item)
  return sortItems([...map.values()])
}

async function scanChunk(client: PublicClient, address: Address, fromBlock: bigint, toBlock: bigint): Promise<HistoryTx[]> {
  const trustPay = CONTRACT_CONFIG.trustPayAddress
  const [sentLogs, receivedLogs, notesOut, notesIn] = await Promise.all([
    withRetry(() => client.getLogs({ address: ARC_SYSTEM_EMITTER, event: transferEvent, args: { from: address }, fromBlock, toBlock })),
    withRetry(() => client.getLogs({ address: ARC_SYSTEM_EMITTER, event: transferEvent, args: { to: address }, fromBlock, toBlock })),
    trustPay
      ? withRetry(() => client.getLogs({ address: trustPay, event: paymentSentEvent, args: { sender: address }, fromBlock, toBlock }))
      : Promise.resolve([]),
    trustPay
      ? withRetry(() => client.getLogs({ address: trustPay, event: paymentSentEvent, args: { recipient: address }, fromBlock, toBlock }))
      : Promise.resolve([]),
  ])

  const notes = new Map<string, string>()
  for (const log of [...notesOut, ...notesIn]) {
    const { sender, recipient, amount, note } = log.args
    if (!sender || !recipient || amount === undefined || !note) continue
    notes.set(`${log.transactionHash}:${sender.toLowerCase()}:${recipient.toLowerCase()}:${amount}`, note)
  }

  const items: HistoryTx[] = []
  for (const log of [...sentLogs, ...receivedLogs]) {
    const { from, to, value } = log.args
    if (!from || !to || value === undefined || log.blockNumber === null || log.logIndex === null || !log.transactionHash) continue
    // Mint and burn move USDC to or from the zero address and are not payments.
    if (/^0x0{40}$/.test(from) || /^0x0{40}$/.test(to)) continue
    const outgoing = from.toLowerCase() === address.toLowerCase()
    const noteKey = `${log.transactionHash}:${from.toLowerCase()}:${to.toLowerCase()}:${value / SCALE_18_TO_6}`
    items.push({
      key: `${log.transactionHash}:${log.logIndex}`,
      hash: log.transactionHash,
      blockNumber: Number(log.blockNumber),
      logIndex: log.logIndex,
      direction: outgoing ? 'sent' : 'received',
      counterparty: getAddress(outgoing ? to : from),
      amount: value,
      note: value % SCALE_18_TO_6 === 0n ? notes.get(noteKey) : undefined,
    })
  }
  return items
}

/** Scan inclusive block range [from, to] in CHUNK_BLOCKS slices, newest slice first. */
async function scanRange(client: PublicClient, address: Address, from: number, to: number): Promise<HistoryTx[]> {
  const ranges: [number, number][] = []
  for (let end = to; end >= from; end -= CHUNK_BLOCKS) {
    ranges.push([Math.max(from, end - CHUNK_BLOCKS + 1), end])
  }
  const results = await mapLimit(ranges, CONCURRENCY, ([start, end]) => scanChunk(client, address, BigInt(start), BigInt(end)))
  return results.flat()
}

interface Store {
  owner: Address | undefined
  items: HistoryTx[]
  bounds: { newest: number; oldest: number } | null
  status: HistoryValue['status']
  error?: string
}

/** Initial state for a wallet: whatever is cached for it, or an empty, loading state. */
function initialStore(owner: Address | undefined): Store {
  if (!owner) return { owner, items: [], bounds: null, status: 'idle' }
  const cached = loadCache(owner)
  if (!cached) return { owner, items: [], bounds: null, status: 'loading' }
  return { owner, items: sortItems(cached.items), bounds: { newest: cached.newest, oldest: cached.oldest }, status: 'ready' }
}

export function HistoryProvider({ children }: { children: ReactNode }) {
  const { address } = useAccount()
  const client = usePublicClient({ chainId: CONTRACT_CONFIG.chainId })

  const [store, setStore] = useState<Store>(() => initialStore(address))
  if (store.owner !== address) {
    // Wallet changed: swap to that wallet's cached history during render, before anything stale paints.
    setStore(initialStore(address))
  }

  const [headBlock, setHeadBlock] = useState<number | null>(null)
  const [isScanning, setIsScanning] = useState(false)
  const [blockTimes, setBlockTimes] = useState<ReadonlyMap<number, number>>(new Map())

  const busy = useRef(false)
  const storeRef = useRef(store)
  const timesRef = useRef(new Map<number, number>())

  useEffect(() => {
    storeRef.current = store
  }, [store])

  const commit = useCallback((owner: Address, items: HistoryTx[], bounds: { newest: number; oldest: number }) => {
    // A scan that finishes after the wallet changed must not overwrite the new wallet's history.
    if (storeRef.current.owner !== owner) return
    const next: Store = { owner, items, bounds, status: 'ready' }
    storeRef.current = next
    setStore(next)
    saveCache(owner, bounds.newest, bounds.oldest, items)
  }, [])

  const run = useCallback(async (owner: Address, task: () => Promise<void>) => {
    if (busy.current) return
    busy.current = true
    setIsScanning(true)
    try {
      await task()
      setStore((current) => (current.owner === owner ? { ...current, status: 'ready', error: undefined } : current))
    } catch (cause) {
      const message =
        cause instanceof Error && /rate limit|429/i.test(cause.message)
          ? 'The network is busy. Retrying shortly.'
          : 'Could not load transactions from Arc. Check your connection.'
      setStore((current) =>
        current.owner === owner ? { ...current, status: current.status === 'ready' ? 'ready' : 'error', error: message } : current,
      )
    } finally {
      busy.current = false
      setIsScanning(false)
    }
  }, [])

  const refresh = useCallback(async () => {
    if (!client || !address) return
    await run(address, async () => {
      const head = Number(await withRetry(() => client.getBlockNumber({ cacheTime: 0 })))
      setHeadBlock(head)
      const { items, bounds } = storeRef.current
      const freshStart = async () => {
        const from = Math.max(0, head - CHUNK_BLOCKS * INITIAL_CHUNKS + 1)
        const found = await scanRange(client, address, from, head)
        commit(address, sortItems(found), { newest: head, oldest: from })
      }
      if (!bounds) return freshStart()
      if (head <= bounds.newest) return
      // Too far behind to patch cheaply: restart from the head instead of crawling the gap.
      if (head - bounds.newest > CHUNK_BLOCKS * MAX_FORWARD_GAP_CHUNKS) return freshStart()
      const found = await scanRange(client, address, bounds.newest + 1, head)
      commit(address, mergeItems(items, found), { newest: head, oldest: bounds.oldest })
    })
  }, [address, client, commit, run])

  const loadOlder = useCallback(async () => {
    if (!client || !address) return
    await run(address, async () => {
      const { items, bounds } = storeRef.current
      if (!bounds || bounds.oldest <= 0) return
      const to = bounds.oldest - 1
      const from = Math.max(0, to - CHUNK_BLOCKS * OLDER_CHUNKS + 1)
      const found = await scanRange(client, address, from, to)
      commit(address, mergeItems(items, found), { newest: bounds.newest, oldest: from })
    })
  }, [address, client, commit, run])

  // Bring the wallet's history up to the chain head, then keep it fresh while the tab is visible.
  useEffect(() => {
    if (!address) return
    busy.current = false
    const first = setTimeout(() => void refresh(), 0)
    const tick = () => {
      if (document.visibilityState === 'visible') void refresh()
    }
    const timer = setInterval(tick, POLL_MS)
    window.addEventListener(REFRESH_EVENT, tick)
    document.addEventListener('visibilitychange', tick)
    return () => {
      clearTimeout(first)
      clearInterval(timer)
      window.removeEventListener(REFRESH_EVENT, tick)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [address, refresh])

  // Resolve timestamps for the newest transactions only (cached per block).
  const { items, bounds, status, error } = store
  useEffect(() => {
    if (!client) return
    const wanted = [...new Set(items.slice(0, 60).map((item) => item.blockNumber))].filter((block) => !timesRef.current.has(block))
    if (wanted.length === 0) return
    const token = { cancelled: false }
    void mapLimit(wanted, 6, async (block) => {
      try {
        const info = await withRetry(() => client.getBlock({ blockNumber: BigInt(block), includeTransactions: false }))
        timesRef.current.set(block, Number(info.timestamp))
      } catch {
        // Leave this block without a time; the row shows its block number instead.
      }
    }).then(() => {
      if (!token.cancelled) setBlockTimes(new Map(timesRef.current))
    })
    return () => {
      token.cancelled = true
    }
  }, [client, items])

  const value = useMemo<HistoryValue>(
    () => ({
      items,
      status,
      isScanning,
      error,
      newestBlock: bounds?.newest ?? null,
      oldestBlock: bounds?.oldest ?? null,
      headBlock,
      canLoadOlder: bounds !== null && bounds.oldest > 0,
      blockTimes,
      loadOlder,
      refresh,
    }),
    [items, status, isScanning, error, bounds, headBlock, blockTimes, loadOlder, refresh],
  )

  return <HistoryContext.Provider value={value}>{children}</HistoryContext.Provider>
}

export function useHistory(): HistoryValue {
  const value = useContext(HistoryContext)
  if (!value) throw new Error('useHistory must be used inside HistoryProvider')
  return value
}
