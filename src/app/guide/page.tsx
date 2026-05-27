import type { Metadata } from 'next'
import GuidePageClient from './GuidePageClient'

export const metadata: Metadata = {
  title: 'GRIP-EMS Guide | LazyGrip.net',
  description: 'A practical guide to installing, understanding, and building sequences with GRIP-EMS for World of Warcraft. Written by a Mythic+ player who validates everything in logs.',
  keywords: 'GRIP-EMS guide, GRIP-EMS tutorial, how to use GRIP EMS, GRIP Enhanced Macro Sequencer guide, WoW rotation addon guide, Guardian Druid sequence guide, Mythic+ macro guide',
  openGraph: {
    title: 'GRIP-EMS Guide | LazyGrip.net',
    description: 'A practical guide to installing, understanding, and building sequences with GRIP-EMS for World of Warcraft.',
    url: 'https://lazygrip.net/guide',
  },
  alternates: {
    canonical: 'https://lazygrip.net/guide',
  },
}

export default function GuidePage() {
  return <GuidePageClient />
}
