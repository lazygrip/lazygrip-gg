import type { Metadata } from 'next'

export const metadata: Metadata = {
  // A plain string here would resolve with template: null and wipe the root
  // layout's title template for /workshop/build, /convert and /decode, leaving
  // those three routes without the site suffix. Re-declare the template so it
  // survives to the sub-routes.
  title: {
    default: 'GRIP Sequence Workshop',
    template: '%s | LazyGrip.net',
  },
  description: 'Build, convert, and decode GRIP-EMS macro sequences in your browser. Spell autocomplete by class, loops, if branches, and pause blocks.',
  alternates: {
    canonical: 'https://lazygrip.net/workshop',
  },
  openGraph: {
    title: 'GRIP Sequence Workshop',
    description: 'Build, convert, and decode GRIP-EMS macro sequences in your browser. Spell autocomplete by class, loops, if branches, and pause blocks.',
    url: 'https://lazygrip.net/workshop',
    siteName: 'LazyGrip.net',
    type: 'website',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'LazyGrip.net — GRIP-EMS sequences for World of Warcraft' }],
  },
}

export default function WorkshopLayout({ children }: { children: React.ReactNode }) {
  return children
}
