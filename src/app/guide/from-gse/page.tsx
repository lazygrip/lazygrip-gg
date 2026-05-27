import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Coming from GSE — GRIP-EMS Guide',
  description: 'If you use GnomeSequencer Enhanced and you\'re skeptical about switching, this section is written for you. What\'s different, what transfers, and what to watch for.',
}

function Body({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.75, marginBottom: 12 }}>
      {children}
    </p>
  )
}

function CompareTable({ rows }: { rows: { topic: string; gse: string; grip: string }[] }) {
  return (
    <div style={{
      border: '0.5px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      overflow: 'hidden',
      marginBottom: 16,
    }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        background: 'var(--bg-tertiary)',
        borderBottom: '0.5px solid var(--border)',
      }}>
        {['', 'GSE', 'GRIP-EMS'].map((h, i) => (
          <div key={i} style={{
            padding: '8px 14px',
            fontSize: 11,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: i === 2 ? 'var(--accent-text)' : 'var(--text-muted)',
          }}>
            {h}
          </div>
        ))}
      </div>
      {rows.map((row, i) => (
        <div key={i} style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          borderBottom: i < rows.length - 1 ? '0.5px solid var(--border)' : 'none',
        }}>
          <div style={{ padding: '10px 14px', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', background: 'var(--bg-tertiary)' }}>
            {row.topic}
          </div>
          <div style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text-secondary)', background: 'var(--bg-primary)' }}>
            {row.gse}
          </div>
          <div style={{ padding: '10px 14px', fontSize: 12, color: 'var(--accent-text)', background: 'var(--accent-subtle)' }}>
            {row.grip}
          </div>
        </div>
      ))}
    </div>
  )
}

