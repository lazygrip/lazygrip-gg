'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Search, ArrowRightLeft, Wrench, ExternalLink } from 'lucide-react'

export default function WorkshopPage() {
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(false)
  }, [])

  if (loading) return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading...</span>
    </div>
  )

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '48px 24px' }}>

      {/* Page header */}
      <div style={{ marginBottom: 48 }}>
        <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 8 }}>
          Workshop
        </p>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10, letterSpacing: '-0.02em' }}>
          Tools by Beard3d_Gamer
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, maxWidth: 540 }}>
          Browser-based export tools and in-game addons built for the GRIP-EMS community, integrated on LazyGrip by Slowdog.
        </p>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 10 }}>
          Built by{' '}
          <a href="https://ko-fi.com/beard3d_gamer" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
            Beard3d_Gamer
          </a>
        </p>
      </div>

      {/* Browser tools section */}
      <div style={{ marginBottom: 48 }}>
        <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 16 }}>
          Macro Export Tools
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
          <ToolCard
            href="/workshop/decode"
            eyebrow="Inspect"
            title="Decode Export"
            description="View loops, actions, steps, and talent builds from !EMS1!, !GRIP1!, or !GSE3! strings."
            icon={<Search size={20} />}
            cta="Open decoder"
          />
          <ToolCard
            href="/workshop/convert"
            eyebrow="Transform"
            title="Convert to GRIP"
            description="Paste a GSE3 export and get a native !GRIP1! string with proper loop architecture and keypress handling."
            icon={<ArrowRightLeft size={20} />}
            cta="Open converter"
          />
          <ToolCard
            href="/workshop/build"
            eyebrow="Create"
            title="Build Sequence"
            description="Build collections with multiple sequences, versions, loops, If branches, and reset conditions. Import any export to edit."
            icon={<Wrench size={20} />}
            cta="Open builder"
          />
        </div>
      </div>

      {/* In-game addons section */}
      <div>
        <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 16 }}>
          In-Game Addons
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
          <AddonCard
            href="https://www.curseforge.com/wow/addons/grip-ems-modern-ui"
            eyebrow="UI Reskin"
            title="GRIP-EMS Modern UI"
            description="A 3-column UI reskin for GRIP-EMS with sidebar navigation, a config sidebar, and an Ability Preview footer. Fully optional, GRIP-EMS works without it."
            requires="Requires GRIP-EMS v2.2.0 or newer"
            icon={<ExternalLink size={20} />}
            cta="View on CurseForge"
          />
        </div>
      </div>

    </div>
  )
}

function ToolCard({
  href, eyebrow, title, description, icon, cta,
}: {
  href: string
  eyebrow: string
  title: string
  description: string
  icon: React.ReactNode
  cta: string
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <Link
      href={href}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', flexDirection: 'column', padding: '24px',
        background: hovered ? 'var(--bg-tertiary)' : 'var(--bg-secondary)',
        border: `0.5px solid ${hovered ? 'var(--border-strong)' : 'var(--border)'}`,
        borderRadius: 'var(--radius-lg)', textDecoration: 'none',
        transition: 'background 0.15s, border-color 0.15s', gap: 12,
      }}
    >
      <div style={{
        width: 40, height: 40, borderRadius: 'var(--radius-md)',
        background: 'var(--bg-tertiary)', color: 'var(--accent)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        {icon}
      </div>
      <div>
        <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 4 }}>
          {eyebrow}
        </p>
        <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6, letterSpacing: '-0.01em' }}>
          {title}
        </h2>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          {description}
        </p>
      </div>
      <div style={{ marginTop: 'auto', paddingTop: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--accent)' }}>{cta} →</span>
      </div>
    </Link>
  )
}

function AddonCard({
  href, eyebrow, title, description, requires, icon, cta,
}: {
  href: string
  eyebrow: string
  title: string
  description: string
  requires: string
  icon: React.ReactNode
  cta: string
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', flexDirection: 'column', padding: '24px',
        background: hovered ? 'var(--bg-tertiary)' : 'var(--bg-secondary)',
        border: `0.5px solid ${hovered ? 'var(--border-strong)' : 'var(--border)'}`,
        borderRadius: 'var(--radius-lg)', textDecoration: 'none',
        transition: 'background 0.15s, border-color 0.15s', gap: 12,
        maxWidth: 340,
      }}
    >
      <div style={{
        width: 40, height: 40, borderRadius: 'var(--radius-md)',
        background: 'var(--bg-tertiary)', color: 'var(--accent)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        {icon}
      </div>
      <div>
        <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 4 }}>
          {eyebrow}
        </p>
        <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6, letterSpacing: '-0.01em' }}>
          {title}
        </h2>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          {description}
        </p>
      </div>
      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
        {requires}
      </p>
      <div style={{ marginTop: 'auto', paddingTop: 4 }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--accent)' }}>{cta} →</span>
      </div>
    </a>
  )
}
