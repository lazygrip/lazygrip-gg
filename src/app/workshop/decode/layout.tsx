import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Decode a GRIP Export',
  description: 'Paste a GRIP or legacy macro export to inspect its steps, spells, and settings before importing it.',
  alternates: {
    canonical: 'https://lazygrip.net/workshop/decode',
  },
  openGraph: {
    title: 'Decode a GRIP Export',
    description: 'Paste a GRIP or legacy macro export to inspect its steps, spells, and settings before importing it.',
    url: 'https://lazygrip.net/workshop/decode',
    siteName: 'LazyGrip.net',
    type: 'website',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'LazyGrip.net — GRIP-EMS sequences for World of Warcraft' }],
  },
}

export default function WorkshopDecodeLayout({ children }: { children: React.ReactNode }) {
  return children
}
