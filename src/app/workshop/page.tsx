'use client'
import { useEffect, useState } from 'react'
import { Search, Wrench, ExternalLink } from 'lucide-react'
import Card from '@/components/ui/Card'

export default function WorkshopPage() {
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(false)
  }, [])

  if (loading) return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>Loading...</span>
    </div>
  )

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '48px 24px' }}>

      {/* Page header — same layered-glow badge anchor as the guide and homepage headers,
          and a sharper headline than the old generic "Workshop Tools" label. */}
      <div style={{ marginBottom: 48 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
          <div style={{ position: 'relative', width: 44, height: 44, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div aria-hidden style={{ position: 'absolute', width: 84, height: 84, borderRadius: '50%', background: 'radial-gradient(circle, var(--accent-subtle) 0%, transparent 70%)' }} />
            <div style={{ position: 'relative', width: 44, height: 44, borderRadius: 12, background: 'var(--accent-subtle)', border: '0.5px solid rgba(29,158,117,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Wrench size={19} style={{ color: 'var(--accent)' }} />
            </div>
          </div>
          <div>
            <p style={{ fontSize: 'var(--text-xs)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 4 }}>
              Workshop
            </p>
            <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
              Everything, in the browser.
            </h1>
          </div>
        </div>
        <p style={{ fontSize: 'var(--text-base)', color: 'var(--text-secondary)', lineHeight: 1.6, maxWidth: 540 }}>
          Build, decode, and export sequences without ever opening the addon. Browser-based tools and in-game addons built for the GRIP-EMS community, integrated on LazyGrip by Slowdog.
        </p>
      </div>

      {/* Browser tools section */}
      <div style={{ marginBottom: 48 }}>
        <p style={{ fontSize: 'var(--text-xs)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 16 }}>
          Macro Export Tools
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
          <ToolCard
            href="/workshop/decode"
            eyebrow="Inspect"
            title="Decode Export"
            description="View loops, actions, steps, and talent builds from !EMS1!, !GRIP1!, or legacy program export strings."
            icon={<Search size={20} />}
            cta="Open decoder"
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
        <p style={{ fontSize: 'var(--text-xs)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 16 }}>
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
  return (
    <Card href={href} hoverColor="var(--border-strong)" padding="lg">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%' }}>
        <div style={{
          width: 40, height: 40, borderRadius: 'var(--radius-md)',
          background: 'var(--bg-tertiary)', color: 'var(--accent)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          {icon}
        </div>
        <div>
          <p style={{ fontSize: 'var(--text-xs)', fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 4 }}>
            {eyebrow}
          </p>
          <h2 style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6, letterSpacing: '-0.01em' }}>
            {title}
          </h2>
          <p style={{ fontSize: 'var(--text-base)', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            {description}
          </p>
        </div>
        <div style={{ marginTop: 'auto', paddingTop: 8 }}>
          <span style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--accent)' }}>{cta} →</span>
        </div>
      </div>
    </Card>
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
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{ textDecoration: 'none', maxWidth: 340, display: 'block' }}
    >
      <Card hoverColor="var(--border-strong)" padding="lg">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 'var(--radius-md)',
            background: 'var(--bg-tertiary)', color: 'var(--accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            {icon}
          </div>
          <div>
            <p style={{ fontSize: 'var(--text-xs)', fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 4 }}>
              {eyebrow}
            </p>
            <h2 style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6, letterSpacing: '-0.01em' }}>
              {title}
            </h2>
            <p style={{ fontSize: 'var(--text-base)', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              {description}
            </p>
          </div>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 4 }}>
            {requires}
          </p>
          <div style={{ marginTop: 'auto', paddingTop: 4 }}>
            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--accent)' }}>{cta} →</span>
          </div>
        </div>
      </Card>
    </a>
  )
}
