import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, ArrowLeft } from 'lucide-react'
import GuideHeader from '@/components/guide/GuideHeader'
import GuideSection from '@/components/guide/GuideSection'
import GuideInfoBox from '@/components/guide/GuideInfoBox'
import GuideCode from '@/components/guide/GuideCode'

export const metadata: Metadata = {
  title: 'Coming from the Legacy Program | GRIP-EMS Guide',
  description: 'If you use another older macro sequencing addon and are evaluating GRIP-EMS, this section covers how step advancement actually works, what transfers automatically, and what to watch for.',
  alternates: {
    canonical: 'https://lazygrip.net/guide/from-legacy-program',
  },
  openGraph: {
    title: 'Coming from the Legacy Program | GRIP-EMS Guide',
    description: 'If you use another older macro sequencing addon and are evaluating GRIP-EMS, this section covers how step advancement actually works, what transfers automatically, and what to watch for.',
    url: 'https://lazygrip.net/guide/from-legacy-program',
    siteName: 'LazyGrip.net',
    type: 'website',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'LazyGrip.net — GRIP-EMS sequences for World of Warcraft' }],
  },
}

function CompareRow({ label, grip, gse }: { label: string; grip: string; gse: string }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr 1fr', gap: 1 }}>
      <div style={{ padding: '10px 14px', background: 'var(--bg-primary)', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', fontWeight: 500 }}>{label}</div>
      <div style={{ padding: '10px 14px', background: 'var(--accent-subtle)', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>{grip}</div>
      <div style={{ padding: '10px 14px', background: 'var(--bg-primary)', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>{gse}</div>
    </div>
  )
}

export default function FromLegacyProgramPage() {
  return (
    <div>
      <GuideHeader
        crumbLabel="Coming from the legacy program"
        title="Coming from the legacy program"
        description="If you use an older macro sequencing addon and are evaluating whether to switch, this section is written specifically for you. The legacy program works and a lot of good sequences exist for it. The reason to use GRIP-EMS is the structure you can build into a sequence and the diagnostic tooling around it, plus the fact that every feature is free. This is not a pitch, it is an honest breakdown of what is different."
      />

      <GuideSection title="Getting your sequences into GRIP-EMS">
        <p style={{ marginBottom: 14 }}>
          This is probably what you came here for first. GRIP-EMS imports sequences from the legacy program automatically and the process takes about two minutes. Import reliability has improved significantly in recent releases, so if you tried this previously and had issues, it is worth trying again.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
          {[
            {
              title: 'Option 1: In-game migration (recommended)',
              desc: 'If the legacy program is still installed alongside GRIP-EMS, open the editor with /gems and click Migrate in the sequence list. GRIP-EMS detects your legacy sequences and transfers everything automatically, including steps, variables, metadata, and multi-version data. A report in chat tells you what came across and what, if anything, needed attention.',
            },
            {
              title: 'Option 2: Clipboard import',
              desc: 'Export a sequence from the legacy program to your clipboard, then run /gems import in GRIP-EMS and paste the string. GRIP-EMS auto-detects the format, shows you a preview with metadata and a checksum status, and lets you handle any naming conflicts before importing.',
            },
          ].map(opt => (
            <div key={opt.title} style={{ padding: '14px 16px', background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>{opt.title}</div>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.65 }}>{opt.desc}</div>
            </div>
          ))}
        </div>

        <p>
          After importing, run <GuideCode>/gems repairall</GuideCode> to scan every transferred sequence across 13 diagnostic categories. Most issues from format differences get flagged and fixed automatically. This takes about thirty seconds and saves you from discovering problems mid-pull.
        </p>
        <GuideInfoBox>
          Sequences from the legacy program frequently overshoot WoW&apos;s 255-character step limit because it builds longer individual step strings than GRIP-EMS allows. The Repair module flags these on import and the fix is to split the oversized step into two shorter steps carrying the same spells. This is one of the most common issues when porting sequences from the legacy program, so if repair comes back with character limit violations do not be alarmed, it is normal and fixable in a few minutes.
        </GuideInfoBox>
        <GuideInfoBox>
          Sequences shared in English by another player import and translate to your client language automatically. Spell names stored as IDs under the hood re-render in your locale on import, so a sequence built on an English client works for German or French players without any manual editing.
        </GuideInfoBox>
      </GuideSection>

      <GuideSection title="How advancement actually works">
        <p style={{ marginBottom: 14 }}>
          Both engines advance one step per keypress and neither one waits for a cast to land. What can make a press do nothing is the macro line on the step. If a /cast names a spell that is still on cooldown, WoW stops running that macro there and the lines under it never fire, so the press comes up empty and the step advances anyway. A /castsequence parked on an entry that is on cooldown behaves the same. That is the WoW macro engine reading your text, so you get it under either addon. Conditional lines are different: a conditional that does not apply is skipped and the next line still runs.
        </p>
        <p style={{ marginBottom: 14 }}>
          The practical consequence is that loop length is a real cost. In a flat sequential loop every step gets one visit per pass, so a 30 step loop clicked every 150ms is roughly 4.5 seconds between visits to any single step. A press that came up empty is not retried, and that step is spent until the loop comes back around. If a defensive needs to come around faster than that, shorten the loop, move the step earlier, or give it a per-step interval.
        </p>
        <p>
          Advancement being deterministic is what makes a sequence readable. One press is one step, so a step position means something and you can reason about the rotation by reading it top to bottom. It is also what makes log comparison useful. Two runs of the same sequence at the same click rate walk the same steps in the same order, so a difference in the numbers points at the sequence or the pull rather than at the engine.
        </p>
      </GuideSection>

      <GuideSection title="What is different between the two addons">
        <div style={{ background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden', marginBottom: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr 1fr', gap: 1, background: 'var(--border)' }}>
            <div style={{ padding: '10px 14px', background: 'var(--bg-secondary)', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}></div>
            <div style={{ padding: '10px 14px', background: 'var(--bg-secondary)', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>GRIP-EMS</div>
            <div style={{ padding: '10px 14px', background: 'var(--bg-secondary)', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Legacy program</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--border)' }}>
            <CompareRow label="Action bar button" grip="Single-version sequences have no bar button. Multi-version sequences create a macro you can place on your bar." gse="Creates a draggable button you place on a bar" />
            <CompareRow label="Keybinds" grip="Assigned inside GRIP-EMS per spec, auto-switch on spec change" gse="Via the action bar button you place and bind" />
            <CompareRow label="Import format" grip="!EMS1! format, import legacy program strings with /gems import" gse="Base64 string with version prefix" />
            <CompareRow label="Step functions" grip="Sequential, Priority, Reverse Priority, Random" gse="Sequential, Priority, and others depending on version" />
            <CompareRow label="Opener logic" grip="True single-block loop, step 1 is only the opener" gse="Block 1 fires between every loop step when compiled, not just once" />
            <CompareRow label="Spell validation" grip="Built-in scanner with patch-aware auto-translation" gse="Limited or absent depending on version" />
            <CompareRow label="Click rate guidance" grip="Tempo Advisor learns from your actual play and recommends a click rate per sequence, with a live Faster/Slower overlay" gse="None built in" />
            <CompareRow label="Post-patch repair" grip="Repair module fixes stale spells in one click" gse="Manual identification and replacement" />
            <CompareRow label="Cross-language sharing" grip="Spell IDs stored internally, renders in recipient's language" gse="Spell names in source language, may not fire on other clients" />
          </div>
        </div>
      </GuideSection>

      <GuideSection title="Things that trip up switchers specifically">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[
            {
              title: 'Looking for the action bar button',
              desc: "The legacy program creates a macro button you drag to your action bar and bind to a key. GRIP-EMS works differently. You assign a keybind inside the addon directly. For single-version sequences there is nothing to drag. For sequences with multiple versions, GRIP-EMS creates a macro that can be placed on your bar, but the keybind is still assigned inside the addon. Open the sequence editor, go to the Keybinds tab, and press the key you want.",
            },
            {
              title: 'Keybind set but nothing fires',
              desc: "The legacy program works fine with WoW's default key-up event behavior. GRIP-EMS requires key-down. As of GRIP-EMS v2.3.14 this is forced on automatically, so update through your addon manager first. If you are still on an older version, run /gems settings, go to the Cvar Health tab, and click Fix if anything is not green. This used to be the most common reason a switcher imported a sequence, pressed the keybind, and got nothing; on 2.3.14 and later it should not come up at all.",
            },
            {
              title: 'Multi-block opener logic behaving unexpectedly',
              desc: "In the legacy program, putting your opener in Block 1 and your main rotation in a Loop block seems like clean architecture, but Block 1 fires between every loop step when the sequence compiles, not just once at the start. Opener spells end up firing far more often than intended. GRIP-EMS does not have this problem because Sequential step function advances linearly. Step 1 is step 1 and not a recurring block. If you are porting a sequence that used this pattern, rebuild it as a flat Sequential loop in GRIP-EMS.",
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
          Both addons can be installed at the same time and the sequence formats do not cross-contaminate. A reasonable approach is to move one spec across first, the one whose sequence you edit and tune the most, and keep your existing legacy program sequences for everything else until you have decided the tooling is worth the move for those specs too.
        </p>
        <p>
          Translating sequences between the formats is not automatic, but the underlying macro logic is the same since both addons use WoW&apos;s standard macro conditional syntax. A sequence from the legacy program can be rebuilt in GRIP-EMS step by step without starting from scratch. Step spacing and timing can still shift once the step count or the click rate changes, so plan on a validation pass after porting rather than assuming the numbers will be identical.
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
