import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, BookOpen, Wrench, Layers, GitBranch, BarChart2 } from 'lucide-react'

export const metadata: Metadata = {
  title: 'The GRIP-EMS Guide | LazyGrip.net',
  description: 'A practical guide to installing, building, and validating GRIP-EMS sequences for World of Warcraft. Written by a Mythic+ player who validates everything in logs.',
}

const sections = [
  {
    href: '/guide/installation',
    icon: Wrench,
    time: '5 min',
    title: 'Installation',
    desc: 'Download, enable, and run the three mandatory post-install steps that most guides skip. The Cvar Health fix alone solves half of all new user problems. If your keybind is set but nothing fires, start here.',
  },
  {
    href: '/guide/how-it-works',
    icon: Layers,
    time: '8 min',
    title: 'How it works',
    desc: "What GRIP-EMS actually does under the hood, why WoW's secure execution environment matters for sequence design, and the mental model you need before you build anything. Getting this wrong is what produces sequences that feel fine on dummies and fall apart in real content.",
  },
  {
    href: '/guide/building-sequences',
    icon: BookOpen,
    time: '14 min',
    title: 'Building sequences',
    desc: 'The decision framework behind sequence design, applied to a real Guardian Druid Mythic+ sequence and a generic DPS build. Not what the buttons do but why the structure is what it is, what breaks if you change it, and how to apply the same thinking to your own spec.',
  },
  {
    href: '/guide/from-gse',
    icon: GitBranch,
    time: '6 min',
    title: 'Coming from GSE',
    desc: 'Written specifically for players who use GnomeSequencer Enhanced and are evaluating whether to switch. The one mechanical difference that actually matters, what transfers automatically, and the practical steps to get your existing sequences running.',
  },
  {
    href: '/guide/validating',
    icon: BarChart2,
    time: '7 min',
    title: 'Validating your work',
    desc: 'How to know your sequence is actually working for any spec. Warcraft Logs CSV exports as the proof standard, not gut feel and not dummy parsing. Includes how to use the built-in Repair module as a first-pass diagnostic before you ever open a log.',
  },
]

export default function GuidePage() {
  return (
    <div>
      <div style={{ marginBottom: 36 }}>
        <h1 style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1.2, marginBottom: 12, color: 'var(--text-primary)' }}>
          The GRIP-EMS Guide
        </h1>
        <p style={{ fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.75, maxWidth: 620, marginBottom: 12 }}>
          Written by a player who runs GRIP-EMS through Mythic+ and validates every sequence against Warcraft Logs before publishing it. This is not a feature tour and it is not a rehash of the official documentation. It is a practical guide to making the addon work correctly from the first install through your first validated sequence, written for players of every class and spec.
        </p>
        <p style={{ fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.75, maxWidth: 620 }}>
          If your keybind is set but nothing is firing, go straight to{' '}
          <Link href="/guide/installation" style={{ color: 'var(--accent)', textDecoration: 'none' }}>Installation</Link>. The Cvar Health fix takes thirty seconds and solves that problem the majority of the time. If you are coming from GSE and want to know whether switching is worth it, start with{' '}
          <Link href="/guide/from-gse" style={{ color: 'var(--accent)', textDecoration: 'none' }}>Coming from GSE</Link>.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 48 }}>
        {sections.map(s => {
          const Icon = s.icon
          return (
            <Link
              key={s.href}
              href={s.href}
              style={{ display: 'flex', gap: 16, padding: '18px 20px', background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-md)', textDecoration: 'none', alignItems: 'flex-start' }}
            >
              <div style={{ width: 34, height: 34, borderRadius: 'var(--radius-sm)', background: 'var(--accent-subtle)', border: '0.5px solid rgba(29,158,117,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon size={16} style={{ color: 'var(--accent)' }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{s.title}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)', background: 'var(--bg-tertiary)', border: '0.5px solid var(--border)', borderRadius: 99, padding: '1px 8px' }}>{s.time}</span>
                </div>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.65, margin: 0 }}>{s.desc}</p>
              </div>
              <ArrowRight size={14} style={{ color: 'var(--text-tertiary)', flexShrink: 0, marginTop: 10 }} />
            </Link>
          )
        })}
      </div>

      <section style={{ marginBottom: 48 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 14, color: 'var(--text-primary)' }}>
          Before you open the editor
        </h2>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.75, marginBottom: 12 }}>
          The single biggest mistake new users make is opening GRIP-EMS and typing spell names before they know what their sequence is supposed to do. The addon executes a rotation you have already designed, it does not design it for you. Sitting down with no plan produces a sequence that technically runs but delivers mediocre results because the step ordering and spacing came from guessing rather than understanding your spec.
        </p>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.75, marginBottom: 12 }}>
          Before you build anything, spend twenty minutes with the Icy Veins guide or your spec Discord and answer four questions. What is your highest priority spell and how often does it need to fire? What is the cooldown you cannot afford to miss on pull? Which spells can be skipped when unavailable without breaking the rotation, and which ones cannot be skipped? And do you need the sequence to behave differently in different content, such as a different opener for Mythic+ versus raid?
        </p>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.75 }}>
          The answers to those questions determine your step count, your step function choice, your reset conditions, and whether you need context versions. The{' '}
          <Link href="/guide/building-sequences" style={{ color: 'var(--accent)', textDecoration: 'none' }}>Building sequences</Link>{' '}
          section walks through exactly how those answers translate into a working sequence for any spec.
        </p>
      </section>

      <section style={{ marginBottom: 48 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 14, color: 'var(--text-primary)' }}>
          About the sequences on this site
        </h2>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.75, marginBottom: 12 }}>
          Every sequence published on LazyGrip includes the content type it was validated at, the key level or difficulty tier, and the talent string it was built for. If a sequence does not list validation data, treat it as a starting point to adapt rather than a finished product to import and run blind. A sequence validated at plus 10 on one hero talent path will produce different numbers on a different path because the spells and their interactions differ.
        </p>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.75 }}>
          The talent string ships with every sequence for exactly this reason. If your talents do not match, the sequence is still worth importing as a structural reference, but plan on a validation pass before you rely on it in serious content.
        </p>
      </section>

      <div style={{ padding: '14px 18px', background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Guide version: GRIP-EMS v2.1.10</span>
        <Link href="/guide/installation" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>
          Start with Installation <ArrowRight size={13} />
        </Link>
      </div>
    </div>
  )
}
