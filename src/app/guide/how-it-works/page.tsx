import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'How GRIP-EMS Works | GRIP-EMS Guide | LazyGrip.net',
  description: 'The mental model behind GRIP-EMS: the secure execution environment, what you can and cannot do inside a sequence, and how the step engine actually behaves.',
}

export default function HowItWorksPage() {
  return (
    <div style={{ maxWidth: 720 }}>
      <nav style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 24, display: 'flex', gap: 6, alignItems: 'center' }}>
        <Link href="/guide" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>Guide</Link>
        <span>/</span>
        <span style={{ color: 'var(--text-primary)' }}>How it works</span>
      </nav>

      <h1 style={{ fontSize: 32, fontWeight: 700, letterSpacing: '-0.03em', marginBottom: 12 }}>
        How GRIP-EMS works
      </h1>
      <p style={{ fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 40 }}>
        Before you build a sequence, you need the right mental model. Three things in particular will save you hours of confusion: understanding what WoW's secure execution environment actually restricts, understanding exactly how GRIP-EMS advances through steps compared to other rotation addons, and understanding how hold-on-failure behavior changes the way you write individual steps.
      </p>

      <Section title="The secure execution environment">
        <p>WoW runs addon code that interacts with combat in a restricted sandbox called the secure execution environment. Blizzard built this to prevent addons from automating decisions. Things like casting a spell when health is below 40% or using a cooldown when the boss is casting a specific ability are blocked because they would read arbitrary game state to make combat decisions. Inside a macro or sequence step, a meaningful portion of the Lua API is simply not available.</p>
        <p style={{ marginTop: 12 }}>This catches many new users who come from programming backgrounds and assume they can write logic into their sequences. The most common example is trying to check a resource value like combo points or holy power with <code style={code}>UnitPower("player")</code> or timing logic with <code style={code}>GetTime()</code>. Both of those calls return nil inside a secure handler because they are part of the restricted API. The sequence does not error gracefully, it crashes.</p>
        <p style={{ marginTop: 12 }}>What you can use inside sequence steps is the standard macro conditional system that Blizzard has explicitly allowed: <code style={code}>[combat]</code>, <code style={code}>[mod:shift]</code>, <code style={code}>[known:SpellName]</code>, <code style={code}>[noform:1]</code>, <code style={code}>[nochanneling]</code>, and the rest of the documented macro conditional set. These are not API calls. They are tokens the macro engine parses directly and they are permitted because they do not read arbitrary game state.</p>
        <p style={{ marginTop: 12 }}>GRIP-EMS's Variables system exists partly to work around this limitation. Variables are resolved outside the secure environment before the macro compiles, which means you can use them to make conditional decisions that would be impossible inside a step directly.</p>
      </Section>

      <Section title="How the step engine actually advances">
        <p>GRIP-EMS is a Sequential step engine by default, which means it fires step 1, then step 2, then step 3, advancing one step per keypress and looping back to step 1 after the last step. The important detail is in what happens when a step fails to cast.</p>

        <ComparisonTable
          headers={['', 'GRIP-EMS', 'GSE']}
          rows={[
            ['Failed cast', 'Holds on the current step. The sequence does not advance until the cast succeeds. Step 3 stays at step 3 until the spell actually fires.', 'Skips the failed step and advances to the next one. The sequence keeps moving regardless of whether the spell landed.'],
          ]}
        />

        <p style={{ marginTop: 16 }}>For tank rotations this difference is significant. Ironfur uptime, Thrash frequency, and cooldown timing all depend on spells landing in the right order. When the engine skips, high-value spells get pushed back by failed steps accumulating ahead of them. When the engine holds, your uptime numbers are consistent pull to pull.</p>
      </Section>

      <Section title="Hold behavior and proc-gated abilities">
        <p>Hold-on-failure is not just a defensive measure against lag. It is the mechanism that lets you write cleaner sequences for proc-dependent abilities without any conditional logic at all.</p>
        <p style={{ marginTop: 12 }}>The classic example is any ability that upgrades on proc. Warrior's Slam becomes Heroic Strike when the Sudden Death proc is active. In GSE, writing <code style={code}>/cast Heroic Strike</code> in a step means the sequence skips that step and fires Slam as the fallback when the proc is absent, because GSE advances past failed casts. In GRIP-EMS, the same line holds on that step when the proc is absent and does not fire Slam at all. The sequence waits there until Heroic Strike is actually available, then fires and advances. You get the proc version every time and never waste resources on the base version.</p>
        <p style={{ marginTop: 12 }}>The rule that follows from this: bare <code style={code}>/cast SpellName</code> with no conditionals is the correct pattern for proc-dependent abilities. Adding <code style={code}>[combat]</code> or other guards changes the behavior because WoW then resolves a fallback when the guard's condition fails, which bypasses the hold. If the spell should only fire when its proc is active, write it bare and let GRIP-EMS hold.</p>
        <Callout>
          This applies to any ability where the proc version and the base version are technically different spell IDs that WoW substitutes automatically. Heroic Strike and Slam, Execute procs, Sudden Death, class-specific upgrades. Write the proc version bare. Hold behavior does the rest.
        </Callout>
        <p style={{ marginTop: 12 }}>The one exception is <code style={code}>[nochanneling]</code>, which is the correct guard for finisher steps like Rip or Final Verdict. That conditional is needed to prevent the finisher from clipping a channel. Do not add <code style={code}>[combat]</code> on top of it, that causes silent failures.</p>
      </Section>

      <Section title="Step functions">
        <p>GRIP-EMS supports four step functions that control how the engine decides which step fires next. Sequential is the default and the one you will use for most rotations.</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
          {[
            {
              name: 'Sequential',
              tag: 'Default',
              desc: 'Fires step 1, then 2, then 3, loops to 1. One advance per keypress. This is the correct choice for rotations where order matters, including tank defensive cycling, opener sequences, and anything where a spell at step 5 is supposed to come after the spells at steps 1 through 4.',
            },
            {
              name: 'Priority',
              tag: null,
              desc: 'On every keypress, starts from step 1 and fires the first step that succeeds. Never advances past a step that can cast. Good for DPS rotations where you always want your highest priority spell to fire when it is available, regardless of where you are in the loop.',
            },
            {
              name: 'Reverse Priority',
              tag: null,
              desc: 'Starts from the last step and works backwards. In practice this means your lowest priority step fires almost every press because it is the last one checked and usually the easiest to satisfy. Avoid for finisher steps in any resource-based rotation.',
            },
            {
              name: 'Random',
              tag: null,
              desc: 'Fires a random step each press. Useful for very specific situations like randomizing a proc-based spell into different positions to avoid predictable timing. Not useful for structured rotations.',
            },
          ].map(sf => (
            <div key={sf.name} style={{ padding: '14px 16px', background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{sf.name}</span>
                {sf.tag && (
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', background: 'var(--accent-subtle)', padding: '2px 6px', borderRadius: 'var(--radius-sm)' }}>
                    {sf.tag}
                  </span>
                )}
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{sf.desc}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Reset conditions">
        <p>Reset conditions send the sequence back to step 1. GRIP-EMS supports five of them and they can be combined.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
          {[
            { label: 'Reset on combat', desc: 'Resets to step 1 when you leave combat. Most tank and DPS sequences should have this enabled so your opener fires at the start of each pull.' },
            { label: 'Reset on target', desc: 'Resets when your target changes. Useful for sequences with a target-specific opener that you want to replay on each new target.' },
            { label: 'Reset on spec', desc: 'Resets when you change spec. Usually unnecessary if your sequences are spec-specific.' },
            { label: 'Reset on gear', desc: 'Resets on gear swap. Relevant if you use gear sets that change your stat priorities mid-session.' },
            { label: 'Timer reset', desc: 'Resets after a set number of seconds without a keypress. Useful as a fallback to catch sequences that got stuck mid-rotation during an interruption.' },
          ].map(r => (
            <div key={r.label} style={{ display: 'flex', gap: 14, fontSize: 14, alignItems: 'flex-start' }}>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)', flexShrink: 0, minWidth: 140 }}>{r.label}</span>
              <span style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>{r.desc}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="The visual display layer versus what actually executes">
        <p>This is worth knowing because it causes real confusion in the Discord regularly. GRIP-EMS has two separate things: the visual preview of your sequence in the editor, and the compiled macro output that actually runs when you press your keybind. They are not the same thing.</p>
        <p style={{ marginTop: 12 }}>The visual layer renders steps it can match against known spells in its database. Steps it cannot match, including certain raw macro lines, some conditional constructs, and hero talent override spells under specific conditions, do not show in the preview. But they still exist in the compiled output and WoW's macro engine executes them correctly. A step that is invisible in the editor is not a broken step.</p>
        <p style={{ marginTop: 12 }}>This passthrough behavior is intentional and is how GRIP-EMS supports custom macro syntax that the addon's parser does not explicitly recognize. If you see fewer steps in the preview than you built and your sequence is otherwise working, this is almost certainly why.</p>
      </Section>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 48, paddingTop: 24, borderTop: '0.5px solid var(--border)' }}>
        <Link href="/guide/installation" style={{ fontSize: 14, color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>
          ← Back: Installation
        </Link>
        <Link href="/guide/building-sequences" style={{ fontSize: 14, color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>
          Next: Building sequences →
        </Link>
      </div>
    </div>
  )
}

const code: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 12,
  background: 'var(--bg-tertiary)',
  padding: '1px 5px',
  borderRadius: 3,
  color: 'var(--accent)',
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 48 }}>
      <h2 style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 16, color: 'var(--text-primary)' }}>
        {title}
      </h2>
      <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
        {children}
      </div>
    </div>
  )
}

function Callout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      marginTop: 12, padding: '12px 14px',
      background: 'rgba(29,158,117,0.07)',
      border: '0.5px solid rgba(29,158,117,0.25)',
      borderLeft: '3px solid var(--accent)',
      borderRadius: 'var(--radius-md)',
      fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6,
    }}>
      {children}
    </div>
  )
}

function ComparisonTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div style={{ overflowX: 'auto', marginTop: 16 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th key={i} style={{
                textAlign: 'left', padding: '8px 12px',
                background: 'var(--bg-tertiary)',
                borderBottom: '0.5px solid var(--border)',
                fontWeight: 600, color: 'var(--text-primary)',
                fontSize: 12,
              }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j} style={{
                  padding: '10px 12px',
                  borderBottom: '0.5px solid var(--border)',
                  color: j === 0 ? 'var(--text-primary)' : 'var(--text-secondary)',
                  fontWeight: j === 0 ? 600 : 400,
                  verticalAlign: 'top',
                  lineHeight: 1.6,
                }}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
