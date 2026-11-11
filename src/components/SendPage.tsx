import { useMemo, useState } from 'react'
import { ArrowRight, ClipboardPaste, Fuel, ShieldAlert } from 'lucide-react'
import { TokenUSDC } from '@web3icons/react'
import { useAccount } from 'wagmi'
import { CONTRACT_CONFIG } from '../../config/contract'
import { useSearchParams } from '@/lib/router'
import { useFeeParams, useUsdcBalance } from '@/hooks/useUsdcBalance'
import { useTrustPayContract } from '@/hooks/useTrustPayContract'
import { useSendFee } from '@/hooks/useSendFee'
import { useSendPayment } from '@/hooks/useSendPayment'
import { useWalletNetwork } from '@/hooks/useWalletNetwork'
import { DEFAULT_MAX_NOTE_BYTES } from '@/lib/abi'
import { MAX_RESERVE_GAS } from '@/lib/fees'
import { formatNativeUsdc, formatUsdcAmount, plainUsdc, shortAddress, utf8Length } from '@/lib/format'
import { checkAmount, checkRecipient, sanitizeAmountInput } from '@/lib/validate'
import { AmountDisplay, ConnectPrompt, Notice, PageTitle, Spinner } from '@/components/ui'
import { SendProgress } from '@/components/SendProgress'

const SCALE = 10n ** 12n

