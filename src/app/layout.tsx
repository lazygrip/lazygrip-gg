import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import './globals.css'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import OutageBanner from '@/components/layout/OutageBanner'
import { ThemeProvider } from '@/components/ThemeProvider'

export const metadata: Metadata = {
  title: {
    default: 'LazyGrip.net — GRIP-EMS Sequences for WoW',
    template: '%s | LazyGrip.net',
  },
  description: 'Browse, share, and rate GRIP-EMS macro sequences for World of Warcraft. Every class, every spec, every content type. Free to browse and post.',
  keywords: 'GRIP-EMS, WoW macros, Guardian Druid, Blood Death Knight, GSE alternative, World of Warcraft sequences, Midnight Season 1, GRIP EMS sequences, WoW rotation macro',
  authors: [{ name: 'LazyGrip.net' }],
  creator: 'LazyGrip.net',
  metadataBase: new URL('https://lazygrip.net'),
  icons: {
    icon: '/icon.png',
    apple: '/apple-icon.png',
  },
  openGraph: {
    title: 'LazyGrip.net — GRIP-EMS Sequences for WoW',
    description: 'Browse, share, and rate GRIP-EMS macro sequences for World of Warcraft. Every class, every spec, every content type.',
    url: 'https://lazygrip.net',
    siteName: 'LazyGrip.net',
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary',
    title: 'LazyGrip.net — GRIP-EMS Sequences for WoW',
    description: 'Browse, share, and rate GRIP-EMS macro sequences for World of Warcraft.',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
  alternates: {
    canonical: 'https://lazygrip.net',
  },
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieStore = cookies()
  const themeCookie = cookieStore.get('theme')
  const initialTheme = themeCookie?.value === 'dark' ? 'dark' : 'light'

  return (
    <html lang="en" data-theme={initialTheme}>
      <body>
        <ThemeProvider initialTheme={initialTheme}>
          <OutageBanner />
          <Header />
          <main style={{ minHeight: 'calc(100vh - 56px - 60px)' }}>
            {children}
          </main>
          <Footer />
        </ThemeProvider>
      </body>
    </html>
  )
}