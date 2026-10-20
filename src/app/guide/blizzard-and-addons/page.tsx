import type { Metadata } from 'next'
import Link from 'next/link'
import GuideHeader from '@/components/guide/GuideHeader'
import GuideSection from '@/components/guide/GuideSection'
import GuideCallout from '@/components/guide/GuideCallout'
import { AlertTriangle } from 'lucide-react'

export const metadata: Metadata = {
  title: 'What Blizzard Has Said About Addons Like GRIP-EMS | GRIP-EMS Guide',
  description: 'What Blizzard has actually put in writing about addons, macros and one keypress doing one thing, what it has never ruled on, and what Midnight changed. Sourced and dated, with no claim that GRIP-EMS is approved.',
  alternates: {
    canonical: 'https://lazygrip.net/guide/blizzard-and-addons',
  },
  openGraph: {
    title: 'What Blizzard Has Said About Addons Like GRIP-EMS | GRIP-EMS Guide',
    description: 'What Blizzard has actually put in writing about addons, macros and one keypress doing one thing, what it has never ruled on, and what Midnight changed. Sourced and dated, with no claim that GRIP-EMS is approved.',
    url: 'https://lazygrip.net/guide/blizzard-and-addons',
    siteName: 'LazyGrip.net',
    type: 'website',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'LazyGrip.net - GRIP-EMS sequences for World of Warcraft' }],
  },
}

const link = { color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 } as const

function Ext({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" style={link}>
      {children}
    </a>
  )
}

