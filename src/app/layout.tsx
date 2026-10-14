import type { Metadata } from 'next'
import './globals.css'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import AnnouncementBar from '@/components/layout/AnnouncementBar'
import { ThemeProvider } from '@/components/ThemeProvider'
import Script from 'next/script'
import { headers } from 'next/headers'
import { preload } from 'react-dom'
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

// Every page is rendered per request. A nonce-based Content-Security-Policy needs
// a different nonce on every response, and a page that was built once at deploy
// time has no request to take one from. Reading headers() below already opts the
// tree out of static rendering; this line says so out loud so removing the read
// cannot quietly bring back a cached page whose scripts carry a stale nonce.
export const dynamic = 'force-dynamic'

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Set by src/middleware.ts for this request. undefined only if the middleware
  // did not run, in which case the scripts below carry no nonce and the browser
  // blocks them, which is the safe way for that failure to look.
  const nonce = (await headers()).get('x-nonce') ?? undefined

  // The body font is the one thing every page needs before it can paint text, so ask for
  // it at the top of the document instead of waiting for the stylesheet to discover it.
  // Without this the first paint uses the fallback font and the text visibly jumps. The
  // other three font files are not preloaded, they only matter for code and rare characters.
  preload('/fonts/Saira-latin-wght.woff2', { as: 'font', type: 'font/woff2', crossOrigin: 'anonymous' })

  return (
    <html lang="en" suppressHydrationWarning>
      <script
        nonce={nonce}
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
          nonce={nonce}
        />
        <Script id="google-analytics" strategy="afterInteractive" nonce={nonce}>
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