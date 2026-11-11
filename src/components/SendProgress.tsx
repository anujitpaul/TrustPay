import { motion } from 'framer-motion'
import { XCircle } from 'lucide-react'
import type { SendState } from '@/hooks/useSendPayment'
import { ExplorerLink, Spinner, SuccessCheck } from '@/components/ui'

interface Props {
  state: SendState
  amountLabel: string
  onDone: () => void
  onBack: () => void
}

const COPY: Record<string, { title: string; body: string }> = {
  switching: { title: 'Switching network', body: 'Approve the network switch to Arc Mainnet in your wallet.' },
  'approve-wallet': {
    title: 'Approve in your wallet',
    body: 'Allow TrustPay to move exactly this payment amount of USDC. Nothing more is approved.',
  },
  'approve-confirming': { title: 'Confirming approval', body: 'Approval submitted. Waiting for the network to confirm it.' },
  'pay-wallet': { title: 'Confirm the payment', body: 'Review and confirm the payment in your wallet.' },
  'pay-confirming': { title: 'Confirming payment', body: 'Payment submitted. Waiting for the network to confirm it.' },
}

const enter = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.28 } }

export function SendProgress({ state, amountLabel, onDone, onBack }: Props) {
  if (state.phase === 'success' && state.hash) {
    return (
      <motion.div {...enter} className="card hero flex flex-col items-center gap-5 p-8 text-center" role="status">
        <SuccessCheck />
        <div>
          <h2 className="display text-2xl">Payment confirmed</h2>
          <p className="mt-1.5 text-sm" style={{ color: 'var(--subtle)' }}>
            {amountLabel} USDC was confirmed on Arc Mainnet.
          </p>
        </div>
        <div className="card-inner w-full p-4 text-left">
          <p className="label">Transaction hash</p>
          <p className="mono mt-1.5 break-all text-xs">{state.hash}</p>
          <div className="mt-2.5">
            <ExplorerLink kind="tx" value={state.hash} />
          </div>
        </div>
        <button type="button" className="btn btn-primary w-full" onClick={onDone}>
          Done
        </button>
      </motion.div>
    )
  }

  if (state.phase === 'failed') {
    const hash = state.hash ?? state.approvalHash
    return (
      <motion.div {...enter} className="card flex flex-col items-center gap-5 p-8 text-center" role="alert">
        <span className="flex size-[72px] items-center justify-center rounded-full" style={{ background: 'color-mix(in srgb, var(--danger) 14%, transparent)' }}>
          <XCircle className="size-9" style={{ color: 'var(--danger)' }} aria-hidden />
        </span>
        <div>
          <h2 className="display text-2xl">{state.unconfirmed ? 'Not confirmed yet' : 'Payment failed'}</h2>
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-pretty" style={{ color: 'var(--subtle)' }}>
            {state.error}
          </p>
        </div>
        {hash && (
          <div className="card-inner w-full p-4 text-left">
            <p className="label">Transaction hash</p>
            <p className="mono mt-1.5 break-all text-xs">{hash}</p>
            <div className="mt-2.5">
              <ExplorerLink kind="tx" value={hash} />
            </div>
          </div>
        )}
        <button type="button" className="btn btn-ghost w-full" onClick={onBack}>
          Back to payment
        </button>
      </motion.div>
    )
  }

  const copy = COPY[state.phase] ?? COPY.switching
  const hash = state.hash ?? state.approvalHash
  return (
    <motion.div {...enter} className="card flex flex-col items-center gap-5 p-8 text-center" role="status" aria-live="polite">
      <span className="flex size-[72px] items-center justify-center rounded-full" style={{ background: 'color-mix(in srgb, var(--accent) 12%, transparent)', color: 'var(--accent)' }}>
        <Spinner className="size-8" />
      </span>
      <div>
        <h2 className="display text-2xl">{copy.title}</h2>
        <p className="mx-auto mt-1.5 max-w-sm text-sm text-pretty" style={{ color: 'var(--subtle)' }}>
          {copy.body}
        </p>
      </div>
      {hash && <ExplorerLink kind="tx" value={hash} />}
      <p className="text-xs" style={{ color: 'var(--subtle)' }}>
        Keep this tab open until the payment is confirmed.
      </p>
    </motion.div>
  )
}