export default function BlizzardAndAddonsPage() {
  return (
    <div style={{ maxWidth: 720 }}>
      <GuideHeader
        crumbLabel="Blizzard and addons"
        title="What Blizzard has said about addons like GRIP-EMS"
        description={
          <>
            Players ask whether GRIP-EMS is allowed, and the honest answer is that Blizzard has never said either way about it or about any sequencing addon like it. This page collects what Blizzard has actually put in writing that bears on the question, with dates and links, and it says plainly where Blizzard has been silent so that nobody has to guess which parts are rules and which parts are the community&apos;s best reading of them.
          </>
        }
      />

      {/* Same amber-pill treatment as the WoW: Forever page. Blizzard changes this ground
          with almost no notice (Midnight did), so every claim here needs a visible
          check date rather than prose that quietly goes stale. */}
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
        Last checked October 20, 2026. Blizzard can change any of this without notice.
      </div>

      <GuideSection title="The short version">
        <p style={{ marginBottom: 12 }}>
          As far as we could find on October 20, 2026, no Blizzard employee has ruled on GRIP-EMS or on any sequencing addon of its kind. The forum threads where players asked the question have no Blizzard reply, and one player in a May 2026 thread says outright that the Blizzard posters there cannot give the okay for a specific addon. What exists instead is a handful of Blizzard statements that touch the topic from the side, which are covered below, and a community habit of summing them up as one keypress, one action.
        </p>
        <GuideCallout>
          Nothing on this page says GRIP-EMS is safe, approved or permitted, because nobody with the authority to say that has said it. Treat it as a map of what is written down, and make your own call on how much risk you are comfortable with.
        </GuideCallout>
      </GuideSection>

      <GuideSection title="The rule everyone cites: one keypress, one action">
        <p style={{ marginBottom: 12 }}>
          The clearest Blizzard language on this comes from 2008, in a forum thread where players asked about macro keyboards. A Blizzard poster wrote that one hardware function equals one action, that you may not use hardware or software to auto-spam a rotation, and that chaining a full rotation with delays behind a single key was not supported. A second Blizzard poster added that a keyboard repeating an ability while a key is held is not permitted either. The thread is read at <Ext href="https://www.bluetracker.gg/wow/topic/us-en/6762551711-seeking-blue-clarification-key-repeating/">Blue Tracker</Ext>.
        </p>
        <p style={{ marginBottom: 12 }}>
          Two things keep that from being a clean answer. It is nearly two decades old, and it was about hardware like the Logitech G15 rather than addons, so Blizzard has never said how it applies to something running inside the game&apos;s own addon system. It is still the language the community leans on, because it is the only place Blizzard wrote the principle down in plain words, and it is the reason the working rule is that a press should do one thing and the player should do the pressing.
        </p>
        <p>
          Here is how that lines up with how GRIP-EMS is built. In the addon&apos;s source for v2.4.20-hotfix, each sequence button is set up to respond to a key press going down, and each press drives exactly one step. A step can hold several macro lines, the same as any macro you write in the game&apos;s own macro window, and WoW itself decides what goes out, which means only one global-cooldown spell can leave per press whatever the step contains. A search of the Core, Engine, Data, UI and Import code for anything that clicks a sequence button on a timer turned up nothing, and the Click Rate setting is a reference number for the timing advice, not a throttle and not a clicker. That was a search of the source rather than a formal audit, and Sataana is the person to confirm it, but it matches how the <Link href="/guide/settings" style={link}>Settings page</Link> describes the setting. That search covered v2.4.20-hotfix and has not been repeated on v2.4.21, which changed how reset presses are handled, so read it as a statement about the earlier build.
        </p>
        <GuideCallout>
          The line Blizzard drew in 2008 is about automatic repetition, so anything that presses the key for you is on the wrong side of it, including macro keyboards, mouse software, and key repeat tools. EMS does not need any of them and works the way Blizzard&apos;s language describes only when you are the one pressing.
        </GuideCallout>
      </GuideSection>

      <GuideSection title="What the license agreement says">
        <p style={{ marginBottom: 12 }}>
          The binding text is Blizzard&apos;s <Ext href="https://www.blizzard.com/en-us/legal/fba4d00f-c7e4-4883-b8b9-1b4500a402ea/blizzard-end-user-license-agreement">End User License Agreement</Ext>, last revised March 21, 2024. Section 1.C.ii bars creating, using or distributing cheats, hacks and bots, and it defines a bot as code or software that Blizzard has not expressly authorized and that allows the automated control of a game. It closes with a catch-all covering any unauthorized code or software that can be used in connection with the platform, and Section 1.C.i separately bars modifying the platform and building derivative works from it. The agreement does not name macros or addons anywhere.
        </p>
        <p>
          The word doing the work is automated. Read literally, the catch-all would sweep in every addon ever written, which cannot be what Blizzard means, and the reasonable reading is that the addon system and the addon policy below are Blizzard&apos;s authorization for addons in general. Neither one says where customizing the game ends and automated control of it begins, and the only place Blizzard has ever drawn that line in practice is the one keypress, one action language above. By that measure a sequencer where a person makes every press sits on the human side of the line, but that is a reading of the text and not something Blizzard has confirmed.
        </p>
      </GuideSection>

      <GuideSection title="Third-party software is a separate question">
        <p style={{ marginBottom: 12 }}>
          On August 5, 2025 a Blizzard account posted a statement titled Prohibitions on Third-party Software, which you can read on the <Ext href="https://us.forums.blizzard.com/en/wow/t/2142972/1">Blizzard forums</Ext>. It says software that modifies the game client, or that bypasses its security to change or facilitate gameplay, violates the Terms of Service and the End User License Agreement, that Blizzard uses cheat detection to find it, and that penalties can include permanent account closure. The post does not mention macros, key automation or addons that run in the game&apos;s Lua environment, and it does not name any specific tool, so it neither covers nor clears GRIP-EMS. What can be said is that GRIP-EMS is an ordinary addon that sits in your AddOns folder and runs through the same interfaces every other addon uses, and that it does not modify the client.
        </p>
        <p>
          Blizzard&apos;s input broadcasting policy is a different thing again. It prohibits software that copies one keystroke or action to several game windows at once, which is aimed at multiboxing and botting, and it lists warnings escalating to suspension and permanent closure. The announcement is on the <Ext href="https://news.blizzard.com/en-us/article/23558957/policy-update-for-input-broadcasting-software">Blizzard news site</Ext>. If you run more than one account, that policy applies to you whether or not you use any addon, and mirroring input across clients is not something GRIP-EMS does.
        </p>
      </GuideSection>

      <GuideSection title="What the addon policy actually says">
        <p style={{ marginBottom: 12 }}>
          Blizzard&apos;s <Ext href="https://us.forums.blizzard.com/en/wow/t/ui-add-on-development-policy/24534">UI Add-On Development Policy</Ext> has eight rules. Addons have to be free, their code has to be visible and not obfuscated, they cannot hurt realm performance or other players, they cannot advertise or ask for donations in the game, they have to stay within a Teen content rating, and they have to follow the Terms of Use and the EULA. The eighth rule is the one that matters most for a long view, because it says Blizzard may disable any addon functionality at its sole discretion.
        </p>
        <p>
          None of the eight rules mentions automation or how many actions a keypress may trigger, so the policy neither permits nor forbids a sequencer by name. What it does tell you is that Blizzard reserves the right to change what addons can do at any time, which is exactly what happened with Midnight, covered next. The policy also points questions about a specific addon to an email address at Blizzard, and in our experience a message sent there does not get an answer, so we are not leaning on that route and neither should you.
        </p>
      </GuideSection>

      <GuideSection title="What Midnight changed">
        <p style={{ marginBottom: 12 }}>
          Blizzard explained its reasoning in <Ext href="https://news.blizzard.com/en-us/article/24246290/combat-philosophy-and-addon-disarmament-in-midnight">Combat Philosophy and Addon Disarmament in Midnight</Ext>. The stated goal is that addons stay tools for customizing how the game looks and presenting information, and not tools that give a combat advantage. Combat information became what Blizzard calls a secret value, which addons can display but cannot read, and real-time processing of things like buffs, debuffs, cooldowns and combat events is restricted. Blizzard also said it is building some of those functions into the game itself, including Assisted Highlight and a One-Button Rotation.
        </p>
        <p style={{ marginBottom: 12 }}>
          The article says nothing about macros, key presses or sequencers, so it is not a ruling on them either. Two things follow from it that are worth knowing. First, Blizzard shipping its own one-button rotation on retail means it does not treat the idea of a single button doing a rotation as off limits in itself, but that is Blizzard offering it as part of the game and says nothing about whether a third party addon may do the same thing. Second, the practical effect for sequences is the one the <Link href="/guide/how-it-works" style={link}>How it works page</Link> describes: a sequence step can use the macro conditionals the game evaluates itself, and the Variables system can only hand back plain true or false answers, not live numbers like stacks or time remaining.
        </p>
        <p>
          Patch 12.1.5 did not change this picture. The API notes list a few more values becoming secret and a tightening on when addon code can touch protected cooldown frames, and they list no new combat restrictions that affect how a sequence runs. The 12.1.5 notes are on the <Ext href="https://warcraft.wiki.gg/wiki/Patch_12.1.5/API_changes">Warcraft Wiki</Ext>.
        </p>
      </GuideSection>

      <GuideSection title="WoW: Forever">
        <p>
          In a Kotaku interview published September 14, 2026, lead encounter designer Mike Nuthals said Forever will carry over retail&apos;s restriction on in-combat addons that automate marking or communicating for players. The article gives no further specifics and does not mention macros. It is covered, along with what it might mean for Variables, on the <Link href="/guide/wow-forever" style={link}>WoW: Forever page</Link>.
        </p>
        <p style={{ marginTop: 12 }}>
          A second report followed on September 17. <Ext href="https://www.icy-veins.com/wow-forever/news/addons-in-wow-forever-blizzard-devs-just-addressed-the-big-question/">Icy Veins</Ext> wrote up a message from a Blizzard representative on the WoW UI Discord and a Game Informer interview with the Forever developers. Per that report, Forever will use the same API restrictions introduced with Midnight, and the representative said it shares Mainline&apos;s UI architecture, including &quot;the vast majority of APIs available in 12.1.5.&quot; The <Ext href="https://warcraft.wiki.gg/wiki/Patch_1.60.1/API_changes/notes">Warcraft Wiki&apos;s Forever API notes</Ext> say the same. Neither source mentions macros or sequencing addons, so this tells you which API rules apply on Forever and nothing about whether a sequencer is acceptable there.
        </p>
      </GuideSection>

      <GuideSection title="What nobody can tell you">
        <p style={{ marginBottom: 12 }}>
          Whether Blizzard would ever act against a player for using a sequencer in the way described here is not something this page or this site can answer, because it is not written down anywhere we could find, and the people on forums who sound certain either way are giving opinions. Blizzard&apos;s enforcement history that is written down is about client modification, input broadcasting and outright botting, and none of it names addons in the Lua environment.
        </p>
        <p>
          If you want to stay on the most conservative reading of everything above, it comes to four habits: press the key yourself for every step, use nothing that repeats presses for you, never mirror input to a second client, and keep your addons to ones you install from CurseForge, Wago or WoWInterface. That is a reading of the text, not a guarantee, and this site is not affiliated with Blizzard and cannot speak for it.
        </p>
      </GuideSection>

      <GuideSection title="Sources">
        <ul style={{ paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <li><Ext href="https://www.bluetracker.gg/wow/topic/us-en/6762551711-seeking-blue-clarification-key-repeating/">Seeking Blue clarification: key repeating</Ext> (Blizzard posts, May 2008)</li>
          <li><Ext href="https://www.blizzard.com/en-us/legal/fba4d00f-c7e4-4883-b8b9-1b4500a402ea/blizzard-end-user-license-agreement">Blizzard End User License Agreement</Ext> (revised March 21, 2024)</li>
          <li><Ext href="https://kotaku.com/new-things-learned-world-of-warcraft-forever-2000734005">New things learned about World of Warcraft: Forever</Ext> (Kotaku, September 14, 2026)</li>
          <li><Ext href="https://www.icy-veins.com/wow-forever/news/addons-in-wow-forever-blizzard-devs-just-addressed-the-big-question/">Addons in WoW Forever? Blizzard Devs Just Addressed the Big Question</Ext> (Icy Veins, September 17, 2026)</li>
          <li><Ext href="https://warcraft.wiki.gg/wiki/Patch_1.60.1/API_changes/notes">Patch 1.60.1 API changes and notes</Ext> (Warcraft Wiki, WoW: Forever)</li>
          <li><Ext href="https://us.forums.blizzard.com/en/wow/t/2142972/1">Prohibitions on Third-party Software</Ext> (Blizzard, August 5, 2025)</li>
          <li><Ext href="https://news.blizzard.com/en-us/article/23558957/policy-update-for-input-broadcasting-software">Policy Update for Input Broadcasting Software</Ext> (Blizzard)</li>
          <li><Ext href="https://us.forums.blizzard.com/en/wow/t/ui-add-on-development-policy/24534">UI Add-On Development Policy</Ext> (Blizzard)</li>
          <li><Ext href="https://news.blizzard.com/en-us/article/24246290/combat-philosophy-and-addon-disarmament-in-midnight">Combat Philosophy and Addon Disarmament in Midnight</Ext> (Blizzard)</li>
          <li><Ext href="https://us.forums.blizzard.com/en/wow/t/for-clarification-on-the-rulesgse/2301872">For clarification on the rules....gse?</Ext> (player thread, May 2026, no Blizzard reply)</li>
          <li><Ext href="https://warcraft.wiki.gg/wiki/Patch_12.1.5/API_changes">Patch 12.1.5 API changes</Ext> (Warcraft Wiki)</li>
        </ul>
      </GuideSection>
    </div>
  )
}