export function SendPage() {
  const { address, isConnected } = useAccount()
  const { wrongNetwork, switchToArc, isSwitching } = useWalletNetwork()
  const params = useSearchParams()
  const balance = useUsdcBalance(address)
  const feeParams = useFeeParams()
  const contract = useTrustPayContract()
  const { state, send, reset } = useSendPayment()

  const [to, setTo] = useState(() => params.get('to') ?? '')
  const [amount, setAmount] = useState(() => {
    const incoming = params.get('amount') ?? ''
    return sanitizeAmountInput(incoming) ?? ''
  })
  const [note, setNote] = useState(() => (params.get('note') ?? '').slice(0, DEFAULT_MAX_NOTE_BYTES))
  const [reviewing, setReviewing] = useState(false)

  const useContract = contract.state === 'ready'
  const maxNote = contract.state === 'ready' ? contract.maxNoteBytes : DEFAULT_MAX_NOTE_BYTES

  const recipient = useMemo(() => {
    const blocked = [{ address: CONTRACT_CONFIG.usdcAddress, reason: 'This is the USDC token contract. Funds sent to it would be lost.' }]
    if (CONTRACT_CONFIG.trustPayAddress) {
      blocked.push({ address: CONTRACT_CONFIG.trustPayAddress, reason: 'This is the TrustPay contract. Funds sent to it would be lost.' })
    }
    return checkRecipient(to, address, blocked)
  }, [to, address])
  const parsed = useMemo(() => checkAmount(amount), [amount])

  const reserve = feeParams.data ? MAX_RESERVE_GAS * feeParams.data.maxFeePerGas : undefined
  const reserveUsdc = reserve === undefined ? 0n : (reserve + SCALE - 1n) / SCALE
  const noteBytes = utf8Length(note)

  let amountError = parsed.error
  if (!amountError && parsed.raw !== undefined && balance.data !== undefined) {
    if (parsed.raw > balance.data) amountError = 'Amount is more than your USDC balance.'
    else if (reserve !== undefined && parsed.raw + reserveUsdc > balance.data) {
      amountError = 'Leave a little USDC to cover the network fee.'
    }
  }
  const noteError = noteBytes > maxNote ? `Note is too long (${noteBytes}/${maxNote} bytes).` : undefined

  const valid = Boolean(recipient.address && parsed.raw && !amountError && !noteError)
  const estimate = useSendFee({
    owner: address,
    to: valid ? recipient.address : undefined,
    amount: valid ? parsed.raw : undefined,
    note: useContract ? note : '',
    useContract,
  })

  const setMax = () => {
    if (balance.data === undefined || reserve === undefined) return
    const max = balance.data > reserveUsdc ? balance.data - reserveUsdc : 0n
    setAmount(plainUsdc(max))
  }

  const paste = async () => {
    try {
      setTo((await navigator.clipboard.readText()).trim())
    } catch {
      // Clipboard access can be denied. The field still accepts typing and pasting.
    }
  }

  const clearForm = () => {
    setTo('')
    setAmount('')
    setNote('')
    setReviewing(false)
    reset()
  }

  if (!isConnected || !address) {
    return (
      <div className="mx-auto max-w-xl">
        <PageTitle title="Send" subtitle="Send USDC to any wallet on Arc Mainnet." />
        <ConnectPrompt />
      </div>
    )
  }

  if (state.phase !== 'idle') {
    return (
      <div className="mx-auto max-w-xl">
        <PageTitle title="Send" />
        <SendProgress
          state={state}
          amountLabel={parsed.raw !== undefined ? formatUsdcAmount(parsed.raw, 2) : amount}
          onDone={clearForm}
          onBack={reset}
        />
      </div>
    )
  }

  const submit = () => {
    if (!valid || !recipient.address || parsed.raw === undefined) return
    void send({ to: recipient.address, amount: parsed.raw, note: useContract ? note.trim() : '', useContract })
  }

  const feeLine = !valid ? (
    <span style={{ color: 'var(--subtle)' }}>Shown once the payment is valid</span>
  ) : estimate.isPending && estimate.fetchStatus !== 'idle' ? (
    <span className="inline-flex items-center gap-2">
      <Spinner className="size-3.5" /> Estimating…
    </span>
  ) : estimate.data ? (
    <>up to {formatNativeUsdc(estimate.data.fee, 5)} USDC</>
  ) : (
    <span style={{ color: 'var(--subtle)' }}>Your wallet will show the exact fee</span>
  )

  if (reviewing && valid && recipient.address && parsed.raw !== undefined) {
    return (
      <div className="mx-auto max-w-xl">
        <PageTitle title="Review payment" subtitle="Check every detail. Payments on Arc Mainnet are final and cannot be reversed." />
        <section className="card hero p-6 sm:p-7" aria-label="Payment summary">
          <p className="label">You send</p>
          <p className="mt-2 flex items-baseline gap-2">
            <AmountDisplay text={formatUsdcAmount(parsed.raw, 2)} className="text-5xl sm:text-6xl" />
            <span className="text-base font-semibold" style={{ color: 'var(--subtle)' }}>
              USDC
            </span>
          </p>
          <dl className="card-inner mt-6 grid gap-4 p-4 text-sm">
            <Row label="To">
              <span className="mono break-all text-xs">{recipient.address}</span>
            </Row>
            <Row label="Network">Arc Mainnet ({CONTRACT_CONFIG.chainId})</Row>
            <Row label="Method">{useContract ? 'TrustPay contract (records your note)' : 'Direct USDC transfer'}</Row>
            {note.trim() && useContract && <Row label="Note">{note.trim()}</Row>}
            <Row label="Network fee">
              {feeLine}
              {estimate.data?.needsApproval && (
                <span className="mt-0.5 block text-xs" style={{ color: 'var(--subtle)' }}>
                  Two wallet confirmations: approve exactly {formatUsdcAmount(parsed.raw, 2)} USDC, then pay. Fee shown is for the approval.
                </span>
              )}
            </Row>
          </dl>
          <div className="mt-4">
            <Notice tone="warn">Real USDC moves on Arc Mainnet. Double-check the address: a payment to the wrong address cannot be recovered.</Notice>
          </div>
          <div className="mt-6 grid grid-cols-[1fr_2fr] gap-3">
            <button type="button" className="btn btn-ghost" onClick={() => setReviewing(false)}>
              Edit
            </button>
            {wrongNetwork ? (
              <button type="button" className="btn btn-primary" onClick={switchToArc} disabled={isSwitching}>
                {isSwitching && <Spinner />}
                Switch network
              </button>
            ) : (
              <button type="button" className="btn btn-primary" onClick={submit}>
                Confirm &amp; Send
                <ArrowRight className="size-4" aria-hidden />
              </button>
            )}
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-xl">
      <PageTitle title="Send" subtitle="Send USDC to any wallet on Arc Mainnet." />
      <form
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault()
          if (valid) setReviewing(true)
        }}
      >
        <section className="card hero p-6 text-center sm:p-8">
          <label htmlFor="amount" className="label">
            Amount
          </label>
          <div className="mt-4 flex items-center justify-center gap-3">
            <input
              id="amount"
              inputMode="decimal"
              className="display w-full min-w-0 bg-transparent text-center text-6xl tabular-nums outline-none placeholder:opacity-25 sm:text-7xl"
              placeholder="0"
              value={amount}
              onChange={(event) => {
                const next = sanitizeAmountInput(event.target.value)
                if (next !== null) setAmount(next)
              }}
              aria-invalid={Boolean(amount && amountError)}
              aria-describedby="amount-help"
              autoComplete="off"
            />
          </div>
          <div className="mt-3 flex justify-center">
            <span className="inline-flex items-center gap-2 rounded-full py-1.5 pl-2 pr-3.5 text-sm font-semibold" style={{ background: 'var(--inner)', border: '1px solid var(--border)' }}>
              <TokenUSDC variant="branded" size={22} />
              USDC
              <span className="text-xs font-medium" style={{ color: 'var(--subtle)' }}>
                on Arc
              </span>
            </span>
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2" role="group" aria-label="Quick amounts">
            {['5', '10', '25', '50'].map((preset) => (
              <button key={preset} type="button" className="chip" aria-pressed={amount === preset} onClick={() => setAmount(preset)}>
                {preset}
              </button>
            ))}
            <button type="button" className="chip" disabled={balance.data === undefined || reserve === undefined} onClick={setMax}>
              Max
            </button>
          </div>
          <p className="mt-4 text-xs" style={{ color: 'var(--subtle)' }}>
            {balance.data !== undefined ? `Balance ${formatUsdcAmount(balance.data, 2)} USDC` : balance.isError ? 'Balance unavailable' : 'Loading balance…'}
          </p>
          <p id="amount-help" className="mt-1 min-h-5 text-xs font-medium" style={{ color: 'var(--danger)' }}>
            {amountError ?? ' '}
          </p>
        </section>

        <section className="card grid gap-5 p-5 sm:p-6">
          <div>
            <label htmlFor="recipient" className="label">
              Recipient address
            </label>
            <div className="mt-2 flex gap-2">
              <input
                id="recipient"
                className="field mono text-sm"
                placeholder="0x…"
                value={to}
                onChange={(event) => setTo(event.target.value)}
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                aria-invalid={Boolean(to.trim() && recipient.error)}
                aria-describedby="recipient-help"
              />
              <button type="button" className="btn btn-ghost !px-3.5" onClick={() => void paste()} aria-label="Paste address">
                <ClipboardPaste className="size-4" aria-hidden />
              </button>
            </div>
            <p id="recipient-help" className="mt-1.5 min-h-5 text-xs" style={{ color: recipient.error ? 'var(--danger)' : 'var(--subtle)' }}>
              {recipient.error ?? (recipient.address ? `Sending to ${shortAddress(recipient.address)}` : 'Paste the full address. Double-check it.')}
            </p>
          </div>

          <div>
            <label htmlFor="note" className="label">
              Note (optional)
            </label>
            <input
              id="note"
              className="field mt-2"
              placeholder={useContract ? 'What is this for?' : 'Notes need the TrustPay contract'}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              disabled={!useContract}
              aria-describedby="note-help"
            />
            <p id="note-help" className="mt-1.5 text-xs" style={{ color: noteError ? 'var(--danger)' : 'var(--subtle)' }}>
              {noteError ??
                (useContract
                  ? `Saved publicly onchain with the payment (${noteBytes}/${maxNote} bytes).`
                  : contract.state === 'checking'
                    ? 'Checking the TrustPay contract…'
                    : contract.state === 'invalid'
                      ? 'The configured TrustPay contract could not be verified, so notes are off.'
                      : 'Set the deployed TrustPay address in config/contract.ts to attach notes.')}
            </p>
          </div>

          <div className="card-inner flex items-center justify-between gap-3 px-4 py-3 text-sm">
            <span className="inline-flex items-center gap-2" style={{ color: 'var(--subtle)' }}>
              <Fuel className="size-4" aria-hidden />
              Network fee
            </span>
            <span className="text-right font-semibold tabular-nums">{feeLine}</span>
          </div>
        </section>

        <button type="submit" className="btn btn-primary w-full !min-h-14 text-base" disabled={!valid || wrongNetwork}>
          Review payment
          <ArrowRight className="size-4" aria-hidden />
        </button>
        {wrongNetwork && (
          <p className="flex items-center justify-center gap-2 text-xs" style={{ color: 'var(--warn)' }}>
            <ShieldAlert className="size-3.5" aria-hidden /> Switch your wallet to Arc Mainnet to continue.
          </p>
        )}
      </form>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-0.5 sm:grid-cols-[110px_1fr] sm:gap-3">
      <dt className="label pt-0.5">{label}</dt>
      <dd className="min-w-0 font-medium">{children}</dd>
    </div>
  )
}
