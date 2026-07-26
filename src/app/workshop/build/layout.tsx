import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Sequence Builder',
  description: 'Build a GRIP-EMS macro sequence in the browser and export a ready-to-import GRIP string. No addon required to start.',
  alternates: {
    canonical: 'https://lazygrip.net/workshop/build',
  },
  openGraph: {
    title: 'Sequence Builder',
    description: 'Build a GRIP-EMS macro sequence in the browser and export a ready-to-import GRIP string. No addon required to start.',
    url: 'https://lazygrip.net/workshop/build',
    siteName: 'LazyGrip.net',
    type: 'website',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'LazyGrip.net — GRIP-EMS sequences for World of Warcraft' }],
  },
}

export default function WorkshopBuildLayout({ children }: { children: React.ReactNode }) {
  return children
}
