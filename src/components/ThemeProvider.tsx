'use client'
import { createContext, useContext, useMemo, useSyncExternalStore } from 'react'

type Theme = 'light' | 'dark'

const ThemeContext = createContext<{
  theme: Theme
  toggle: () => void
}>({ theme: 'dark', toggle: () => {} })

export function useTheme() {
  return useContext(ThemeContext)
}

// THE `data-theme` ATTRIBUTE ON <html> IS THE SOURCE OF TRUTH, AND REACT READS IT
// RATHER THAN KEEPING A SECOND COPY.
//
// The blocking script in the root layout sets that attribute from the theme cookie
// before first paint, so by the time any React code runs the answer already exists
// in the DOM. This used to mirror it into `useState('dark')` and adopt the real
// value in a mount effect, which needed a second effect to write changes back and a
// `firstRun` ref to stop that second effect stomping the script's value back to
// dark for every light-mode visitor. Two effects and a ref to track one attribute.
//
// Reading the attribute through useSyncExternalStore is what that arrangement was
// hand-rolling. Hydration still renders 'dark' (the server snapshot, which is what
// the server emitted), React re-renders with the real value immediately after, and
// the stomp is structurally impossible because there is no second copy to stomp.
const listeners = new Set<() => void>()

function readTheme(): Theme {
  return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark'
}

function subscribe(onChange: () => void) {
  listeners.add(onChange)
  // An attribute observer as well as the listener set, so a change made by anything
  // other than setTheme below -- the blocking script on a late run, devtools, a
  // future component -- still reaches React instead of being silently ignored.
  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  return () => {
    listeners.delete(onChange)
    observer.disconnect()
  }
}

// Notifies directly as well as through the observer, which is deliberate rather
// than redundant: MutationObserver delivers on a microtask, so a toggle would
// otherwise repaint one tick after the click. Both paths re-read the same
// attribute, and useSyncExternalStore drops a notification whose snapshot has not
// changed, so the duplicate costs a comparison and nothing else.
function setTheme(next: Theme) {
  document.documentElement.setAttribute('data-theme', next)
  document.cookie = `theme=${next};path=/;max-age=31536000;SameSite=Lax`
  for (const listener of listeners) listener()
}

export function ThemeProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const theme = useSyncExternalStore(subscribe, readTheme, () => 'dark' as Theme)

  const value = useMemo(
    () => ({ theme, toggle: () => setTheme(theme === 'light' ? 'dark' : 'light') }),
    [theme],
  )

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  )
}
