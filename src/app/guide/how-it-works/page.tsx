import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

export const metadata: Metadata = {
  title: 'How GRIP-EMS Works — GRIP-EMS Guide',
  description: 'The mental model behind GRIP-EMS: the secure execution environment, what you can and cannot do inside a sequence, and how the step engine actually behaves.',
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 40 }}>
      <h2 style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 14, color: 'var(--text-primary)' }}>
        {title}
      </h2>
      {children}
    </section>
  )
}

function Body({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.75, marginBottom: 12 }}>
      {children}
    </p>
  )
}

function CompareRow({ label, grip, gse }: { label: string; grip: string; gse: string }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr 1fr 1fr',
      gap: 1,
    }}>
      <div style={{ padding: '10px 14px', background: 'var(--bg-tertiary)', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>
        {label}
      </div>
      <div style={{ padding: '10px 14px', background: 'var(--accent-subtle)', fontSize: 13, color: 'var(--accent-text)' }}>
        {grip}
      </div>
      <div style={{ padding: '10px 14px', background: 'var(--bg-primary)', fontSize: 13, color: 'var(--text-secondary)' }}>
        {gse}
      </div>
    </div>
  )
}

export default function HowItWorksPage() {
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
          How GRIP-EMS works
        </h1>
        <p style={{ fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.75, maxWidth: 600 }}>
          Before you build a sequence, you need the right mental model. Two things in particular will save you hours of confusion: understanding what WoW's secure execution environment actually restricts, and understanding exactly how GRIP-EMS advances through steps compared to other rotation addons.
        </p>
      </div>

      <Section title="The secure execution environment">
        <Body>
          WoW runs addon code that interacts with combat in a restricted sandbox called the secure execution environment. Blizzard built this to prevent addons from automating decisions — things like "cast this spell if my health is below 40%" or "use this cooldown if the boss is casting X." Inside a macro or sequence step, a meaningful chunk of the Lua API is simply not available.
        </Body>
        <Body>
          This catches a lot of new users who come from programming backgrounds and assume they can write logic into their sequences. The most common example is trying to check a resource value like combo points or holy power with something like <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12, background: 'var(--bg-tertiary)', borderRadius: 4, padding: '1px 5px' }}>UnitPower("player")</code> or <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12, background: 'var(--bg-tertiary)', borderRadius: 4, padding: '1px 5px' }}>GetTime()</code>. Both of those calls return nil inside a secure handler because they're part of the restricted API. The sequence doesn't error gracefully — it crashes.
        </Body>
        <Body>
          What you can use inside sequence steps is the standard macro conditional system that Blizzard has explicitly allowed: <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12, background: 'var(--bg-tertiary)', borderRadius: 4, padding: '1px 5px' }}>[combat]</code>, <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12, background: 'var(--bg-tertiary)', borderRadius: 4, padding: '1px 5px' }}>[mod:shift]</code>, <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12, background: 'var(--bg-tertiary)', borderRadius: 4, padding: '1px 5px' }}>[known:SpellName]</code>, <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12, background: 'var(--bg-tertiary)', borderRadius: 4, padding: '1px 5px' }}>[noform:1]</code>, <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12, background: 'var(--bg-tertiary)', borderRadius: 4, padding: '1px 5px' }}>[nochanneling]</code>, and the rest of the documented macro conditional set. These are not API calls — they're tokens the macro engine parses directly and they're allowed because they don't read arbitrary game state.
        </Body>
        <Body>
          GRIP-EMS's Variables system exists partly to work around this limitation. Variables are resolved outside the secure environment before the macro compiles, which means you can use them to make conditional decisions that would be impossible inside a step directly. This is an advanced topic covered in the building sequences section.
        </Body>
      </Section>

      <Section title="How the step engine actually advances">
        <Body>
          GRIP-EMS is a Sequential step engine by default, which means it fires step 1, then step 2, then step 3, advancing one step per keypress and looping back to step 1 after the last step. That's the simple version. The important detail is in what happens when a step fails to cast.
        </Body>

        <div style={{
          background: 'var(--bg-primary)',
          border: '0.5px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: '20px',
          marginBottom: 16,
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 14 }}>
            Failed cast behavior
          </div>
          <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
            <div style={{ flex: 1, padding: '14px', background: 'var(--accent-subtle)', border: '0.5px solid rgba(29,158,117,0.25)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent-text)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>GRIP-EMS</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                Holds on the current step. The sequence does not advance until the cast succeeds. Step 3 stays at step 3 until the spell actually fires.
              </div>
            </div>
            <div style={{ flex: 1, padding: '14px', background: 'var(--bg-tertiary)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>GSE</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                Skips the failed step and advances to the next one. The sequence keeps moving regardless of whether the spell landed.
              </div>
            </div>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
            For tank rotations this difference is significant. Ironfur uptime, Thrash frequency, and cooldown timing all depend on spells landing in the right order. When the engine skips, high-value spells get pushed back by failed steps accumulating ahead of them. When the engine holds, your uptime numbers are consistent pull to pull.
          </p>
        </div>
      </Section>

      <Section title="Step functions">
        <Body>
          GRIP-EMS supports four step functions that control how the engine decides which step fires next. Sequential is the default and the one you'll use for most rotations. Understanding the others tells you when you might reach for them.
        </Body>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {[
            {
              name: 'Sequential',
              desc: 'Fires step 1, then 2, then 3, loops to 1. One advance per keypress. This is the correct choice for rotations where order matters — tank defensive cycling, opener sequences, anything where a spell at step 5 is supposed to come after the spells at steps 1 through 4.',
              recommended: true,
            },
            {
              name: 'Priority',
              desc: 'On every keypress, starts from step 1 and fires the first step that succeeds. Never advances past a step that can cast. Good for DPS rotations where you always want your highest-priority spell to fire when it\'s available, regardless of where you are in the loop.',
              recommended: false,
            },
            {
              name: 'Reverse Priority',
              desc: 'Starts from the last step and works backwards. Rarely useful. In practice this means your lowest-priority step fires almost every press because it\'s the last one checked and usually the easiest to satisfy. Avoid for finisher steps in any resource-based rotation.',
              recommended: false,
            },
            {
              name: 'Random',
              desc: 'Fires a random step each press. Useful for very specific situations like randomizing a proc-based spell into different positions to avoid predictable timing. Not useful for structured rotations.',
              recommended: false,
            },
          ].map(sf => (
            <div key={sf.name} style={{
              padding: '14px',
              background: 'var(--bg-primary)',
              border: `0.5px solid ${sf.recommended ? 'rgba(29,158,117,0.3)' : 'var(--border)'}`,
              borderRadius: 'var(--radius-md)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{sf.name}</span>
                {sf.recommended && (
                  <span style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: 'var(--accent-text)',
                    background: 'var(--accent-subtle)',
                    border: '0.5px solid rgba(29,158,117,0.2)',
                    borderRadius: 99,
                    padding: '1px 7px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                  }}>
                    Default
                  </span>
                )}
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.65 }}>{sf.desc}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Reset conditions">
        <Body>
          Reset conditions send the sequence back to step 1. GRIP-EMS supports five of them and they can be combined.
        </Body>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
          {[
            { name: 'Reset on combat', desc: 'Resets to step 1 when you leave combat. Most tank and DPS sequences should have this enabled so your opener fires at the start of each pull.' },
            { name: 'Reset on target', desc: 'Resets when your target changes. Useful for sequences with a target-specific opener that you want to replay on each new target.' },
            { name: 'Reset on spec', desc: 'Resets when you change spec. Usually unnecessary if your sequences are spec-specific.' },
            { name: 'Reset on gear', desc: 'Resets on gear swap. Relevant if you use gear sets that change your stat priorities mid-session.' },
            { name: 'Timer reset', desc: 'Resets after a set number of seconds without a keypress. Useful as a fallback to catch sequences that got stuck mid-rotation during an interruption.' },
          ].map(rc => (
            <div key={rc.name} style={{
              display: 'grid',
              gridTemplateColumns: '160px 1fr',
              gap: 12,
              padding: '10px 14px',
              background: 'var(--bg-primary)',
              border: '0.5px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              alignItems: 'start',
            }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{rc.name}</span>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{rc.desc}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="The visual display layer vs. what actually executes">
        <Body>
          This one is worth knowing because it causes real confusion in the Discord regularly. GRIP-EMS has two separate things: the visual preview of your sequence in the editor, and the compiled macro output that actually runs when you press your keybind. They are not the same thing.
        </Body>
        <Body>
          The visual layer renders steps it can match against known spells in its database. Steps it can't match — certain raw macro lines, some conditional constructs, hero talent override spells under specific conditions — don't show in the preview. But they still exist in the compiled output and WoW's macro engine executes them correctly. A step that's invisible in the editor is not a broken step.
        </Body>
        <Body>
          This passthrough behavior is intentional and is how GRIP-EMS supports custom macro syntax that the addon's parser doesn't explicitly recognize. If you see fewer steps in the preview than you built, and your sequence is otherwise working, this is almost certainly why.
        </Body>
      </Section>

      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        paddingTop: 16,
        borderTop: '0.5px solid var(--border)',
      }}>
        <Link href="/guide/installation" style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 14,
          color: 'var(--text-secondary)',
          textDecoration: 'none',
        }}>
          ← Installation
        </Link>
        <Link href="/guide/building-sequences" style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 14,
          color: 'var(--accent)',
          textDecoration: 'none',
          fontWeight: 500,
        }}>
          Next: Building sequences <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  )
}
