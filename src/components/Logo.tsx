import { useId } from 'react'

/**
 * TrustPay mark: a rounded shield (trust) with a send arrow cut into it (payment).
 * Two shapes, one gradient, no decoration.
 */
export function LogoMark({ size = 36 }: { size?: number }) {
  const id = useId()
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" role="img" aria-label="TrustPay logo">
      <defs>
        <linearGradient id={`${id}-g`} x1="4" y1="3" x2="28" y2="30" gradientUnits="userSpaceOnUse">
          <stop stopColor="#36E0B5" />
          <stop offset="1" stopColor="#54C8F5" />
        </linearGradient>
      </defs>
      <path
        d="M16 2.5 5 6.6v8.3c0 6.9 4.6 11.6 11 14.6 6.4-3 11-7.7 11-14.6V6.6L16 2.5Z"
        fill={`url(#${id}-g)`}
      />
      <path d="M12 20 20.5 11.5M13.2 11.5h7.3v7.3" stroke="#04140F" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function Wordmark({ showTagline = false }: { showTagline?: boolean }) {
  return (
    <span className="flex flex-col leading-none">
      <span className="display text-[1.35rem] font-extrabold">TrustPay</span>
      {showTagline && (
        <span className="mt-1 text-[10px] font-semibold tracking-wide" style={{ color: 'var(--subtle)' }}>
          Simple. Secure. Seamless.
        </span>
      )}
    </span>
  )
}
