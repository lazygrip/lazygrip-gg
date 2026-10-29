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
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'LazyGrip.net - GRIP-EMS sequences for World of Warcraft' }],
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
            WoW: Forever is Blizzard&apos;s expanded take on vanilla WoW, in beta from September 17, 2026 until the beta closed on October 23, with the game launching November 4. This page tracks whether GRIP-EMS runs there, sourced directly from Sataana rather than guesswork, and it gets updated as the beta moves. The site now has a separate Forever page and a Forever filter on Browse, but no Forever sequence has been validated yet, and the reason why is below.
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
        Beta findings from Sataana last confirmed September 18, 2026. The note on v2.4.20 and v2.4.21 was added October 17, 2026 from the v2.4.21 changelog and has not been tested here. The schedule, the addon store listings, the save bug status and the Warcraft Wiki notes were last checked October 29, 2026, and the press interviews in the Blizzard addon rules section October 25, 2026, against press reports, Blizzard forum posts and news, the Warcraft Wiki, the GRIP-EMS Discord announcements and the v2.4.21 addon files, and none of it has been tested in the beta. Check the dates before trusting anything below as still current.
      </div>

      <GuideSection title="What is confirmed">
        <p style={{ marginBottom: 12 }}>
          As of September 18, GRIP-EMS loaded on WoW: Forever without any changes. Forever&apos;s .toc interface number is <code style={guideCodeStyle}>16001</code>, which Sataana added to the addon&apos;s .toc in v2.4.18 on September 17 as groundwork for this client (the number was read out of a shipped addon listed under the store&apos;s own Forever flavor, and that release post said it had not yet been confirmed on a running client), so the addon passed Forever&apos;s interface check with the file exactly as it shipped then. Sataana confirmed this directly and had gotten the addon running in-game on the beta client himself.
        </p>
        <p style={{ marginBottom: 12 }}>
          That was true of the build Sataana tested in September, and it stopped being true with v2.4.20. According to the v2.4.21 changelog, v2.4.20 stopped at a Lua error at every Forever login because two spec functions it calls are gone from that client, and nothing after that point in the login ran, so the settings panel never registered, sending and receiving sequences did not work, and plugin sequences, the tracker HUD and the floating menu never loaded. Selecting a sequence stopped with an error before its Keybind tab loaded, which meant there was no way to bind a key to it. v2.4.21 fixes that, and the October 17 announcement in the GRIP-EMS Discord says it loads clean on the beta. The v2.4.20-hotfix from October 14 is v2.4.20 plus two fixes for patch 12.1.5, the loading and the spell picker&apos;s item lists, with no Forever fix listed, so read it as still falling over at a Forever login, which is a reading of that release post and not something anyone has tested. If you tried GRIP-EMS on the Forever beta on v2.4.20 and it fell over, that was the addon and not the beta, and updating is the fix. The v2.4.21 files we checked on October 22 agree with the changelog on the listing side: the .toc names Forever&apos;s interface number <code style={guideCodeStyle}>16001</code> next to the retail numbers, and the guide that ships inside the addon gives its requirements as retail 12.0.1 or later, or WoW Forever 1.60.1. The changelog adds that v2.4.21 stops a spell catalogue notice from printing at every Forever login, because Forever&apos;s builds do not match the retail build that list comes from. We have not run v2.4.21 on the beta ourselves, so whether it works there still rests on the changelog and on Sataana.
        </p>
        <p style={{ marginBottom: 12 }}>
          One loose end on the listings: the <a href="https://www.curseforge.com/wow/addons/grip-enhanced-macro-sequencer" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>CurseForge page</a> names Forever as a supported flavor next to Retail, but its description text still says Retail only, so two parts of the same page disagree, and the <a href="https://addons.wago.io/addons/qGZODqNd" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>Wago page</a> now lists Forever as a flavor beside Retail, but its description and requirements still read Retail and Midnight 12.0.x, so it disagrees with itself the same way. The changelog and the guide inside the addon are the better guide to what works.
        </p>
        <p>
          What that does not confirm is whether a sequence actually runs correctly once it is loaded. Loading and working are different claims, and only the first one has been verified, with the beta now closed and nobody having told us they verified the second.
        </p>
      </GuideSection>

      <GuideSection title="Why Forever is not quite Classic Era or retail">
        <p>
          Per Sataana, Forever is classed internally as Mainline, meaning it runs on the current retail codebase while declaring the older Classic-style interface number above. That is an unusual pairing, and it means neither existing retail testing nor existing Classic Era testing fully covers it. One concrete example surfaced in September: <code style={guideCodeStyle}>{'UnitName("player")'}</code> returned your full name on Forever, but <code style={guideCodeStyle}>{'UnitName("target")'}</code> did not, and Sataana said the final behavior was unsettled. The Warcraft Wiki&apos;s <a href="https://warcraft.wiki.gg/wiki/Patch_1.60.1/API_changes" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>Forever API notes</a> list a September 23 beta build (70009) that made <code style={guideCodeStyle}>UnitName</code> consistent across unit tokens, and an October 1 build (70170) that stopped <code style={guideCodeStyle}>{'UnitName("player")'}</code> returning &quot;Unknown&quot; before login finished, so treat that example as out of date. The same notes show Blizzard now treats Forever as a game type of its own, with a <code style={guideCodeStyle}>WOW_PROJECT_CAMELOT</code> constant and Forever accepted as an alias in .toc file suffixes from the October 8 build. Treat anything Forever-specific as provisional until it has been observed directly, not assumed from how retail or Classic Era behaves.
        </p>
      </GuideSection>

      <GuideSection title="SavedVariables: the early blocker, now reported fixed" layout="stack">
        <GuideCallout>
          As of September 18, the Forever beta did not write SavedVariables correctly. In Sataana&apos;s own words, expect none of your in-game addon changes to survive a UI reload. This is a Blizzard client bug, it affects every addon on Forever, and there is nothing GRIP-EMS or any other addon can do on its own to work around it.
        </GuideCallout>
        <p>
          This was the reason nothing got published here at first. A sequence that looked broken on Forever in those weeks could just as easily have been a working sequence that lost its saved state on the last reload. There was no way to tell the difference while the underlying bug was live, so no result from that period is meaningful evidence either way.
        </p>
        <p style={{ marginBottom: 12 }}>
          A fix has since been reported from more than one direction. The Warcraft Wiki&apos;s Forever API notes list &quot;Fixed SavedVariables not loading&quot; under beta build 70009 of September 23. In a <a href="https://us.forums.blizzard.com/en/wow/t/2356559" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>Blizzard bug report thread</a> about saved data reaching disk but not being restored at startup, one player wrote on September 25 that it loads correctly again in that build, and in a <a href="https://eu.forums.blizzard.com/en/wow/t/solvedforever-beta-160169913-savedvariables-fail-to-load-on-client-startupreload-%E2%80%94-all-addon-settings-reset-on-restart/629888" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>second thread</a> that was marked solved, a tester confirmed the same on September 25. No Blizzard employee replied in either thread, and we have not tested it ourselves. A third report comes from the changelog of the <a href="https://www.wowinterface.com/downloads/info27216" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>Wayfinder addon</a>, whose author says Blizzard fixed it in build 70009 and that they verified it in-game against their own settings. It is also worth knowing that, as far as we could tell, the <a href="https://us.forums.blizzard.com/en/wow/t/2352687" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>Known Issues lists</a> we read, from September 17 and 18 through the October 8 update, never carried a SavedVariables entry, so the only record of the bug and its fix is players, addon authors and the volunteer wiki, with nothing written by Blizzard.
        </p>
        <p style={{ marginBottom: 12 }}>
          The picture is not perfectly clean. The same second thread has a tester saying addon settings saved but the built-in chat still lost its customizations at logout, and a couple of third-party sites, one with a compatibility page checked on October 4, were still describing the bug as open or the fix as unconfirmed after the fix build, which may just be stale copy but which we cannot prove. Players also built unofficial workaround tools during the bad weeks. We have not tested those and do not recommend them, because they work by linking files around inside your WoW folder and the client fix should make them unnecessary.
        </p>
        <p>
          Forum reports and a volunteer-kept wiki are not confirmation, so the rule here stays the same: nothing is published as validated until the fix is confirmed by Sataana or tested here. When that happens this section will say so.
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
          The beta notes since then say nothing about macros either. In the addon-facing API notes, Beta 4 on October 8 tightened the rules on addons sending emote chat and on reading minimap rotation during encounters, and Beta 5 on October 16 obfuscated the server and spawn portions of creature and object GUIDs, and the wiki has no entry after that one as of October 29, with the beta having closed on October 23. Those notes are compiled by volunteers and cover addon-facing changes only, so they are good evidence that Blizzard has not announced a change to macros and weaker evidence that nothing changed at all. They do show the direction of travel, which is more restriction on what addons can read and do, not less.
        </p>
        <p style={{ marginBottom: 12 }}>
          What that means for GRIP-EMS is a guess until someone tests it in the beta. A sequence steps through fixed macro lines and leans on conditionals the game evaluates itself, which is not the kind of calculation the report describes, so the sequencing side looks like the safer half. The part more likely to be affected is the Variables system, because Sataana says Forever is classed internally as Mainline, and if it carries retail&apos;s rules for reading aura and cooldown state then Variables could behave on Forever the way the <Link href="/guide/how-it-works" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>How it works page</Link> describes for retail, returning plain true or false answers and nothing numeric. That was an inference when we first wrote it. Blizzard&apos;s statements above now say Forever carries Midnight&apos;s API restrictions, which fits it, and the v2.4.21 changelog says the game no longer lets an addon read a unit&apos;s health percentage, which is why that helper was removed, while the helpers that remain return only true or false. But nobody has published a test of Variables on the Forever client, so it is still unconfirmed.
        </p>
        <p>
          The wider question of what Blizzard has and has not said about addons that sequence your keypresses, on retail and everywhere else, is on its own page: <Link href="/guide/blizzard-and-addons" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>What Blizzard has said about addons like GRIP-EMS</Link>.
        </p>
      </GuideSection>

      <GuideSection title="Where this stands">
        <p style={{ marginBottom: 12 }}>
          The schedule, as far as Blizzard has put it in writing: the beta closed at 10:00 a.m. Pacific on October 23 according to a <a href="https://us.forums.blizzard.com/en/wow/t/the-wow-forever-beta-celebration-is-underway/2389633" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>Blizzard community manager&apos;s post</a> from October 22 (Blizzard&apos;s own pre-purchase page and several write-ups still say October 21 or 22, which were the earlier plans, so we are going by the newer post), <a href="https://news.blizzard.com/en-us/article/24303866/claim-your-world-of-warcraft-forever-character-names" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>early name reservation</a> opened on October 27 for buyers of the Skyborne packs or the Warcraft Forever Collection, scheduled for 1:00 p.m. Pacific in North America and 6:00 p.m. in Central Europe, but it opened late and badly according to <a href="https://www.wowhead.com/forever/news/name-reservations-for-wow-forever-delayed-383608" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>Wowhead&apos;s running coverage</a>: Blizzard put up a launcher notice saying reservations were delayed, Europe opened at about 12:40 p.m. Pacific and North America at about 1:05 p.m. with queues that dropped players on login, and by 2:30 p.m. most of the disconnects were fixed but players in both regions were still reporting missing rulesets. A separate bug in the restricted-name check wrongly blocked names containing &quot;c-o-n&quot;, and Blizzard said in a <a href="https://www.wowhead.com/forever/news/name-reservations-included-overly-restrictive-name-check-but-fix-incoming-383618" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>post Wowhead quotes</a> that the fix would come with the next realm restarts in each region, so we do not know whether it has gone in yet. The game launches November 4 at 3:00 p.m. Pacific according to <a href="https://news.blizzard.com/en-us/article/24302093" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>Blizzard&apos;s launch announcement</a>, which now writes that hour as PST, and since US clocks go back on November 1 the Pacific coast is on standard time that day, so it works out to 11:00 p.m. UTC, which is our conversion and not Blizzard&apos;s wording. Raids open December 9, and Blizzard&apos;s own <a href="https://worldofwarcraft.blizzard.com/en-us/news/24315820/world-of-warcraft-forever-goes-live-globally-november-4" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>October 29 launch post</a> says so, naming Barrow Deeps, Hyjal Summit and Onyxia&apos;s Lair. Blizzard can move any of those dates.
        </p>
        <p style={{ marginBottom: 12 }}>
          LazyGrip keeps Forever sequences apart from retail ones, with their own page and a filter on Browse, but nothing on it counts as validated until someone can confirm a sequence runs correctly end to end on Forever, past a UI reload, with no SavedVariables asterisk attached. This page gets updated the moment that happens.
        </p>
        <p>
          The beta is closed, so there is nowhere to try GRIP-EMS on Forever until the November 4 launch, and when you get in, install v2.4.21 or later, which installs the same way it does on retail. Check that your keybinds and settings survive a reload before you judge a sequence, since the save bug is the first thing to rule out. One more obstacle is the class and spec changes in the beta: sequences here are written with spell names, so an ability that Forever renames would break a step without any error telling you why, and we have not found a list of which names changed. Check Sataana&apos;s Discord for the latest before assuming a problem is GRIP-EMS&apos;s fault rather than the beta&apos;s.
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
