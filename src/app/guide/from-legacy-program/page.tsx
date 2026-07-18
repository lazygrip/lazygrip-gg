import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, ArrowLeft } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Coming from the Legacy Program | GRIP-EMS Guide | LazyGrip.net',
  description: 'If you use another older macro sequencing addon and are evaluating GRIP-EMS, this section covers the one mechanical difference that matters, what transfers automatically, and what to watch for.',
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12, background: 'var(--bg-tertiary)', border: '0.5px solid var(--border-strong)', borderRadius: 'var(--radius-sm)', padding: '1px 6px', color: 'var(--accent-text)' }}>
      {children}
    </code>
  )
}

function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '14px 16px', marginTop: 14, marginBottom: 4 }}>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>{children}</div>
    </div>
  )
}

function CompareRow({ label, grip, gse }: { label: string; grip: string; gse: string }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr 1fr', gap: 1 }}>
      <div style={{ padding: '10px 14px', background: 'var(--bg-primary)', fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>{label}</div>
      <div style={{ padding: '10px 14px', background: 'var(--accent-subtle)', fontSize: 13, color: 'var(--text-secondary)' }}>{grip}</div>
      <div style={{ padding: '10px 14px', background: 'var(--bg-primary)', fontSize: 13, color: 'var(--text-secondary)' }}>{gse}</div>
    </div>
  )
}

export default function FromLegacyProgramPage() {
  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1.2, marginBottom: 12, color: 'var(--text-primary)' }}>
          Coming from the legacy program
        </h1>
        <p style={{ fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.75, maxWidth: 620 }}>
          If you use an older macro sequencing addon and are evaluating whether to switch, this section is written specifically for you. The legacy program works and a lot of good sequences exist for it. The reason to use GRIP-EMS is a specific mechanical difference that matters for certain content at certain difficulty levels, and a set of diagnostic tools that do not exist in the legacy program. This is not a pitch, it is an honest breakdown of what is different.
        </p>
      </div>

      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 14, color: 'var(--text-primary)' }}>
          Getting your sequences into GRIP-EMS
        </h2>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.75, marginBottom: 14 }}>
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
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>{opt.title}</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.65 }}>{opt.desc}</div>
            </div>
          ))}
        </div>

        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.75 }}>
          After importing, run <Code>/gems repairall</Code> to scan every transferred sequence across 13 diagnostic categories. Most issues from format differences get flagged and fixed automatically. This takes about thirty seconds and saves you from discovering problems mid-pull.
        </p>
        <InfoBox>
          Sequences from the legacy program frequently overshoot WoW&apos;s 255-character step limit because it builds longer individual step strings than GRIP-EMS allows. The Repair module flags these on import and the fix is to split the oversized step into two shorter steps carrying the same spells. This is one of the most common issues when porting sequences from the legacy program, so if repair comes back with character limit violations do not be alarmed, it is normal and fixable in a few minutes.
        </InfoBox>
        <InfoBox>
          Sequences shared in English by another player import and translate to your client language automatically. Spell names stored as IDs under the hood re-render in your locale on import, so a sequence built on an English client works for German or French players without any manual editing.
        </InfoBox>
      </section>

      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 14, color: 'var(--text-primary)' }}>
          The one difference that actually matters
        </h2>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.75, marginBottom: 14 }}>
          The legacy program skips failed cast steps and advances to the next one. GRIP-EMS holds on failed steps until the cast succeeds. That is the entire mechanical distinction and everything else follows from it.
        </p>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.75, marginBottom: 14 }}>
          For DPS sequences at normal or heroic difficulty, this difference is minor. A skipped Fireball because you were moving costs you one cast and the rotation recovers quickly. For tank sequences in Mythic+ it compounds in a way that matters. When Ironfur fails because the GCD has not cleared and the sequence skips ahead, that Ironfur step does not appear again until the next full loop rotation. At 30 steps and 150ms intervals that is roughly 4.5 seconds. If three Ironfur steps skip on the same pull, your uptime collapses for that window and your healer feels it before your logs do.
        </p>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.75 }}>
          Hold behavior means the sequence waits for the cast to land before moving on. Step positions stay meaningful and uptime numbers stay consistent pull to pull. This is also what makes log-based validation reliable, because if the sequence advanced unpredictably you could not compare two runs meaningfully.
        </p>
      </section>

      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 14, color: 'var(--text-primary)' }}>
          What is different between the two addons
        </h2>

        <div style={{ background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden', marginBottom: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr 1fr', gap: 1, background: 'var(--border)' }}>
            <div style={{ padding: '10px 14px', background: 'var(--bg-secondary)', fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}></div>
            <div style={{ padding: '10px 14px', background: 'var(--bg-secondary)', fontSize: 12, fontWeight: 600, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>GRIP-EMS</div>
            <div style={{ padding: '10px 14px', background: 'var(--bg-secondary)', fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Legacy program</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--border)' }}>
            <CompareRow label="Failed cast" grip="Holds until cast succeeds" gse="Skips the step, advances" />
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
      </section>

      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 14, color: 'var(--text-primary)' }}>
          Things that trip up switchers specifically
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[
            {
              title: 'Looking for the action bar button',
              desc: "The legacy program creates a macro button you drag to your action bar and bind to a key. GRIP-EMS works differently. You assign a keybind inside the addon directly. For single-version sequences there is nothing to drag. For sequences with multiple versions, GRIP-EMS creates a macro that can be placed on your bar, but the keybind is still assigned inside the addon. Open the sequence editor, go to the Keybinds tab, and press the key you want.",
            },
            {
              title: 'Keybind set but nothing fires',
              desc: "This is almost always the Cvar Health setting. The legacy program works fine with WoW's default key-up event behavior. GRIP-EMS requires key-down. Run /gems settings, go to the Cvar Health tab, and click Fix if anything is not green. This is the most common reason a switcher imports a sequence, presses the keybind, and gets nothing.",
            },
            {
              title: 'Multi-block opener logic behaving unexpectedly',
              desc: "In the legacy program, putting your opener in Block 1 and your main rotation in a Loop block seems like clean architecture, but Block 1 fires between every loop step when the sequence compiles, not just once at the start. Opener spells end up firing far more often than intended. GRIP-EMS does not have this problem because Sequential step function advances linearly. Step 1 is step 1 and not a recurring block. If you are porting a sequence that used this pattern, rebuild it as a flat Sequential loop in GRIP-EMS.",
            },
            {
              title: 'Reverse Priority for finisher steps',
              desc: "Reverse Priority in the legacy program is a common pattern for DPS rotations that want finisher spells to fire when available. The problem is that Reverse Priority starts from the last step and works backwards, so the easiest-to-satisfy step fires most of the time and finishers rarely get a turn. If you are porting a sequence that used Reverse Priority for finishers, rebuild it in GRIP-EMS as Sequential with the finisher steps placed correctly in the loop, or use Priority with the finisher at a step position where it gets tried after higher-priority abilities have been checked.",
            },
            {
              title: 'Spell names after a patch',
              desc: "Blizzard renames and reshuffles spells with some patches, and sequences that were working silently stop working because a spell name no longer matches. GRIP-EMS scans for this automatically and flags broken steps with a red indicator in the editor. Run /gems validate after any patch that touches your spec and /gems repairall to fix what it finds. Most stale spells are resolved automatically without any manual editing.",
            },
          ].map(item => (
            <div key={item.title} style={{ padding: '14px 16px', background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>{item.title}</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.65 }}>{item.desc}</div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 14, color: 'var(--text-primary)' }}>
          You do not have to choose permanently
        </h2>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.75, marginBottom: 12 }}>
          Both addons can be installed at the same time and the sequence formats do not cross-contaminate. A reasonable approach is to run GRIP-EMS for your main spec in content where consistent uptime actually matters, Mythic+ tanking being the obvious case, and keep your existing legacy program sequences for everything else until you have validated that GRIP-EMS produces better numbers for those specs too.
        </p>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.75 }}>
          Translating sequences between the formats is not automatic, but the underlying macro logic is the same since both addons use WoW&apos;s standard macro conditional syntax. A sequence from the legacy program can be rebuilt in GRIP-EMS step by step without starting from scratch. The step spacing and timing will differ because the execution models are different, so plan on a validation pass after porting rather than assuming the numbers will be identical.
        </p>
      </section>

      <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 16, borderTop: '0.5px solid var(--border)' }}>
        <Link href="/guide/building-sequences" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14, color: 'var(--text-tertiary)', textDecoration: 'none' }}>
          <ArrowLeft size={14} /> Building sequences
        </Link>
        <Link href="/guide/validating" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14, color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>
          Next: Validating your work <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  )
}
