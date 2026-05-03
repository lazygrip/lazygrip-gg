import type { Metadata } from 'next'
import './globals.css'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'

export const metadata: Metadata = {
  title: 'LazyGrip.net — GRIP-EMS Sequences for WoW',
  description: 'Browse, share, and rate GRIP-EMS macro sequences for World of Warcraft. Every class, every spec, every content type.',
  keywords: 'GRIP-EMS, WoW macros, Guardian Druid, GSE alternative, World of Warcraft sequences',
  openGraph: {
    title: 'LazyGrip.net',
    description: 'Community GRIP-EMS sequences for World of Warcraft',
    url: 'https://lazygrip.net',
    siteName: 'LazyGrip.net',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <Header />
        <main style={{ minHeight: 'calc(100vh - 56px - 60px)' }}>
          {children}
        </main>
        <Footer />
      </body>
    </html>
  )
}
