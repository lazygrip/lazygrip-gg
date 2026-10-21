import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Convert GSE to GRIP-EMS',
  description: 'Paste a GSE export and get a GRIP-EMS string back, with the original author kept on it. No account needed.',
  alternates: {
    canonical: 'https://lazygrip.net/workshop/convert',
  },
  openGraph: {
    title: 'Convert GSE to GRIP-EMS',
    description: 'Paste a GSE export and get a GRIP-EMS string back, with the original author kept on it. No account needed.',
    url: 'https://lazygrip.net/workshop/convert',
    siteName: 'LazyGrip.net',
    type: 'website',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'LazyGrip.net - GRIP-EMS sequences for World of Warcraft' }],
  },
}

export default function WorkshopConvertLayout({ children }: { children: React.ReactNode }) {
  return children
}
