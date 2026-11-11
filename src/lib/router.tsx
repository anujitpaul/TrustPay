import { useCallback, useSyncExternalStore, type AnchorHTMLAttributes, type MouseEvent, type ReactNode } from 'react'

/** Tiny history-API router. Paths and query strings stay shareable and survive reloads. */

const NAV_EVENT = 'trustpay:navigate'

function subscribe(callback: () => void): () => void {
  window.addEventListener('popstate', callback)
  window.addEventListener(NAV_EVENT, callback)
  return () => {
    window.removeEventListener('popstate', callback)
    window.removeEventListener(NAV_EVENT, callback)
  }
}

const getLocation = () => window.location.pathname + window.location.search

export function useLocationKey(): string {
  return useSyncExternalStore(subscribe, getLocation, getLocation)
}

export function navigate(to: string, options: { replace?: boolean } = {}): void {
  if (to === getLocation()) return
  if (options.replace) window.history.replaceState(null, '', to)
  else window.history.pushState(null, '', to)
  window.dispatchEvent(new Event(NAV_EVENT))
  window.scrollTo({ top: 0 })
}

export function usePathname(): string {
  useLocationKey()
  const path = window.location.pathname.replace(/\/+$/, '')
  return path === '' ? '/' : path
}

export function useSearchParams(): URLSearchParams {
  const key = useLocationKey()
  const search = key.includes('?') ? key.slice(key.indexOf('?')) : ''
  return new URLSearchParams(search)
}

interface LinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  to: string
  children: ReactNode
}

export function Link({ to, children, onClick, ...rest }: LinkProps) {
  const handle = useCallback(
    (event: MouseEvent<HTMLAnchorElement>) => {
      onClick?.(event)
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return
      event.preventDefault()
      navigate(to)
    },
    [onClick, to],
  )
  return (
    <a href={to} onClick={handle} {...rest}>
      {children}
    </a>
  )
}
