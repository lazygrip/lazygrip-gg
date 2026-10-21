import type { Metadata } from 'next'
import Link from 'next/link'
import GuideHeader from '@/components/guide/GuideHeader'
import GuideSection from '@/components/guide/GuideSection'
import GuideCallout from '@/components/guide/GuideCallout'
import { guideCodeStyle } from '@/components/guide/GuideCode'
import { AlertTriangle } from 'lucide-react'

export const metadata: Metadata = {
  title: 'WoW: Forever Compatibility | GRIP-EMS Guide',
  description: 'Whether GRIP-EMS runs on WoW: Forever, what is confirmed so far in the beta, and where the Blizzard-side save bug stands.',
  alternates: {
    canonical: 'https://lazygrip.net/guide/wow-forever',
  },
  openGraph: {
    title: 'WoW: Forever Compatibility | GRIP-EMS Guide',
    description: 'Whether GRIP-EMS runs on WoW: Forever, what is confirmed so far in the beta, and where the Blizzard-side save bug stands.',
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
            WoW: Forever is Blizzard&apos;s expanded take on vanilla WoW, in beta since September 17, 2026, with the beta scheduled to end October 22 and the game launching November 4. This page tracks whether GRIP-EMS runs there, sourced directly from Sataana rather than guesswork, and it gets updated as the beta moves. The site now has a separate Forever page and a Forever filter on Browse, but no Forever sequence has been validated yet, and the reason why is below.
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
        Beta findings from Sataana last confirmed September 18, 2026. The note on v2.4.20 and v2.4.21 was added October 17, 2026 from the v2.4.21 changelog and has not been tested here. The Blizzard addon rules section and the save bug status were last checked October 20, 2026 against press reports, Blizzard forum posts and the Warcraft Wiki, and none of it has been tested in the beta. Check the dates before trusting anything below as still current.
      </div>

      <GuideSection title="What is confirmed">
        <p style={{ marginBottom: 12 }}>
          As of September 18, GRIP-EMS loaded on WoW: Forever without any changes. Forever&apos;s .toc interface number is <code style={guideCodeStyle}>16001</code>, the same number GRIP-EMS already lists for Classic Era support, so the addon passed Forever&apos;s interface check with the file exactly as it shipped then. Sataana confirmed this directly and had gotten the addon running in-game on the beta client himself.
        </p>
        <p style={{ marginBottom: 12 }}>
          That was true of the build Sataana tested in September, and it stopped being true with v2.4.20. According to the v2.4.21 changelog, v2.4.20 stopped at a Lua error at every Forever login because two spec functions it calls are gone from that client, and nothing after that point in the login ran, so the settings panel never registered, sending and receiving sequences did not work, and plugin sequences, the tracker HUD and the floating menu never loaded. Selecting a sequence stopped with an error before its Keybind tab loaded, which meant there was no way to bind a key to it. v2.4.21 fixes that. If you tried GRIP-EMS on the Forever beta on v2.4.20 and it fell over, that was the addon and not the beta, and updating is the fix. We have not confirmed v2.4.21 on the beta ourselves, so that part rests on the changelog.
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
          As of September 18, the Forever beta did not write SavedVariables correctly. In Sataana&apos;s own words, expect none of your in-game addon changes to survive a UI reload. This is a Blizzard client bug, it affects every addon on Forever, and there is nothing GRIP-EMS or any other addon can do on its own to work around it.
        </GuideCallout>
        <p>
          This is the reason nothing gets published here yet. A sequence that looks broken on Forever right now could just as easily be a working sequence that lost its saved state on the last reload. There was no way to tell the difference while the underlying bug was live, so no result from that period is meaningful evidence either way.
        </p>
        <p style={{ marginBottom: 12 }}>
          Players have since reported a fix. In a <a href="https://us.forums.blizzard.com/en/wow/t/2356559" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>Blizzard bug report thread</a> about saved data reaching disk but not being restored at startup, one player wrote on September 25 that saved data loads correctly again in build 1.60.1 (70009) from September 23. No Blizzard employee replied in that thread, and we have not tested it ourselves.
        </p>
        <p>
          One player report is not confirmation, so the rule here stays the same: nothing is published until the fix is confirmed by Sataana or tested here. When that happens this section will say so.
        </p>
      </GuideSection>

      <GuideSection title="What Blizzard has said about addons on Forever">
        <p style={{ marginBottom: 12 }}>
          In a post-BlizzCon interview that <a href="https://kotaku.com/new-things-learned-world-of-warcraft-forever-2000734005" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>Kotaku</a> published on September 14, 2026, lead encounter designer Mike Nuthals said Forever will carry over retail&apos;s restriction on in-combat addons that automate marking or communicating for players, which Kotaku calls computational addons. Neither he nor lead Classic designer Tim Jones gave specifics on how addons will work, and the article does not say which addons stay allowed. Kotaku also reports that the One-Button Rotation Blizzard added to retail will not carry over to Forever. Macros are not mentioned anywhere in the piece. GamesRadar picked the story up two days later, and the write-ups we found at that point all traced back to that one interview.
        </p>
        <p style={{ marginBottom: 12 }}>
          A second round of statements followed on September 17. <a href="https://www.icy-veins.com/wow-forever/news/addons-in-wow-forever-blizzard-devs-just-addressed-the-big-question/" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>Icy Veins</a> reported a message from a Blizzard representative on the WoW UI Discord and a Game Informer interview with the Forever developers. Per that report, Forever will use the same API restrictions Blizzard introduced with Midnight, and the representative said Forever shares Mainline&apos;s UI architecture, including &quot;the vast majority of APIs available in 12.1.5.&quot; The developers said they want to keep the customization addons allow without giving addons excessive power over the player&apos;s experience. The <a href="https://warcraft.wiki.gg/wiki/Patch_1.60.1/API_changes/notes" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>Warcraft Wiki&apos;s Forever API notes</a> carry the same statement, dated September 15. Neither source mentions macros or sequencing addons.
        </p>
        <p style={{ marginBottom: 12 }}>
          What that means for GRIP-EMS is a guess until someone tests it in the beta. A sequence steps through fixed macro lines and leans on conditionals the game evaluates itself, which is not the kind of calculation the report describes, so the sequencing side looks like the safer half. The part more likely to be affected is the Variables system, because Sataana says Forever is classed internally as Mainline, and if it carries retail&apos;s rules for reading aura and cooldown state then Variables could behave on Forever the way the <Link href="/guide/how-it-works" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>How it works page</Link> describes for retail, returning plain true or false answers and nothing numeric. That was an inference when we first wrote it. Blizzard&apos;s statements above now say Forever carries Midnight&apos;s API restrictions, which fits it, but nobody has tested Variables in the beta, so it is still unconfirmed.
        </p>
        <p>
          The wider question of what Blizzard has and has not said about addons that sequence your keypresses, on retail and everywhere else, is on its own page: <Link href="/guide/blizzard-and-addons" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>What Blizzard has said about addons like GRIP-EMS</Link>.
        </p>
      </GuideSection>

      <GuideSection title="Where this stands">
        <p style={{ marginBottom: 12 }}>
          The schedule, as reported by <a href="https://www.warcrafttavern.com/forever/news/world-of-warcraft-forever-roadmap-beta-launch-date-raids/" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>Warcraft Tavern</a> (published September 13, updated October 5): the beta runs September 17 to October 22, early name reservation for upgrade pack buyers opens October 27, the game launches November 4, and raids open December 9. Blizzard can move any of those dates.
        </p>
        <p style={{ marginBottom: 12 }}>
          LazyGrip keeps Forever sequences apart from retail ones, with their own page and a filter on Browse, but nothing on it counts as validated until someone can confirm a sequence runs correctly end to end on Forever, past a UI reload, with no SavedVariables asterisk attached. This page gets updated the moment that happens.
        </p>
        <p>
          If you want to try GRIP-EMS on the Forever beta yourself in the meantime, it installs the same way it does on retail. Just do not trust anything you see until the save bug above is confirmed fixed, and check Sataana&apos;s Discord for the latest before assuming a problem is GRIP-EMS&apos;s fault rather than the beta&apos;s.
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
