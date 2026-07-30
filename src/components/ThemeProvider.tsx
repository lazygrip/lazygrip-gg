'use client'
import { createContext, useContext, useEffect, useRef, useState } from 'react'

type Theme = 'light' | 'dark'

const ThemeContext = createContext<{
  theme: Theme
  toggle: () => void
}>({ theme: 'light', toggle: () => {} })

export function useTheme() {
  return useContext(ThemeContext)
}

export function ThemeProvider({
  children,
}: {
  children: React.ReactNode
}) {
  // Starts at 'light' on both server and client so the first client render matches the server
  // render exactly. The real value lives on the html element, written by the blocking script in
  // the root layout before first paint; the mount effect below adopts it.
  const [theme, setTheme] = useState<Theme>('light')

  useEffect(() => {
    const applied = document.documentElement.getAttribute('data-theme')
    if (applied === 'dark' || applied === 'light') setTheme(applied)
  }, [])

  // Only user-initiated changes write back. Without the guard the initial pass would stomp the
  // script's value back to 'light' for every dark-mode visitor.
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
