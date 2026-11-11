import { motion } from 'framer-motion'
import { AppShell } from '@/components/AppShell'
import { Dashboard } from '@/components/Dashboard'
import { HistoryPage } from '@/components/HistoryPage'
import { ReceivePage } from '@/components/ReceivePage'
import { SendPage } from '@/components/SendPage'
import { SettingsPage } from '@/components/SettingsPage'
import { HistoryProvider } from '@/hooks/history'
import type { ReactNode } from 'react'
import { usePathname } from '@/lib/router'

function Routes() {
  const pathname = usePathname()
  switch (pathname) {
    case '/send':
      return <SendPage />
    case '/receive':
      return <ReceivePage />
    case '/history':
      return <HistoryPage />
    case '/settings':
      return <SettingsPage />
    default:
      return <Dashboard />
  }
}

function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  return (
    <motion.div key={pathname} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24, ease: [0.25, 0.1, 0.25, 1] }}>
      {children}
    </motion.div>
  )
}

export default function App() {
  return (
    <HistoryProvider>
      <AppShell>
        <PageTransition>
          <Routes />
        </PageTransition>
      </AppShell>
    </HistoryProvider>
  )
}
