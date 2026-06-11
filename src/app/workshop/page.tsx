'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Search, ArrowRightLeft, Wrench } from 'lucide-react'

export default function WorkshopPage() {
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) router.push('/auth/login?next=/workshop')
      else setLoading(false)
    })
  }, [router])

  if (loading) return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading...</span>
    </div>
  )

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '48px 24px' }}>
      <div style={{ marginBottom: 40 }}>
        <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 8 }}>
          Workshop
        </p>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10, letterSpacing: '-0.02em' }}>
          Macro Export Tools
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, maxWidth: 540 }}>
          Inspect GRIP or GSE exports, convert GSE3 macros to native GRIP-EMS format, or build sequences from scratch in the browser.
        </p>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 10 }}>
          Tools built by{' '}
          <a href="https://ko-fi.com/beard3d_gamer" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
            Beard3d_Gamer
          </a>
          {' '}· Integrated on LazyGrip by Slowdog
        </p>
      </div>

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
          accent
        />
      </div>
    </div>
  )
}

function ToolCard({
  href, eyebrow, title, description, icon, cta, accent = false,
}: {
  href: string
  eyebrow: string
  title: string
  description: string
  icon: React.ReactNode
  cta: string
  accent?: boolean
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
        background: accent ? 'var(--accent)' : 'var(--bg-tertiary)',
        color: accent ? 'white' : 'var(--accent)',
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
