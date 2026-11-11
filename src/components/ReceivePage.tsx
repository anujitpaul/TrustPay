import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { QRCodeSVG } from 'qrcode.react'
import { RotateCcw, Share2, Sparkles } from 'lucide-react'
import { TokenUSDC } from '@web3icons/react'
import { useAccount } from 'wagmi'
import { buildShareLink } from '@/lib/share'
import { checkAmount, sanitizeAmountInput } from '@/lib/validate'
import { DEFAULT_MAX_NOTE_BYTES } from '@/lib/abi'
import { utf8Length } from '@/lib/format'
import { CopyButton, ConnectPrompt, PageTitle, Spinner } from '@/components/ui'

interface RequestLink {
  url: string
  amount?: string
}

export function ReceivePage() {
  const { address, isConnected } = useAccount()
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [request, setRequest] = useState<RequestLink | null>(null)
  const [generating, setGenerating] = useState(false)
  const [scanning, setScanning] = useState(false)

  const parsed = useMemo(() => checkAmount(amount), [amount])
  const noteTooLong = utf8Length(note) > DEFAULT_MAX_NOTE_BYTES
  const canShare = typeof navigator.share === 'function'

  if (!isConnected || !address) {
    return (
      <div className="mx-auto max-w-xl">
        <PageTitle title="Receive" subtitle="Get paid in USDC on Arc Mainnet." />
        <ConnectPrompt />
      </div>
    )
  }

  // The share base is resolved asynchronously (the app can be framed), so the link is built on demand.
  const generate = async () => {
    if (parsed.error || noteTooLong) return
    setGenerating(true)
    try {
      const query = new URLSearchParams({ to: address })
      if (parsed.raw !== undefined) query.set('amount', amount.trim())
      if (note.trim()) query.set('note', note.trim())
      const url = await buildShareLink(`/send?${query.toString()}`)
      setRequest({ url, amount: parsed.raw !== undefined ? amount.trim() : undefined })
      setScanning(true)
      setTimeout(() => setScanning(false), 900)
    } finally {
      setGenerating(false)
    }
  }

  const share = async () => {
    if (!request) return
    try {
      await navigator.share({ title: 'TrustPay payment request', text: 'Pay me in USDC on Arc Mainnet', url: request.url })
    } catch {
      // The share sheet was closed, or sharing is unavailable. Copy still works.
    }
  }

  const qrValue = request?.url ?? address

  return (
    <div className="mx-auto max-w-4xl">
      <PageTitle title="Receive" subtitle="Share your address or a payment request. Only send USDC on Arc Mainnet to this address." />

      <div className="grid gap-5 md:grid-cols-2">
        <section className="card hero flex flex-col items-center gap-5 p-6 sm:p-8" aria-label="Receive QR code">
          <div className="relative rounded-[1.5rem] bg-white p-5 shadow-[0_18px_50px_-20px_rgba(54,224,181,0.5)]">
            {/* Corner marks */}
            {['left-2 top-2 border-l-2 border-t-2 rounded-tl-xl', 'right-2 top-2 border-r-2 border-t-2 rounded-tr-xl', 'bottom-2 left-2 border-b-2 border-l-2 rounded-bl-xl', 'bottom-2 right-2 border-b-2 border-r-2 rounded-br-xl'].map((position) => (
              <span key={position} className={`pointer-events-none absolute size-5 ${position}`} style={{ borderColor: '#36E0B5' }} aria-hidden />
            ))}
            <div className="relative size-[208px] overflow-hidden sm:size-[232px]">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={qrValue}
                  initial={{ opacity: 0, scale: 0.9, filter: 'blur(6px)' }}
                  animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.26 }}
                  className="size-full"
                >
                  <QRCodeSVG value={qrValue} style={{ width: '100%', height: '100%' }} level="M" marginSize={0} bgColor="#ffffff" fgColor="#080D18" />
                </motion.div>
              </AnimatePresence>
              {scanning && (
                <span
                  className="pointer-events-none absolute inset-x-0 top-0 h-1/3"
                  style={{ background: 'linear-gradient(180deg, transparent, rgba(54,224,181,0.45), transparent)', animation: 'scan 0.9s ease-in-out' }}
                  aria-hidden
                />
              )}
            </div>
          </div>

          <p className="label">{request ? 'Payment request' : 'Your address'}</p>
          <p className="mono -mt-3 break-all text-center text-xs" style={{ color: 'var(--ink-2)' }}>
            {address}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2.5">
            <CopyButton value={address} label="Copy address" />
            {request && (
              <button type="button" className="btn btn-ghost !min-h-10" onClick={() => setRequest(null)}>
                <RotateCcw className="size-4" aria-hidden />
                Address only
              </button>
            )}
          </div>
        </section>

        <section className="card grid content-start gap-5 p-6" aria-label="Payment request">
          <div>
            <h2 className="display text-lg">Request a payment</h2>
            <p className="mt-1 text-xs text-pretty" style={{ color: 'var(--subtle)' }}>
              Optional. The link opens TrustPay with your address and the amount filled in, ready for the payer to review.
            </p>
          </div>
          <div>
            <label htmlFor="req-amount" className="label">
              Amount
            </label>
            <div className="relative mt-2">
              <input
                id="req-amount"
                className="field display pr-24 text-xl tabular-nums"
                inputMode="decimal"
                placeholder="Any amount"
                value={amount}
                onChange={(event) => {
                  const next = sanitizeAmountInput(event.target.value)
                  if (next !== null) setAmount(next)
                }}
              />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center gap-1.5 text-xs font-semibold" style={{ color: 'var(--subtle)' }}>
                <TokenUSDC variant="branded" size={18} />
                USDC
              </span>
            </div>
            <p className="mt-1.5 min-h-5 text-xs" style={{ color: 'var(--danger)' }}>
              {parsed.error ?? ' '}
            </p>
          </div>
          <div>
            <label htmlFor="req-note" className="label">
              Note (optional)
            </label>
            <input id="req-note" className="field mt-2" placeholder="What is this for?" value={note} onChange={(event) => setNote(event.target.value)} />
            <p className="mt-1.5 text-xs" style={{ color: noteTooLong ? 'var(--danger)' : 'var(--subtle)' }}>
              {noteTooLong ? `Too long (${utf8Length(note)}/${DEFAULT_MAX_NOTE_BYTES} bytes).` : 'Anyone with the link can read this note.'}
            </p>
          </div>

          <button type="button" className="btn btn-primary w-full" onClick={() => void generate()} disabled={generating || Boolean(parsed.error) || noteTooLong}>
            {generating ? <Spinner /> : <Sparkles className="size-4" aria-hidden />}
            {generating ? 'Generating…' : request ? 'Update payment request' : 'Generate payment request'}
          </button>

          <AnimatePresence>
            {request && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }}>
                <p className="label">Payment request link</p>
                <p className="card-inner mono mt-2 break-all p-3 text-xs">{request.url}</p>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <CopyButton value={request.url} label="Copy link" />
                  {canShare ? (
                    <button type="button" className="btn btn-ghost !min-h-10" onClick={() => void share()}>
                      <Share2 className="size-4" aria-hidden />
                      Share
                    </button>
                  ) : (
                    <span />
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </div>
    </div>
  )
}
