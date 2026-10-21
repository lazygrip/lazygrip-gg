import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, ArrowLeft } from 'lucide-react'
import GuideHeader from '@/components/guide/GuideHeader'
import GuideSection from '@/components/guide/GuideSection'
import GuideInfoBox from '@/components/guide/GuideInfoBox'
import GuideCode from '@/components/guide/GuideCode'

export const metadata: Metadata = {
  title: 'Coming from GSE | GRIP-EMS Guide',
  description: 'If you use GSE (Gnome Sequencer Enhanced) and are evaluating GRIP-EMS, this section covers how step advancement actually works, what transfers automatically, and what to watch for.',
  alternates: {
    canonical: 'https://lazygrip.net/guide/from-gse',
  },
  openGraph: {
    title: 'Coming from GSE | GRIP-EMS Guide',
    description: 'If you use GSE (Gnome Sequencer Enhanced) and are evaluating GRIP-EMS, this section covers how step advancement actually works, what transfers automatically, and what to watch for.',
    url: 'https://lazygrip.net/guide/from-gse',
    siteName: 'LazyGrip.net',
    type: 'website',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'LazyGrip.net — GRIP-EMS sequences for World of Warcraft' }],
  },
}

export default function FromGsePage() {
  return (
    <div>
      <GuideHeader
        crumbLabel="Coming from GSE"
        title="Coming from GSE"
        description="If you use GSE (Gnome Sequencer Enhanced) and are evaluating whether to switch, this section is written specifically for you. GSE works and a lot of good sequences exist for it. The reason to use GRIP-EMS is the structure you can build into a sequence and the diagnostic tooling around it, plus the fact that every feature is free. This is not a pitch, it is an honest breakdown of what is different."
      />

      <GuideSection title="Getting your sequences into GRIP-EMS">
        <p style={{ marginBottom: 14 }}>
          This is probably what you came here for first. GRIP-EMS imports GSE sequences automatically and the process takes about two minutes. Import reliability has improved significantly in recent releases, so if you tried this previously and had issues, it is worth trying again.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
          {[
            {
              title: 'Option 1: In-game migration (recommended)',
              desc: 'If GSE is still installed and enabled alongside GRIP-EMS (if you have it disabled, enable it and /reload first), open the editor with /gems and click Migrate in the sequence list. GRIP-EMS detects your GSE sequences and transfers everything automatically, including steps, variables, metadata, and multi-version data. A report in chat tells you what came across and what, if anything, needed attention.',
            },
            {
              title: 'Option 2: Clipboard import',
              desc: 'Export a sequence from GSE to your clipboard, then run /gems import in GRIP-EMS and paste the string. GRIP-EMS auto-detects the format, shows you a preview with the metadata, colour-codes any name conflicts, and lets you skip, replace or rename each one before importing.',
            },
            {
              title: 'Option 3: Convert it on LazyGrip first',
              desc: 'Paste the GSE export into the Convert tool in the Workshop and you get a GRIP-EMS string back, with a short report of what came across and the original author kept on the sequence. No account is needed and nothing you paste is saved. Then run /gems import in game and paste the result.',
            },
          ].map(opt => (
            <div key={opt.title} style={{ padding: '14px 16px', background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>{opt.title}</div>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.65 }}>{opt.desc}</div>
            </div>
          ))}
        </div>

        <p>
          After importing, run <GuideCode>/gems repairall</GuideCode> to scan every transferred sequence across 11 diagnostic categories. Most issues from format differences get flagged and fixed automatically. This takes about thirty seconds and saves you from discovering problems mid-pull.
        </p>
        <GuideInfoBox>
          Some sequences from GSE overshoot WoW&apos;s 255-character step limit. The Repair module flags any step over 255 characters and the fix is to split the oversized step into two shorter steps carrying the same spells. If repair comes back with character limit violations do not be alarmed, it is fixable in a few minutes.
        </GuideInfoBox>
        <GuideInfoBox>
          Sequences shared in English by another player import and translate to your client language automatically. Spell names stored as IDs under the hood re-render in your locale on import, so a sequence built on an English client works for German or French players without any manual editing.
        </GuideInfoBox>
      </GuideSection>

      <GuideSection title="How advancement actually works">
        <p style={{ marginBottom: 14 }}>
          GRIP-EMS advances one step per keypress and does not wait for a cast to land. What can make a press do nothing is the macro line on the step. If a /cast names a spell that is still on cooldown, WoW stops running that macro there and the lines under it never fire, so the press comes up empty and the step advances anyway. A /castsequence parked on an entry that is on cooldown behaves the same. That is the WoW macro engine reading your text, so it is not specific to GRIP-EMS. Conditional lines are different: a conditional that does not apply is skipped and the next line still runs.
        </p>
        <p style={{ marginBottom: 14 }}>
          The practical consequence is that loop length is a real cost. In a flat sequential loop every step gets one visit per pass, so a 30 step loop clicked every 150ms is roughly 4.5 seconds between visits to any single step. A press that came up empty is not retried, and that step is spent until the loop comes back around. If a defensive needs to come around faster than that, shorten the loop, move the step earlier, or give it a per-step interval.
        </p>
        <p>
          Advancement being deterministic is what makes a sequence readable. One press is one step, so a step position means something and you can reason about the rotation by reading it top to bottom. It is also what makes log comparison useful. Two runs of the same sequence at the same click rate walk the same steps in the same order, so a difference in the numbers points at the sequence or the pull rather than at the engine.
        </p>
      </GuideSection>

      <GuideSection title="What is different between the two addons">
        <p style={{ marginBottom: 14 }}>
          I have not compared GSE and GRIP-EMS feature by feature, so this is a list of what GRIP-EMS has built in, not a claim about what GSE lacks. Check what your version of GSE offers before you treat any of it as a reason to switch.
        </p>
        <p style={{ marginBottom: 14 }}>
          Keybinds are assigned inside GRIP-EMS per spec and switch when you change spec. GRIP-EMS imports GSE strings with /gems import, which also reads its own !EMS1! format. The step functions are Sequential, Priority, Reverse Priority (shown as Rev. Priority in the editor) and Random. A built-in scanner validates spells and translates them after a patch, and the Repair module fixes stale spells in one click. The Tempo Advisor learns from your actual play and recommends a click rate per sequence, with a live Faster, Slower overlay. Spell IDs are stored internally, so a shared sequence renders in the recipient&apos;s language.
        </p>
      </GuideSection>

      <GuideSection title="Things that trip up switchers specifically">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[
            {
              title: 'Looking for the action bar button',
              desc: "In GRIP-EMS the keybind is the main way to run a sequence, and you assign it inside the addon. Open the sequence editor, go to the Keybind tab, and press the key you want. GRIP-EMS also gives every sequence a character macro named GEMS: followed by the sequence name, which clicks the sequence button. You will find it in /macro, and you can drag it to an action bar if you want a button, but you do not need it for the keybind to work.",
            },
            {
              title: 'Keybind set but nothing fires',
              desc: "GRIP-EMS runs a step on key-down, so WoW's key-down casting setting has to be on; /gems status shows whether it is. As of GRIP-EMS v2.3.14 this is handled for you, so update through your addon manager first. If you are still on an older version, run /gems settings, go to the Cvar Health tab, and click Fix if anything is not green. This used to be the most common reason a switcher imported a sequence, pressed the keybind, and got nothing; on 2.3.14 and later it should not come up at all.",
            },
            {
              title: 'An opener that keeps repeating',
              desc: "In GRIP-EMS a Sequential sequence goes back to step 1 after its last step, so an opener at step 1 comes round again on every pass. Guard the opener lines with conditionals such as [nocombat] or [noform:1] so they do nothing when they are not needed, or turn on Reset on combat so each pull starts again at step 1. If you are porting a sequence whose opener was meant to run once, check this first.",
            },
            {
              title: 'Reverse Priority for finisher steps',
              desc: "Reverse Priority is a common pattern for DPS rotations that want finisher spells to fire when available. In GRIP-EMS it weights the loop toward the tail, so the last step gets most of the presses and the front of the loop gets very few. That is rarely what a finisher rotation wants. If you are porting a sequence that used Reverse Priority for finishers, rebuild it as Sequential with the finisher placed where you want it in the loop, or use Priority and put the spells that should get the most presses at the front.",
            },
            {
              title: 'Spell names after a patch',
              desc: "Blizzard renames and reshuffles spells with some patches, and sequences that were working silently stop working because a spell name no longer matches. GRIP-EMS scans for this automatically and flags broken steps with a red indicator in the editor. Run /gems validate after any patch that touches your spec and /gems repairall to fix what it finds. Most stale spells are resolved automatically without any manual editing.",
            },
          ].map(item => (
            <div key={item.title} style={{ padding: '14px 16px', background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>{item.title}</div>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.65 }}>{item.desc}</div>
            </div>
          ))}
        </div>
      </GuideSection>

      <GuideSection title="You do not have to choose permanently">
        <p style={{ marginBottom: 12 }}>
          Both addons can be installed at the same time and the sequence formats do not cross-contaminate. A reasonable approach is to move one spec across first, the one whose sequence you edit and tune the most, and keep your existing GSE sequences for everything else until you have decided the tooling is worth the move for those specs too.
        </p>
        <p>
          You can move a sequence across with the <Link href="/workshop/convert" style={{ color: 'var(--accent)', textDecoration: 'none' }}>Convert tool</Link> in the Workshop, or by pasting the GSE export straight into /gems import, and the underlying macro logic is the same either way since both addons use WoW&apos;s standard macro conditional syntax. Step spacing and timing can still shift once the step count or the click rate changes, so plan on a validation pass after porting rather than assuming the numbers will be identical.
        </p>
      </GuideSection>

      <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 16, borderTop: '0.5px solid var(--border)' }}>
        <Link href="/guide/building-sequences" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', textDecoration: 'none' }}>
          <ArrowLeft size={14} /> Building sequences
        </Link>
        <Link href="/guide/validating" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 'var(--text-sm)', color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>
          Next: Validating your work <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  )
}
