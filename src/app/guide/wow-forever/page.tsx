import type { Metadata } from 'next'
import GuideHeader from '@/components/guide/GuideHeader'
import GuideSection from '@/components/guide/GuideSection'
import GuideCallout from '@/components/guide/GuideCallout'
import { guideCodeStyle } from '@/components/guide/GuideCode'
import { AlertTriangle } from 'lucide-react'

export const metadata: Metadata = {
  title: 'WoW: Forever Compatibility | GRIP-EMS Guide',
  description: 'Whether GRIP-EMS runs on WoW: Forever, what is confirmed as of beta week one, and the Blizzard-side bug currently blocking real testing.',
  alternates: {
    canonical: 'https://lazygrip.net/guide/wow-forever',
  },
  openGraph: {
    title: 'WoW: Forever Compatibility | GRIP-EMS Guide',
    description: 'Whether GRIP-EMS runs on WoW: Forever, what is confirmed as of beta week one, and the Blizzard-side bug currently blocking real testing.',
    url: 'https://lazygrip.net/guide/wow-forever',
    siteName: 'LazyGrip.net',
    type: 'website',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'LazyGrip.net — GRIP-EMS sequences for World of Warcraft' }],
  },
}

export default function WowForeverPage() {
  return (
    <div style={{ maxWidth: 720 }}>
      <GuideHeader
        crumbLabel="WoW: Forever"
        title="Does GRIP-EMS work on WoW: Forever?"
        description={
          <>
            WoW: Forever is Blizzard&apos;s expanded take on vanilla WoW, in beta since September 17, 2026, launching fully on November 4. This page tracks whether GRIP-EMS runs there, sourced directly from Sataana rather than guesswork, and it gets updated as the beta moves. There is no Forever sequence category on this site yet, and the reason why is below.
          </>
        }
      />

      {/* Same amber-pill language as the sequence-card "Needs revalidation" indicator --
          this page is about a beta that moves day to day, so every claim on it needs a
          visible expiry date, not just "beta week one" in prose that never gets touched
          again. */}
      <div
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          fontSize: 'var(--text-xs)', fontWeight: 500,
          padding: '3px 9px', borderRadius: 'var(--radius-sm)',
          background: 'rgba(224,160,32,0.16)', color: '#a06c00',
          border: '0.5px solid rgba(224,160,32,0.4)',
          marginBottom: 28,
        }}
      >
        <AlertTriangle size={11} />
        Last confirmed September 18, 2026. Check the date before trusting anything below as still current.
      </div>

      <GuideSection title="What is confirmed">
        <p style={{ marginBottom: 12 }}>
          GRIP-EMS loads on WoW: Forever without any changes. Forever&apos;s .toc interface number is <code style={guideCodeStyle}>16001</code>, the same number GRIP-EMS already lists for Classic Era support, so the addon passes Forever&apos;s interface check with the file exactly as it ships today. Sataana confirmed this directly and has gotten the addon running in-game on the beta client himself.
        </p>
        <p>
          What that does not confirm is whether a sequence actually runs correctly once it is loaded. Loading and working are different claims, and as of this beta&apos;s first week, only the first one has been verified.
        </p>
      </GuideSection>

      <GuideSection title="Why Forever is not quite Classic Era or retail">
        <p>
          Per Sataana, Forever is classed internally as Mainline, meaning it runs on the current retail codebase while declaring the older Classic-style interface number above. That is an unusual pairing, and it means neither existing retail testing nor existing Classic Era testing fully covers it. One concrete example has already surfaced: <code style={guideCodeStyle}>{'UnitName("player")'}</code> returns your full name on Forever, but <code style={guideCodeStyle}>{'UnitName("target")'}</code> does not, and Sataana has said the final behavior here is still unsettled. Treat anything Forever-specific as provisional until it has been observed directly, not assumed from how retail or Classic Era behaves.
        </p>
      </GuideSection>

      <GuideSection title="The actual blocker: SavedVariables" layout="stack">
        <GuideCallout>
          Forever beta currently does not write SavedVariables correctly. In Sataana&apos;s own words, expect none of your in-game addon changes to survive a UI reload. This is a Blizzard client bug, it affects every addon on Forever, and there is nothing GRIP-EMS or any other addon can do on its own to work around it.
        </GuideCallout>
        <p>
          This is the reason nothing gets published here yet. A sequence that looks broken on Forever right now could just as easily be a working sequence that lost its saved state on the last reload. There is no way to tell the difference until Blizzard fixes the underlying bug, so no result from this week is meaningful evidence either way.
        </p>
      </GuideSection>

      <GuideSection title="Where this stands">
        <p style={{ marginBottom: 12 }}>
          No Forever sequence category exists on LazyGrip yet, and none will until someone can confirm a sequence runs correctly end to end on Forever, past a UI reload, with no SavedVariables asterisk attached. This page gets updated the moment that happens.
        </p>
        <p>
          If you want to try GRIP-EMS on the Forever beta yourself in the meantime, it installs the same way it does on retail. Just do not trust anything you see until Blizzard ships a fix for the save bug above, and check Sataana&apos;s Discord for the latest before assuming a problem is GRIP-EMS&apos;s fault rather than the beta&apos;s.
        </p>
      </GuideSection>

      <GuideSection title="One more difference worth knowing">
        <p>
          Forever has no realms. Where an addon would normally key something to your realm name, Forever uses a &quot;Ruleset&quot; name instead. It does not affect sequences directly, but it is worth knowing if anything you use looks for a realm and comes up empty.
        </p>
      </GuideSection>
    </div>
  )
}