export default function FromGSEPage() {
  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{
          fontSize: 28,
          fontWeight: 600,
          letterSpacing: '-0.03em',
          lineHeight: 1.2,
          marginBottom: 12,
          color: 'var(--text-primary)',
        }}>
          Coming from GSE
        </h1>
        <p style={{ fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.75, maxWidth: 600 }}>
          If you've used GnomeSequencer Enhanced and you're evaluating whether to switch, this section is written specifically for you. The honest version: GSE works and a lot of good sequences exist for it. The reason to use GRIP-EMS is a specific mechanical difference that matters for certain content at certain difficulty levels, not because one addon is categorically better.
        </p>
      </div>

      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 14, color: 'var(--text-primary)' }}>
          The one difference that actually matters
        </h2>
        <Body>
          GSE skips failed cast steps and advances to the next one. GRIP-EMS holds on failed steps until the cast succeeds. That's the entire mechanical distinction and everything else follows from it.
        </Body>
        <Body>
          For DPS sequences at normal or heroic difficulty this difference is minor. Skipping a failed Fireball because you were moving costs you a cast, but your rotation recovers quickly and the overall output doesn't shift much. For tank sequences in Mythic+ it compounds differently. When Ironfur fails because the GCD hasn't cleared and the sequence skips ahead, the Ironfur step doesn't fire again for another full loop rotation, which at 30 steps and 150ms intervals is roughly 4.5 seconds. If your loop has three Ironfur steps and all three skip on the same pull, your uptime collapses for that window. Hold behavior prevents this. The sequence waits for the cast to land before moving on, so the step count stays meaningful.
        </Body>
      </section>

      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 14, color: 'var(--text-primary)' }}>
          What's different between the two
        </h2>
        <CompareTable rows={[
          { topic: 'Failed cast', gse: 'Skips the step, advances', grip: 'Holds until cast succeeds' },
          { topic: 'Action bar button', gse: 'Creates a draggable button you place on a bar', grip: 'No bar button — keybind fires directly through the addon' },
          { topic: 'Sequence editor', gse: 'Block-based with multiple block types', grip: 'Step-based with a visual editor and rotation preview' },
          { topic: 'Import format', gse: 'Base64 string starting with a version prefix', grip: '!EMS1! format — separate, not cross-compatible' },
          { topic: 'Keybinds', gse: 'Via the action bar button you place', grip: 'Assigned inside GRIP-EMS per spec, no bar required' },
          { topic: 'Step functions', gse: 'Sequential, Priority, and others depending on version', grip: 'Sequential, Priority, Reverse Priority, Random' },
          { topic: 'Multi-block / opener', gse: 'Block 1 fires between every loop step when compiled, not just once', grip: 'True single-block sequential loop — step 1 is only the opener' },
          { topic: 'Variables', gse: 'Conditional logic in some versions', grip: 'Variables system resolved before secure compilation' },
          { topic: 'Spell validation', gse: 'Limited or absent depending on version', grip: 'Built-in stale spell detector with respec auto-translation' },
        ]} />
      </section>

      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 14, color: 'var(--text-primary)' }}>
          Things that trip up GSE users specifically
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            {
              title: 'Looking for the action bar button',
              body: 'GSE creates a macro button you drag to an action bar and then bind. GRIP-EMS doesn\'t work this way — you assign a keybind inside the addon and the sequence fires through that bind directly. There\'s no button to look for. If you open GRIP-EMS, import a sequence, and immediately go looking for something to drag to your bars, you\'re going to be confused. Go to the Keybinds tab in the sequence editor instead.',
            },
            {
              title: 'The Cvar Health setting',
              body: 'GSE works fine with WoW\'s default key-up event behavior. GRIP-EMS requires key-down. This is the most common reason a GSE user imports a sequence, presses the keybind, and gets nothing. Check the Cvar Health tab in settings before assuming anything is broken with the sequence itself.',
            },
            {
              title: 'Multi-block opener logic',
              body: 'In GSE, separating your opener into Block 1 and your main rotation into a Loop block seems like clean architecture, but Block 1 fires between every loop step when the sequence compiles rather than just once at the start. This means your opener spells fire far more often than intended, inflating CPM for those abilities and collapsing the main rotation. GRIP-EMS doesn\'t have this problem because the Sequential step function advances linearly — step 1 is step 1, not a recurring block.',
            },
            {
              title: 'Reverse Priority for finisher steps',
              body: 'Reverse Priority in GSE is a common pattern for DPS rotations that want finisher spells to fire when available. The problem is that low-weighted finisher steps almost never execute because Reverse Priority starts from the last step and works backwards, meaning the easiest-to-satisfy step fires most of the time. If you\'re porting a GSE sequence that used Reverse Priority for finishers, rebuild it in GRIP-EMS as Sequential with the finisher steps in the right position in the loop rather than trusting Reverse Priority to find them.',
            },
          ].map(item => (
            <div key={item.title} style={{
              padding: '16px',
              background: 'var(--bg-primary)',
              border: '0.5px solid var(--border)',
              borderRadius: 'var(--radius-md)',
            }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>{item.title}</div>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 14, color: 'var(--text-primary)' }}>
          You don't have to choose one permanently
        </h2>
        <Body>
          Both addons can be installed at the same time. The sequence formats don't cross-contaminate. A reasonable approach is to run GRIP-EMS for your main spec in content where consistent uptime actually matters — Mythic+ tanking is the obvious case — and keep your existing GSE sequences for everything else until you've validated that GRIP-EMS produces better numbers for those specs too.
        </Body>
        <Body>
          Translating sequences between the two formats isn't automatic, but the underlying macro logic is the same since both use WoW's standard macro conditional syntax. A GSE sequence can be rebuilt in GRIP-EMS step by step without starting from scratch. The step spacing and timing will change because the execution models are different, so plan on a validation pass after porting rather than assuming the numbers will be identical.
        </Body>
      </section>

      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        paddingTop: 16,
        borderTop: '0.5px solid var(--border)',
      }}>
        <Link href="/guide/building-sequences" style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 14,
          color: 'var(--text-secondary)',
          textDecoration: 'none',
        }}>
          ← Building sequences
        </Link>
        <Link href="/guide/validating" style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 14,
          color: 'var(--accent)',
          textDecoration: 'none',
          fontWeight: 500,
        }}>
          Next: Validating your work <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  )
}
