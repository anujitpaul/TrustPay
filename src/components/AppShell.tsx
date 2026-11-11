import type { ReactNode } from 'react'
import { ConnectKitButton } from 'connectkit'
import { motion } from 'framer-motion'
import { ArrowDownLeft, ArrowUpRight, History, LayoutDashboard, Moon, Settings, Sun, Wallet } from 'lucide-react'
import { CONTRACT_CONFIG } from '../../config/contract'
import { Link, usePathname } from '@/lib/router'
import { useChainStatus } from '@/hooks/useUsdcBalance'
import { useTheme } from '@/hooks/useTheme'
import { useWalletNetwork } from '@/hooks/useWalletNetwork'
import { shortAddress } from '@/lib/format'
import { LogoMark, Wordmark } from '@/components/Logo'
import { Notice, Spinner } from '@/components/ui'

export const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/send', label: 'Send', icon: ArrowUpRight },
  { to: '/receive', label: 'Receive', icon: ArrowDownLeft },
  { to: '/history', label: 'History', icon: History },
  { to: '/settings', label: 'Settings', icon: Settings },
] as const

const SPRING = { type: 'spring', stiffness: 420, damping: 34 } as const

export function NetworkBadge({ compact = false }: { compact?: boolean }) {
  const { isConnected, wrongNetwork } = useWalletNetwork()
  const status = useChainStatus()
  const online = status.data?.chainId === CONTRACT_CONFIG.chainId
  const color = wrongNetwork ? 'var(--warn)' : status.isError ? 'var(--danger)' : online ? 'var(--success)' : 'var(--subtle)'
  const label = wrongNetwork ? 'Wrong network' : status.isError ? 'RPC offline' : isConnected || online ? 'Arc Mainnet' : 'Connecting…'
  return (
    <span
      className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold"
      style={{ background: 'var(--inner)', border: '1px solid var(--border)', color: 'var(--ink-2)' }}
    >
      <span className="relative flex size-2">
        {online && !wrongNetwork && <span className="absolute inline-flex size-full animate-ping rounded-full opacity-50" style={{ background: color }} />}
        <span className="relative inline-flex size-2 rounded-full" style={{ background: color }} />
      </span>
      {compact ? (wrongNetwork ? 'Switch' : 'Arc') : label}
    </span>
  )
}

export function ThemeToggle() {
  const { theme, toggle } = useTheme()
  const next = theme === 'dark' ? 'light' : 'dark'
  return (
    <button type="button" className="btn btn-ghost !min-h-10 !w-10 !px-0" onClick={toggle} aria-label={`Switch to ${next} mode`} title={`Switch to ${next} mode`}>
      {theme === 'dark' ? <Sun className="size-4" aria-hidden /> : <Moon className="size-4" aria-hidden />}
    </button>
  )
}

function WalletButton() {
  return (
    <ConnectKitButton.Custom>
      {({ isConnected, isConnecting, show, address }) => (
        <button type="button" className="btn btn-ghost !min-h-10 !px-3.5" onClick={show} disabled={isConnecting}>
          {isConnecting ? <Spinner /> : <Wallet className="size-4" aria-hidden />}
          <span className="mono text-xs">{isConnected && address ? shortAddress(address) : isConnecting ? 'Connecting…' : 'Connect'}</span>
        </button>
      )}
    </ConnectKitButton.Custom>
  )
}

function NetworkBanner() {
  // Mounted once, so it owns the automatic switch to Arc Mainnet after connecting.
  const { wrongNetwork, switchToArc, isSwitching } = useWalletNetwork({ autoSwitch: true })
  if (!wrongNetwork) return null
  return (
    <div className="mb-5">
      <Notice tone="warn">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span>Your wallet is on a different network. TrustPay works on Arc Mainnet (chain ID {CONTRACT_CONFIG.chainId}).</span>
          <button type="button" className="btn btn-primary !min-h-10" onClick={switchToArc} disabled={isSwitching}>
            {isSwitching && <Spinner />}
            Switch to Arc Mainnet
          </button>
        </div>
      </Notice>
    </div>
  )
}

function Sidebar({ pathname }: { pathname: string }) {
  return (
    <aside
      className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r p-5 lg:flex"
      style={{ borderColor: 'var(--border)', background: 'var(--header-bg)', backdropFilter: 'blur(20px)' }}
    >
      <Link to="/" className="flex items-center gap-3 px-2 py-1" aria-label="TrustPay home">
        <LogoMark size={38} />
        <Wordmark showTagline />
      </Link>
      <nav className="mt-9" aria-label="Main">
        <ul className="grid gap-1">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => {
            const active = pathname === to
            return (
              <li key={to}>
                <Link to={to} className="nav-link relative min-h-11 px-3.5" aria-current={active ? 'page' : undefined}>
                  {active && (
                    <motion.span
                      layoutId="sidebar-pill"
                      className="absolute inset-0 rounded-[0.875rem]"
                      style={{ background: 'var(--surface-strong)', boxShadow: 'inset 0 0 0 1px var(--border)' }}
                      transition={SPRING}
                    />
                  )}
                  <span className="relative flex items-center gap-3">
                    <Icon className="size-[18px]" style={{ color: active ? 'var(--accent)' : undefined }} aria-hidden />
                    {label}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
      <div className="mt-auto grid gap-3">
        <NetworkBadge />
        <p className="px-1 text-[11px] text-pretty" style={{ color: 'var(--subtle)' }}>
          Non-custodial. TrustPay never sees your keys.
        </p>
      </div>
    </aside>
  )
}

function BottomNav({ pathname }: { pathname: string }) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t lg:hidden"
      style={{ borderColor: 'var(--border)', background: 'var(--header-bg)', backdropFilter: 'blur(20px)', paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Main"
    >
      <ul className="mx-auto grid max-w-md grid-cols-5 px-2 pt-1.5">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => {
          const active = pathname === to
          return (
            <li key={to}>
              <Link to={to} className="relative flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-[10.5px] font-semibold" aria-current={active ? 'page' : undefined} style={{ color: active ? 'var(--ink)' : 'var(--subtle)' }}>
                {active && <motion.span layoutId="bottom-bar" className="absolute inset-x-4 -top-1.5 h-0.5 rounded-full" style={{ background: 'var(--btn-gradient)' }} transition={SPRING} />}
                <Icon className="size-5" style={{ color: active ? 'var(--accent)' : undefined }} aria-hidden />
                {label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  return (
    <div className="min-h-dvh">
      <Sidebar pathname={pathname} />
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 border-b backdrop-blur-xl" style={{ borderColor: 'var(--border)', background: 'var(--header-bg)' }}>
          <div className="mx-auto flex h-16 max-w-4xl items-center justify-between gap-3 px-4 lg:px-8">
            <Link to="/" className="flex items-center gap-2.5 lg:hidden" aria-label="TrustPay home">
              <LogoMark size={32} />
              <Wordmark />
            </Link>
            <span className="hidden text-sm font-semibold lg:block" style={{ color: 'var(--subtle)' }}>
              Simple. Secure. Seamless.
            </span>
            <div className="flex items-center gap-2">
              <span className="lg:hidden">
                <NetworkBadge compact />
              </span>
              <span className="hidden lg:block">
                <NetworkBadge />
              </span>
              <ThemeToggle />
              <WalletButton />
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-4xl px-4 pb-32 pt-6 lg:px-8 lg:pb-14 lg:pt-8">
          <NetworkBanner />
          {children}
        </main>
      </div>
      <BottomNav pathname={pathname} />
    </div>
  )
}
