import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, BookOpen, Wrench, Layers, GitBranch, BarChart2, SlidersHorizontal } from 'lucide-react'
import GuideSection from '@/components/guide/GuideSection'
import Card from '@/components/ui/Card'

export const metadata: Metadata = {
  title: 'The GRIP-EMS Guide',
  description: 'A practical guide to installing, building, and validating GRIP-EMS sequences for World of Warcraft. Written by a Mythic+ player who validates everything in logs.',
  alternates: {
    canonical: 'https://lazygrip.net/guide',
  },
  openGraph: {
    title: 'The GRIP-EMS Guide',
    description: 'A practical guide to installing, building, and validating GRIP-EMS sequences for World of Warcraft. Written by a Mythic+ player who validates everything in logs.',
    url: 'https://lazygrip.net/guide',
    siteName: 'LazyGrip.net',
    type: 'website',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'LazyGrip.net — GRIP-EMS sequences for World of Warcraft' }],
  },
}

const sections = [
  {
    href: '/guide/installation',
    icon: Wrench,
    time: '5 min',
    title: 'Installation',
    desc: 'Download, enable, and check the two settings that most guides skip. As of v2.3.14, Key Down Casting is handled automatically. If your keybind is set but nothing fires, start here.',
  },
  {
    href: '/guide/settings',
    icon: SlidersHorizontal,
    time: '6 min',
    title: 'Settings',
    desc: 'The in-game settings that determine whether your sequences run smoothly or feel broken. Key Down Casting, Spell Queue Window, the Dynamic SQW Optimiser, click rate, and how to configure outside programs like AHK, iCue, and Synapse.',
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
    href: '/guide/from-legacy-program',
    icon: GitBranch,
    time: '6 min',
    title: 'Coming from the legacy program',
    desc: 'Written specifically for players who use an older macro sequencing addon and are evaluating whether to switch. The one mechanical difference that actually matters, what transfers automatically, and the practical steps to get your existing sequences running.',
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
        {/* Anchor — same layered-glow badge treatment as the homepage mark, scaled down to
            page-header size, so this reads as part of the same design language instead of
            a plain text title. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
          <div style={{ position: 'relative', width: 44, height: 44, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div aria-hidden style={{ position: 'absolute', width: 84, height: 84, borderRadius: '50%', background: 'radial-gradient(circle, var(--accent-subtle) 0%, transparent 70%)' }} />
            <div style={{ position: 'relative', width: 44, height: 44, borderRadius: 12, background: 'var(--accent-subtle)', border: '0.5px solid rgba(29,158,117,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <BookOpen size={20} style={{ color: 'var(--accent)' }} />
            </div>
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.2, color: 'var(--text-primary)' }}>
            The GRIP-EMS Guide
          </h1>
        </div>
        <p style={{ fontSize: 'var(--text-lg)', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.5, maxWidth: 620, marginBottom: 14 }}>
          Most guides skip the two settings that actually break your rotation. This one doesn&apos;t.
        </p>
        <p style={{ fontSize: 'var(--text-base)', color: 'var(--text-secondary)', lineHeight: 1.75, maxWidth: 620, marginBottom: 12 }}>
          Written by a player who runs GRIP-EMS through Mythic+ and validates every sequence against Warcraft Logs before publishing it. This is not a feature tour and it is not a rehash of the official documentation. It is a practical guide to making the addon work correctly from the first install through your first validated sequence, written for players of every class and spec.
        </p>
        <p style={{ fontSize: 'var(--text-base)', color: 'var(--text-secondary)', lineHeight: 1.75, maxWidth: 620 }}>
          If your keybind is set but nothing is firing, go straight to{' '}
          <Link href="/guide/installation" style={{ color: 'var(--accent)', textDecoration: 'none' }}>Installation</Link>. On GRIP-EMS v2.4.7 and later this is rarely the cause since Key Down Casting is now forced on automatically, but on older versions the Cvar Health fix takes thirty seconds and solves that problem the majority of the time. If you are coming from an older macro sequencing addon and want to know whether switching is worth it, start with{' '}
          <Link href="/guide/from-legacy-program" style={{ color: 'var(--accent)', textDecoration: 'none' }}>Coming from the legacy program</Link>.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 48 }}>
        {sections.map(s => {
          const Icon = s.icon
          return (
            <Card key={s.href} href={s.href} padding="sm">
              <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                <div style={{ width: 34, height: 34, borderRadius: 'var(--radius-sm)', background: 'var(--accent-subtle)', border: '0.5px solid rgba(29,158,117,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={16} style={{ color: 'var(--accent)' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <span style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--text-primary)' }}>{s.title}</span>
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', background: 'var(--bg-tertiary)', border: '0.5px solid var(--border)', borderRadius: 99, padding: '1px 8px' }}>{s.time}</span>
                  </div>
                  <p style={{ fontSize: 'var(--text-base)', color: 'var(--text-secondary)', lineHeight: 1.65, margin: 0 }}>{s.desc}</p>
                </div>
                <ArrowRight size={14} style={{ color: 'var(--text-muted)', flexShrink: 0, marginTop: 10 }} />
              </div>
            </Card>
          )
        })}
      </div>

      <GuideSection title="Before you open the editor">
        <p style={{ marginBottom: 12 }}>
          The single biggest mistake new users make is opening GRIP-EMS and typing spell names before they know what their sequence is supposed to do. The addon executes a rotation you have already designed, it does not design it for you. Sitting down with no plan produces a sequence that technically runs but delivers mediocre results because the step ordering and spacing came from guessing rather than understanding your spec.
        </p>
        <p style={{ marginBottom: 12 }}>
          Before you build anything, spend twenty minutes with the Icy Veins guide or your spec Discord and answer four questions. What is your highest priority spell and how often does it need to fire? What is the cooldown you cannot afford to miss on pull? Which spells can be skipped when unavailable without breaking the rotation, and which ones cannot be skipped? And do you need the sequence to behave differently in different content, such as a different opener for Mythic+ versus raid?
        </p>
        <p>
          The answers to those questions determine your step count, your step function choice, your reset conditions, and whether you need context versions. The{' '}
          <Link href="/guide/building-sequences" style={{ color: 'var(--accent)', textDecoration: 'none' }}>Building sequences</Link>{' '}
          section walks through exactly how those answers translate into a working sequence for any spec.
        </p>
      </GuideSection>

      <GuideSection title="About the sequences on this site">
        <p style={{ marginBottom: 12 }}>
          Every sequence published on LazyGrip includes the content type it was validated at, the key level or difficulty tier, and the talent string it was built for. If a sequence does not list validation data, treat it as a starting point to adapt rather than a finished product to import and run blind. A sequence validated at plus 10 on one hero talent path will produce different numbers on a different path because the spells and their interactions differ.
        </p>
        <p>
          The talent string ships with every sequence for exactly this reason. If your talents do not match, the sequence is still worth importing as a structural reference, but plan on a validation pass before you rely on it in serious content.
        </p>
      </GuideSection>

      {/* CTA — same pill-with-icon-badge chrome as the homepage action row, so the "go do
          the thing" moment looks like it belongs to the same site instead of a generic
          outline button. */}
      <div style={{ padding: '14px 18px', background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>The GRIP-EMS Guide</span>
        <Link
          href="/guide/installation"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 10,
            background: 'var(--bg-tertiary)', border: '0.5px solid var(--border-strong)',
            borderRadius: 99, padding: '6px 14px 6px 6px',
            fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)',
            textDecoration: 'none',
          }}
        >
          <span style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--accent-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', flexShrink: 0 }}>
            <ArrowRight size={12} />
          </span>
          Start with Installation
        </Link>
      </div>
    </div>
  )
}
