import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Convert to GRIP',
  description: 'Convert an existing macro sequence export into a GRIP-EMS string you can import directly into the addon.',
  alternates: {
    canonical: 'https://lazygrip.net/workshop/convert',
  },
  openGraph: {
    title: 'Convert to GRIP',
    description: 'Convert an existing macro sequence export into a GRIP-EMS string you can import directly into the addon.',
    url: 'https://lazygrip.net/workshop/convert',
    siteName: 'LazyGrip.net',
    type: 'website',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'LazyGrip.net — GRIP-EMS sequences for World of Warcraft' }],
  },
}

export default function WorkshopConvertLayout({ children }: { children: React.ReactNode }) {
  return children
}
