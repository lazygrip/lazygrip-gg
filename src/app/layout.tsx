import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import './globals.css'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import AnnouncementBar from '@/components/layout/AnnouncementBar'
import { ThemeProvider } from '@/components/ThemeProvider'
import Script from 'next/script'

export const metadata: Metadata = {
  title: {
    default: 'LazyGrip.net — GRIP-EMS Sequences for WoW',
    template: '%s | LazyGrip.net',
  },
  description: 'Browse, share, and rate GRIP-EMS macro sequences for World of Warcraft. Every class, every spec, every content type. Free to browse and post.',
  keywords: 'GRIP-EMS, GRIP EMS guide, GRIP-EMS tutorial, how to use GRIP EMS, WoW macros, Guardian Druid, Blood Death Knight, GSE alternative, GnomeSequencer alternative, World of Warcraft sequences, Mythic+ macro guide, WoW rotation addon, GRIP Enhanced Macro Sequencer, WoW sequence builder, Midnight Season 1, GRIP EMS sequences, WoW rotation macro',
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
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'LazyGrip.net — GRIP-EMS sequences for World of Warcraft' }],
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
  verification: {
    google: 'afA04s2vcXI-O42reKGbxNN557MNpLRyhmqSAfCdHh0',
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
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-CJTX030THX"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-CJTX030THX');
          `}
        </Script>
        <ThemeProvider initialTheme={initialTheme}>
          <Header />
          <AnnouncementBar />
          <main style={{ minHeight: 'calc(100vh - 56px - 60px)' }}>
            {children}
          </main>
          <Footer />
        </ThemeProvider>
      </body>
    </html>
  )
}