'use client'

import Link from 'next/link'
import { Shield, ArrowRight, Zap, Users, Star, Wrench } from 'lucide-react'
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
            Community sequences for GRIP-EMS
          </div>

          <h1 style={{
            fontSize: 40,
            fontWeight: 600,
            letterSpacing: '-0.03em',
            lineHeight: 1.1,
            marginBottom: 16,
            color: 'var(--text-primary)',
          }}>
            Your rotation should work<br />
            <span style={{ color: 'var(--accent)' }}>every pull, every time</span>
          </h1>

          <p style={{
            fontSize: 16,
            color: 'var(--text-secondary)',
            lineHeight: 1.6,
            maxWidth: 520,
            margin: '0 auto 28px',
          }}>
            GRIP-EMS is a World of Warcraft rotation addon that holds its place when a cast fails
            instead of skipping ahead. For Mythic+ players running tight keys, that difference
            shows up in your logs. LazyGrip is the community library for sequences built around it.
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

      {/* Workshop banner */}
      <section style={{ borderBottom: '0.5px solid var(--border)', padding: '32px 24px', background: 'var(--bg-secondary)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr auto',
            gap: 24,
            alignItems: 'center',
            background: 'var(--bg-primary)',
            border: '0.5px solid var(--border)',
            borderLeft: '3px solid var(--accent)',
            borderRadius: 'var(--radius-lg)',
            padding: '24px 28px',
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ color: 'var(--accent)' }}><Wrench size={16} /></span>
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: 'var(--accent)' }}>New in Workshop</span>
              </div>
              <h2 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.02em', marginBottom: 8 }}>
                Build GRIP sequences in the browser
              </h2>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, maxWidth: 600, marginBottom: 16 }}>
                The Workshop now includes a full sequence builder. Create collections with multiple sequences and versions, add loops, if branches, and pause blocks, set keypress macros, and export a ready-to-import GRIP string without ever opening the addon. Import any existing GRIP or GSE export to inspect and edit it directly.
              </p>
              <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' as const }}>
                {[
                  'Spell autocomplete by class',
                  'Drag and drop reordering',
                  'Character limit warnings',
                  'Spell ID conversion',
                  'Clone sequences and versions',
                ].map(feature => (
                  <span key={feature} style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ color: 'var(--accent)', fontSize: 10 }}>&#10003;</span> {feature}
                  </span>
                ))}
              </div>
            </div>
            <Link href="/workshop" style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: 'var(--accent)',
              color: 'white',
              textDecoration: 'none',
              padding: '10px 20px',
              borderRadius: 'var(--radius-md)',
              fontSize: 13,
              fontWeight: 500,
              flexShrink: 0,
              whiteSpace: 'nowrap' as const,
            }}>
              Open Workshop <ArrowRight size={13} />
            </Link>
          </div>
        </div>
      </section>

      {/* Why GRIP-EMS */}
      <section style={{
        borderBottom: '0.5px solid var(--border)',
        padding: '48px 24px',
      }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <h2 style={{
            fontSize: 22,
            fontWeight: 600,
            letterSpacing: '-0.02em',
            marginBottom: 16,
            color: 'var(--text-primary)',
          }}>
            Why GRIP-EMS?
          </h2>
          <p style={{
            fontSize: 15,
            color: 'var(--text-secondary)',
            lineHeight: 1.75,
            marginBottom: 32,
            maxWidth: 620,
          }}>
            Because consistent execution shows up in your logs. When a rotation holds its place
            on a failed cast instead of advancing, your cooldowns land when your sequence says
            they should. Your high-priority spells don't get buried behind abilities that fired
            out of order. Your uptime numbers stop fluctuating run to run for reasons you can't
            explain. That's not a promise. It's what the logs show when you build sequences the
            right way around an engine that doesn't skip.
          </p>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: 12,
          }}>
            {[
              {
                label: 'Holds on failed casts',
                desc: 'The sequence stays where it is until the cast lands, not where the engine decided to move.',
                color: '#1D9E75',
              },
              {
                label: 'Cooldowns on schedule',
                desc: 'High-priority abilities fire when the sequence reaches them, not whenever the engine cycles back around.',
                color: '#5a8dee',
              },
              {
                label: 'Consistent across keys',
                desc: 'The same sequence produces the same uptime numbers pull to pull because the execution model doesn\'t drift.',
                color: '#a330c9',
              },
            ].map(card => (
              <div key={card.label} style={{
                background: 'var(--bg-primary)',
                border: '0.5px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
                padding: '16px',
              }}>
                <div style={{
                  width: 32,
                  height: 4,
                  background: card.color,
                  borderRadius: 2,
                  marginBottom: 10,
                }} />
                <div style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  marginBottom: 6,
                }}>
                  {card.label}
                </div>
                <div style={{
                  fontSize: 12,
                  color: 'var(--text-secondary)',
                  lineHeight: 1.6,
                }}>
                  {card.desc}
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 24 }}>
            <Link href="/faq" style={{
              fontSize: 13,
              color: 'var(--accent)',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}>
              Learn more about GRIP-EMS <ArrowRight size={13} />
            </Link>
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
              href={`/browse/${cls.slug}`}
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
            { slug: 'mythic-plus', label: 'Mythic+', desc: 'Dungeon tank, heal, and DPS rotations', color: '#5a8dee' },
            { slug: 'raid', label: 'Raid', desc: 'Boss-ready sequences with cooldown timing', color: '#e0522a' },
            { slug: 'pvp', label: 'PvP', desc: 'Arena and battleground rotations', color: '#a330c9' },
            { slug: 'solo', label: 'Solo / Leveling', desc: 'Open world and solo content', color: '#1D9E75' },
          ].map(ct => (
            <Link key={ct.slug} href={`/browse/${ct.slug}`} style={{
              background: 'var(--bg-primary)',
              border: '0.5px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: '16px',
              textDecoration: 'none',
              display: 'block',
              transition: 'border-color 0.15s',
            }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = ct.color + '60')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
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
