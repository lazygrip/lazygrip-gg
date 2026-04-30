import Link from 'next/link'
import { Shield, ArrowRight, Zap, Users, Star } from 'lucide-react'
import { WOW_CLASSES } from '@/lib/wow-data'

export default function HomePage() {
  return (
    <div>
      {/* Hero */}
      <section style={{
        background: 'var(--bg-primary)',
        borderBottom: '0.5px solid var(--border)',
        padding: '52px 24px',
      }}>
        <div style={{ maxWidth: 720, margin: '0 auto', textAlign: 'center' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: 'var(--accent-subtle)',
            color: 'var(--accent-text)',
            fontSize: 12,
            fontWeight: 500,
            padding: '4px 12px',
            borderRadius: 99,
            marginBottom: 20,
            border: '0.5px solid rgba(29,158,117,0.2)',
          }}>
            <Shield size={12} />
            The home for GRIP-EMS sequences
          </div>

          <h1 style={{
            fontSize: 40,
            fontWeight: 600,
            letterSpacing: '-0.03em',
            lineHeight: 1.1,
            marginBottom: 16,
            color: 'var(--text-primary)',
          }}>
            Browse and share<br />
            <span style={{ color: 'var(--accent)' }}>GRIP-EMS sequences</span><br />
            for every class
          </h1>

          <p style={{
            fontSize: 16,
            color: 'var(--text-secondary)',
            lineHeight: 1.6,
            marginBottom: 28,
            maxWidth: 480,
            margin: '0 auto 28px',
          }}>
            Community-built rotation sequences for World of Warcraft.
            No accounts needed to browse. Free to post and share.
          </p>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/browse" style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: 'var(--accent)',
              color: 'white',
              textDecoration: 'none',
              padding: '10px 20px',
              borderRadius: 'var(--radius-md)',
              fontSize: 14,
              fontWeight: 500,
            }}>
              Browse sequences
              <ArrowRight size={15} />
            </Link>
            <Link href="/auth/signup" style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              textDecoration: 'none',
              padding: '10px 20px',
              borderRadius: 'var(--radius-md)',
              fontSize: 14,
              fontWeight: 500,
              border: '0.5px solid var(--border-strong)',
            }}>
              Post your sequence
            </Link>
          </div>

          {/* Stats */}
          <div style={{
            display: 'flex',
            gap: 32,
            justifyContent: 'center',
            marginTop: 40,
            paddingTop: 32,
            borderTop: '0.5px solid var(--border)',
          }}>
            {[
              { icon: <Zap size={14} />, label: 'GRIP-EMS native' },
              { icon: <Users size={14} />, label: 'Community rated' },
              { icon: <Star size={14} />, label: 'All 13 classes' },
            ].map(item => (
              <div key={item.label} style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 13,
                color: 'var(--text-secondary)',
              }}>
                <span style={{ color: 'var(--accent)' }}>{item.icon}</span>
                {item.label}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Browse by class */}
      <section style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 24px' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 20,
        }}>
          <h2 style={{ fontSize: 18, fontWeight: 500, letterSpacing: '-0.01em' }}>Browse by class</h2>
          <Link href="/browse" style={{
            fontSize: 13,
            color: 'var(--accent)',
            textDecoration: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}>
            View all <ArrowRight size={13} />
          </Link>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
          gap: 10,
        }}>
          {WOW_CLASSES.map(cls => (
            <Link
              key={cls.id}
              href={`/browse?class_id=${cls.id}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                background: 'var(--bg-primary)',
                border: '0.5px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
                padding: '10px 14px',
                textDecoration: 'none',
                transition: 'border-color 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = cls.color + '80'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
            >
              <div style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: cls.color,
                flexShrink: 0,
              }} />
              <span style={{
                fontSize: 13,
                fontWeight: 500,
                color: 'var(--text-primary)',
              }}>
                {cls.name}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Content type quick filters */}
      <section style={{
        maxWidth: 1200,
        margin: '0 auto',
        padding: '0 24px 48px',
      }}>
        <h2 style={{ fontSize: 18, fontWeight: 500, letterSpacing: '-0.01em', marginBottom: 20 }}>
          Browse by content
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
          {[
            { type: 'mythic_plus', label: 'Mythic+', desc: 'Dungeon tank, heal, and DPS rotations', color: '#5a8dee' },
            { type: 'raid', label: 'Raid', desc: 'Boss-ready sequences with cooldown timing', color: '#e0522a' },
            { type: 'pvp', label: 'PvP', desc: 'Arena and battleground rotations', color: '#a330c9' },
            { type: 'solo', label: 'Solo / Leveling', desc: 'Open world and solo content', color: '#1D9E75' },
          ].map(ct => (
            <Link key={ct.type} href={`/browse?content_type=${ct.type}`} style={{
              background: 'var(--bg-primary)',
              border: '0.5px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: '16px',
              textDecoration: 'none',
              display: 'block',
              transition: 'border-color 0.15s',
            }}
              onMouseEnter={e => e.currentTarget.style.borderColor = ct.color + '60'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
            >
              <div style={{
                width: 32,
                height: 4,
                background: ct.color,
                borderRadius: 2,
                marginBottom: 10,
              }} />
              <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 4 }}>
                {ct.label}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                {ct.desc}
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
