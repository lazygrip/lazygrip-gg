import type { Metadata } from 'next'
import './globals.css'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import AnnouncementBar from '@/components/layout/AnnouncementBar'
import { ThemeProvider } from '@/components/ThemeProvider'
import Script from 'next/script'
import { jsonLdString } from '@/lib/json-ld'

// Site-wide JSON-LD, rendered once here so every page on the site carries
// it. WebSite + the SearchAction is what makes Google eligible to show a
// search box directly under the site's result in Google's own results
// (a "sitelinks search box") -- /browse?search={term} is the same query
// param BrowseContent.tsx already reads for the in-page search box, so
// this points at a real, working search, not a placeholder. Organization
// carries the brand identity (name, logo, same-as social links) that
// Google's Knowledge Graph looks for when it has enough signal to build one.
const WEBSITE_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'LazyGrip.net',
  url: 'https://lazygrip.net',
  potentialAction: {
    '@type': 'SearchAction',
    target: {
      '@type': 'EntryPoint',
      urlTemplate: 'https://lazygrip.net/browse?search={search_term_string}',
    },
    'query-input': 'required name=search_term_string',
  },
}

const ORGANIZATION_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'LazyGrip.net',
  url: 'https://lazygrip.net',
  logo: 'https://lazygrip.net/icon.png',
}

export const metadata: Metadata = {
  title: {
    default: 'LazyGrip.net — GRIP-EMS Sequences for WoW',
    template: '%s | LazyGrip.net',
  },
  description: 'Browse, share, and rate GRIP-EMS macro sequences for World of Warcraft. Every class, every spec, every content type. Free to browse and post.',
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
    siteName: 'LazyGrip.net',
    type: 'website',
    locale: 'en_US',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'LazyGrip.net — GRIP-EMS sequences for World of Warcraft' }],
  },
  twitter: {
    card: 'summary_large_image',
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
  return (
    <html lang="en" suppressHydrationWarning>
      <script
        dangerouslySetInnerHTML={{
          __html: "try{var m=document.cookie.match(/(?:^|;\\s*)theme=(dark|light)/);document.documentElement.setAttribute('data-theme',m?m[1]:'dark')}catch(e){document.documentElement.setAttribute('data-theme','dark')}",
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdString(WEBSITE_JSON_LD) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdString(ORGANIZATION_JSON_LD) }}
      />
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
        <ThemeProvider>
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