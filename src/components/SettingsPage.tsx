import { useState } from 'react'
import { useAccount, useDisconnect } from 'wagmi'
import { CheckCircle2, CircleSlash, LogOut, Radio } from 'lucide-react'
import { CONTRACT_CONFIG } from '../../config/contract'
import { useTrustPayContract } from '@/hooks/useTrustPayContract'
import { useWalletNetwork } from '@/hooks/useWalletNetwork'
import { CopyButton, ExplorerLink, Notice, PageTitle, Spinner } from '@/components/ui'

interface Probe {
  url: string
  ok: boolean
  ms?: number
  note?: string
}

async function probe(url: string): Promise<Probe> {
  const started = performance.now()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 6_000)
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] }),
      signal: controller.signal,
    })
    if (!response.ok) return { url, ok: false, note: `HTTP ${response.status}` }
    const json = (await response.json()) as { result?: string }
    const chainId = json.result ? Number.parseInt(json.result, 16) : undefined
    if (chainId !== CONTRACT_CONFIG.chainId) return { url, ok: false, note: `Wrong chain ${chainId ?? 'unknown'}` }
    return { url, ok: true, ms: Math.round(performance.now() - started) }
  } catch {
    return { url, ok: false, note: 'Unreachable or timed out' }
  } finally {
    clearTimeout(timer)
  }
}

function hostOf(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}

export function SettingsPage() {
  const { address, isConnected, connector } = useAccount()
  const { disconnect } = useDisconnect()
  const { onArc, wrongNetwork, switchToArc, isSwitching } = useWalletNetwork()
  const contract = useTrustPayContract()
  const [probes, setProbes] = useState<Probe[]>()
  const [testing, setTesting] = useState(false)

  const testRpc = async () => {
    setTesting(true)
    setProbes(await Promise.all(CONTRACT_CONFIG.rpcUrls.map(probe)))
    setTesting(false)
  }

  return (
    <>
      <PageTitle title="Settings" subtitle="Network, contract and wallet details. Edit config/contract.ts or .env to change them." />
      <div className="grid items-start gap-5 lg:grid-cols-2">

      <section className="card grid gap-5 p-6" aria-label="Wallet">
        <h2 className="display text-lg">Wallet</h2>
        {isConnected && address ? (
          <>
            <Field label="Address">
              <span className="mono break-all text-xs">{address}</span>
              <span className="flex items-center gap-3">
                <ExplorerLink kind="address" value={address} />
                <CopyButton value={address} />
              </span>
            </Field>
            <Field label="Connected with">{connector?.name ?? 'Wallet'}</Field>
            <Field label="Network">
              {onArc ? <span style={{ color: 'var(--success)' }}>Arc Mainnet</span> : <span style={{ color: 'var(--warn)' }}>Not on Arc Mainnet</span>}
              {wrongNetwork && (
                <button type="button" className="btn btn-primary !min-h-10 w-fit" onClick={switchToArc} disabled={isSwitching}>
                  {isSwitching && <Spinner />}
                  Switch to Arc Mainnet
                </button>
              )}
            </Field>
            <button type="button" className="btn btn-ghost w-fit" onClick={() => disconnect()}>
              <LogOut className="size-4" aria-hidden />
              Disconnect
            </button>
          </>
        ) : (
          <p className="text-sm" style={{ color: 'var(--subtle)' }}>
            No wallet connected. TrustPay never asks for or stores your private key or seed phrase.
          </p>
        )}
        {!CONTRACT_CONFIG.walletConnectProjectId && (
          <p className="text-xs text-pretty" style={{ color: 'var(--subtle)' }}>
            WalletConnect is off. Set VITE_WALLETCONNECT_PROJECT_ID in .env to enable it. Browser wallets such as MetaMask work without it.
          </p>
        )}
      </section>

      <section className="card grid gap-5 p-6" aria-label="Network">
        <h2 className="display text-lg">Network</h2>
        <Field label="Network">
          {CONTRACT_CONFIG.chainName} · chain ID {CONTRACT_CONFIG.chainId}
        </Field>
        <Field label="Explorer">
          <a href={CONTRACT_CONFIG.explorerUrl} target="_blank" rel="noopener noreferrer" className="underline">
            {CONTRACT_CONFIG.explorerUrl}
          </a>
        </Field>
        <Field label="USDC token (6 decimals)">
          <span className="mono break-all text-xs">{CONTRACT_CONFIG.usdcAddress}</span>
        </Field>
        <Field label="RPC endpoints (primary first)">
          <ul className="grid gap-1.5">
            {CONTRACT_CONFIG.rpcUrls.map((url, index) => {
              const result = probes?.find((p) => p.url === url)
              return (
                <li key={url} className="flex items-center justify-between gap-3 text-xs">
                  <span className="mono truncate">
                    {index === 0 ? 'Primary · ' : 'Backup · '}
                    {hostOf(url)}
                  </span>
                  {result && (
                    <span className="inline-flex shrink-0 items-center gap-1" style={{ color: result.ok ? 'var(--success)' : 'var(--danger)' }}>
                      {result.ok ? <CheckCircle2 className="size-3.5" aria-hidden /> : <CircleSlash className="size-3.5" aria-hidden />}
                      {result.ok ? `${result.ms} ms` : result.note}
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
          <button type="button" className="btn btn-ghost mt-2 w-fit" onClick={() => void testRpc()} disabled={testing}>
            {testing ? <Spinner /> : <Radio className="size-4" aria-hidden />}
            Test RPC endpoints
          </button>
        </Field>
      </section>

      <section className="card grid gap-5 p-6 lg:col-span-2" aria-label="TrustPay contract">
        <h2 className="display text-lg">TrustPay contract</h2>
        {contract.state === 'ready' && contract.address ? (
          <>
            <Field label="Address">
              <span className="mono break-all text-xs">{contract.address}</span>
              <ExplorerLink kind="address" value={contract.address} />
            </Field>
            <p className="text-sm" style={{ color: 'var(--success)' }}>
              Verified onchain. Payments go through the contract and can carry a note (up to {contract.maxNoteBytes} bytes).
            </p>
          </>
        ) : contract.state === 'checking' ? (
          <p className="inline-flex items-center gap-2 text-sm">
            <Spinner /> Verifying contract…
          </p>
        ) : contract.state === 'invalid' ? (
          <Notice tone="danger">{contract.reason} Payments use a direct USDC transfer until this is fixed.</Notice>
        ) : (
          <Notice tone="info">
            No contract configured. Payments are direct USDC transfers. After you deploy contracts/TrustPay.sol, set VITE_TRUSTPAY_CONTRACT_ADDRESS in .env
            (see config/contract.ts) and reload. No other change is needed.
          </Notice>
        )}
      </section>
      </div>
    </>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5 text-sm">
      <p className="label">{label}</p>
      <div className="grid gap-1.5">{children}</div>
    </div>
  )
}
