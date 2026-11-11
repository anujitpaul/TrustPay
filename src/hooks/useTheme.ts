import { useCallback, useSyncExternalStore } from 'react'

export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'trustpay:theme'
const CHANGE_EVENT = 'trustpay:theme-change'
const META_COLORS: Record<Theme, string> = { light: '#F3F6FB', dark: '#080D18' }

function readTheme(): Theme {
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'
}

function subscribe(callback: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, callback)
  return () => window.removeEventListener(CHANGE_EVENT, callback)
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', META_COLORS[theme])
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // Storage can be disabled. The theme still applies for this visit.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

/** Light or dark. Dark is the TrustPay default; a saved choice wins afterwards. */
export function useTheme(): { theme: Theme; toggle: () => void } {
  const theme: Theme = useSyncExternalStore(subscribe, readTheme, (): Theme => 'dark')
  const toggle = useCallback(() => applyTheme(readTheme() === 'dark' ? 'light' : 'dark'), [])
  return { theme, toggle }
}
