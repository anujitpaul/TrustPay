import { useState, type ReactNode } from 'react'
import { ConnectKitButton } from 'connectkit'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, ArrowUpRight, Check, Copy, Gauge, KeyRound, Loader2, Wallet } from 'lucide-react'
import { toast } from 'sonner'
import { explorerAddressUrl, explorerTxUrl } from '../../config/contract'
import { LogoMark } from '@/components/Logo'

export function PageTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-6">
      <h1 className="display text-[1.75rem] text-balance sm:text-3xl">{title}</h1>
      {subtitle && (
        <p className="mt-1.5 max-w-prose text-sm text-pretty" style={{ color: 'var(--subtle)' }}>
          {subtitle}
        </p>
      )}
    </div>
  )
}

export function Spinner({ className = 'size-4' }: { className?: string }) {
  return <Loader2 className={`${className} animate-spin`} aria-hidden />
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden />
}

export function Notice({ tone = 'warn', children }: { tone?: 'warn' | 'danger' | 'info'; children: ReactNode }) {
  const color = tone === 'danger' ? 'var(--danger)' : tone === 'info' ? 'var(--accent-2)' : 'var(--warn)'
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className="flex items-start gap-3 rounded-2xl p-3.5 text-sm text-pretty"
      style={{ background: `color-mix(in srgb, ${color} 9%, transparent)`, border: `1px solid color-mix(in srgb, ${color} 38%, transparent)`, color: 'var(--ink-2)' }}
    >
      <AlertTriangle className="mt-0.5 size-4 shrink-0" style={{ color }} aria-hidden />
      <div className="min-w-0">{children}</div>
    </div>
  )
}

export function CopyButton({ value, label = 'Copy', disabled }: { value: string; label?: string; disabled?: boolean }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      toast.success('Copied to clipboard')
      setTimeout(() => setCopied(false), 1600)
    } catch {
      toast.error('Could not copy. Select the text and copy it manually.')
    }
  }
  return (
    <button type="button" className="btn btn-ghost !min-h-10" onClick={() => void copy()} disabled={disabled || !value}>
      <span className="relative flex size-4 items-center justify-center">
        <AnimatePresence mode="wait" initial={false}>
          {copied ? (
            <motion.span key="done" initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.4, opacity: 0 }} transition={{ duration: 0.14 }}>
              <Check className="size-4" style={{ color: 'var(--success)' }} aria-hidden />
            </motion.span>
          ) : (
            <motion.span key="copy" initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.4, opacity: 0 }} transition={{ duration: 0.14 }}>
              <Copy className="size-4" aria-hidden />
            </motion.span>
          )}
        </AnimatePresence>
      </span>
      <span style={{ color: copied ? 'var(--success)' : undefined }}>{copied ? 'Copied' : label}</span>
    </button>
  )
}

export function ExplorerLink({ kind, value, children }: { kind: 'tx' | 'address'; value: string; children?: ReactNode }) {
  const href = kind === 'tx' ? explorerTxUrl(value) : explorerAddressUrl(value)
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-xs font-semibold underline-offset-2 hover:underline"
      style={{ color: 'var(--accent)' }}
    >
      {children ?? 'View on Arc Explorer'}
      <ArrowUpRight className="size-3" aria-hidden />
    </a>
  )
}

export function StatusBadge({ status }: { status: 'confirmed' | 'pending' | 'failed' }) {
  const map = {
    confirmed: { label: 'Confirmed', color: 'var(--success)' },
    pending: { label: 'Pending', color: 'var(--warn)' },
    failed: { label: 'Failed', color: 'var(--danger)' },
  } as const
  const { label, color } = map[status]
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold"
      style={{ color, background: `color-mix(in srgb, ${color} 12%, transparent)` }}
    >
      <span className="size-1.5 rounded-full" style={{ background: color }} aria-hidden />
      {label}
    </span>
  )
}

/** A big money figure: whole part prominent, cents softer. `text` is already formatted (for example "1,234.50"). */
export function AmountDisplay({ text, className = 'text-5xl' }: { text: string; className?: string }) {
  const [whole, cents] = text.split('.')
  return (
    <span className={`display tabular-nums ${className}`}>
      {whole}
      {cents !== undefined && <span style={{ color: 'var(--subtle)' }}>.{cents}</span>}
    </span>
  )
}

/** Animated success mark. Draws the check once, on mount. */
export function SuccessCheck({ size = 72 }: { size?: number }) {
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <motion.span
        className="absolute inset-0 rounded-full"
        style={{ background: 'color-mix(in srgb, var(--success) 18%, transparent)' }}
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      />
      <motion.span
        className="absolute inset-0 rounded-full"
        style={{ border: '2px solid var(--success)' }}
        initial={{ scale: 0.9, opacity: 0.7 }}
        animate={{ scale: 1.5, opacity: 0 }}
        transition={{ duration: 0.9, ease: 'easeOut' }}
      />
      <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24" fill="none" aria-hidden>
        <motion.path
          d="M5 12.5 10 17.5 19 7.5"
          stroke="var(--success)"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ delay: 0.15, duration: 0.4, ease: 'easeOut' }}
        />
      </svg>
    </div>
  )
}

const FEATURES = [
  { icon: KeyRound, text: 'Non-custodial' },
  { icon: Gauge, text: 'Sub-second finality' },
  { icon: Wallet, text: 'Fees paid in USDC' },
]

export function ConnectPrompt({ title, body }: { title?: string; body?: string }) {
  return (
    <div className="card hero flex flex-col items-center gap-6 px-6 py-12 text-center sm:py-16">
      <LogoMark size={56} />
      <div>
        <h2 className="display text-3xl text-balance sm:text-4xl">{title ?? 'Simple. Secure. Seamless.'}</h2>
        <p className="mx-auto mt-3 max-w-md text-sm text-pretty" style={{ color: 'var(--subtle)' }}>
          {body ?? 'Send and receive USDC on Arc Mainnet. Connect MetaMask, WalletConnect or another EVM wallet. TrustPay never asks for your seed phrase or private key.'}
        </p>
      </div>
      <ConnectKitButton.Custom>
        {({ show, isConnecting }) => (
          <button type="button" className="btn btn-primary min-w-48" onClick={show} disabled={isConnecting}>
            {isConnecting ? <Spinner /> : <Wallet className="size-4" aria-hidden />}
            {isConnecting ? 'Connecting…' : 'Connect wallet'}
          </button>
        )}
      </ConnectKitButton.Custom>
      <ul className="flex flex-wrap items-center justify-center gap-2">
        {FEATURES.map(({ icon: Icon, text }) => (
          <li key={text} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold" style={{ background: 'var(--inner)', border: '1px solid var(--border)', color: 'var(--muted)' }}>
            <Icon className="size-3.5" style={{ color: 'var(--accent)' }} aria-hidden />
            {text}
          </li>
        ))}
      </ul>
    </div>
  )
}
