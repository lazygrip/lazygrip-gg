'use client'

import Link from 'next/link'
import { Download, Cpu, Layers, ArrowLeftRight, BarChart2, ArrowRight } from 'lucide-react'

const SECTIONS = [
  {
    href: '/guide/installation',
    icon: <Download size={18} />,
    label: 'Installation',
    desc: 'Download, enable, and run the three mandatory post-install steps that most guides skip. If your keybinds are not firing, start here.',
    color: '#1D9E75',
    time: '5 min',
  },
  {
    href: '/guide/how-it-works',
    icon: <Cpu size={18} />,
    label: 'How it works',
    desc: 'What GRIP-EMS actually does under the hood, why WoW\'s secure execution environment matters, and the mental model you need before you build anything.',
    color: '#5a8dee',
    time: '8 min',
  },
  {
    href: '/guide/building-sequences',
    icon: <Layers size={18} />,
    label: 'Building sequences',
    desc: 'A real Guardian Druid Mythic+ sequence dissected step by step. Not what the buttons do but why each decision was made and what breaks if you change it.',
    color: '#FF7C0A',
    time: '12 min',
  },
  {
    href: '/guide/from-gse',
    icon: <ArrowLeftRight size={18} />,
    label: 'Coming from GSE',
    desc: 'If you have used GnomeSequencer Enhanced and you are skeptical about switching, this section is written for you specifically.',
    color: '#a330c9',
    time: '6 min',
  },
  {
    href: '/guide/validating',
    icon: <BarChart2 size={18} />,
    label: 'Validating your work',
    desc: 'How to know your sequence is actually working. Warcraft Logs CSV exports as the proof standard, not gut feel and not dummy parsing.',
    color: '#e0522a',
    time: '7 min',
  },
]

export default function GuidePage() {
  return (
    <div>
      <div style={{ marginBottom: 36 }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          background: 'var(--accent-subtle)',
          color: 'var(--accent-text)',
          fontSize: 11,
          fontWeight: 500,
          padding: '3px 10px',
          borderRadius: 99,
          marginBottom: 16,
          border: '0.5px solid rgba(29,158,117,0.2)',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
        }}>
          GRIP-EMS v2.1.7
        </div>

        <h1 style={{ fontSize: 32, fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1.15, marginBottom: 14, color: 'var(--text-primary)' }}>
          The GRIP-EMS guide
        </h1>

        <p style={{ fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.75, maxWidth: 580, marginBottom: 12 }}>
          Written by a Guardian Druid player who has run GRIP-EMS through plus 13 and plus 14 keys and validates every sequence iteration against Warcraft Logs exports. This is not a feature tour. It is a practical guide to making the thing work correctly from the first install through your first validated sequence.
        </p>

        <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.7, maxWidth: 580 }}>
          If you came here because your keybinds are not firing, go straight to{' '}
          <Link href="/guide/installation" style={{ color: 'var(--accent)', textDecoration: 'none' }}>Installation</Link>.
          The Cvar Health checkbox is almost certainly the issue and it takes thirty seconds to fix.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12, marginBottom: 40 }}>
        {SECTIONS.map(section => (
          <Link
            key={section.href}
            href={section.href}
            style={{ display: 'block', background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '18px', textDecoration: 'none', transition: 'border-color 0.15s' }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = section.color + '60')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: section.color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', color: section.color, flexShrink: 0 }}>
                {section.icon}
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{section.time}</span>
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>{section.label}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{section.desc}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 14, fontSize: 12, color: section.color, fontWeight: 500 }}>
              Read <ArrowRight size={11} />
            </div>
          </Link>
        ))}
      </div>

      <div style={{ background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px 24px' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>About this guide</div>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, maxWidth: 600 }}>
          Every claim in this guide is backed by in-game testing and Warcraft Logs validation. When something is opinion or preference it is labeled as such. The sequence examples use real published sequences, not invented ones. This guide will be updated as GRIP-EMS develops and as new patterns emerge from real Mythic+ use.
        </p>
      </div>
    </div>
  )
}
