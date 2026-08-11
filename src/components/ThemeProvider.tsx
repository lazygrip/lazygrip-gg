'use client'
import { createContext, useContext, useEffect, useRef, useState } from 'react'

type Theme = 'light' | 'dark'

const ThemeContext = createContext<{
  theme: Theme
  toggle: () => void
}>({ theme: 'dark', toggle: () => {} })

export function useTheme() {
  return useContext(ThemeContext)
}

export function ThemeProvider({
  children,
}: {
  children: React.ReactNode
}) {
  // Starts at 'dark' on both server and client so the first client render matches the server
  // render exactly — dark is now the default theme (set by the blocking script in the root
  // layout before first paint for any visitor with no theme cookie). The mount effect below
  // adopts the real value off the html element, which matters for returning light-mode visitors.
  const [theme, setTheme] = useState<Theme>('dark')

  useEffect(() => {
    const applied = document.documentElement.getAttribute('data-theme')
    if (applied === 'dark' || applied === 'light') setTheme(applied)
  }, [])

  // Only user-initiated changes write back. Without the guard the initial pass would stomp the
  // script's value back to 'dark' for every light-mode visitor.
  const firstRun = useRef(true)
  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return }
    document.documentElement.setAttribute('data-theme', theme)
    document.cookie = `theme=${theme};path=/;max-age=31536000;SameSite=Lax`
  }, [theme])

  function toggle() {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'))
  }

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      {children}
    </ThemeContext.Provider>
  )
}
