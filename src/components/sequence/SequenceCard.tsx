import Link from 'next/link'
import { Eye, MessageSquare, Star, Bookmark, Clock } from 'lucide-react'
import { Sequence } from '@/types'
import { getClassColor, CONTENT_TYPES } from '@/lib/wow-data'
import { formatDistanceToNow } from 'date-fns'

type Props = { sequence: Sequence }

const CONTENT_LABELS: Record<string, string> = {
  raid: 'Raid',
  mythic_plus: 'Mythic+',
  pvp: 'PvP',
  solo: 'Solo',
}

export default function SequenceCard({ sequence }: Props) {
  const classColor = getClassColor(sequence.class_id)
  const contentLabel = CONTENT_LABELS[sequence.content_type] ?? sequence.content_type
  const timeAgo = formatDistanceToNow(new Date(sequence.created_at), { addSuffix: true })

  return (
    <Link href={`/sequence/${sequence.slug}`} style={{ textDecoration: 'none' }}>
      <article style={{
        background: 'var(--bg-primary)',
        border: '0.5px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: '14px 16px',
        cursor: 'pointer',
        transition: 'border-color 0.15s, box-shadow 0.15s',
        display: 'block',
      }}
        onMouseEnter={e => {
          e.currentTarget.style.borderColor = 'var(--border-strong)'
          e.currentTarget.style.boxShadow = 'var(--shadow-sm)'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.borderColor = 'var(--border)'
          e.currentTarget.style.boxShadow = 'none'
        }}
      >
        {/* Top row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
          <div style={{ minWidth: 0 }}>
            <h3 style={{
              fontSize: 14,
              fontWeight: 500,
              color: 'var(--text-primary)',
              marginBottom: 5,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              {sequence.title}
            </h3>

            {/* Badges */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              <Badge color={classColor} label={sequence.class_name} />
              {sequence.spec_name && <Badge color="#5a8dee" label={sequence.spec_name} />}
              <Badge color="#1D9E75" label={contentLabel} />
              {sequence.grip_version && (
                <Badge color="#888" label={`GRIP ${sequence.grip_version}`} />
              )}
            </div>
          </div>

          {/* Rating */}
          {sequence.avg_score != null && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              flexShrink: 0,
              gap: 1,
            }}>
              <span style={{
                fontSize: 20,
                fontWeight: 600,
                color: sequence.avg_score >= 8 ? '#1D9E75' : sequence.avg_score >= 6 ? '#e0a020' : '#c44',
                lineHeight: 1,
              }}>
                {sequence.avg_score}
              </span>
              <span style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '.04em' }}>
                {sequence.rating_count} {sequence.rating_count === 1 ? 'rating' : 'ratings'}
              </span>
            </div>
          )}
        </div>

        {/* Description */}
        {sequence.description && (
          <p style={{
            fontSize: 12,
            color: 'var(--text-secondary)',
            lineHeight: 1.5,
            marginBottom: 10,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}>
            {sequence.description}
          </p>
        )}

        {/* Footer */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: 8,
        }}>
          <div style={{ display: 'flex', gap: 12 }}>
            <Stat icon={<Eye size={11} />} value={sequence.view_count} />
            <Stat icon={<Bookmark size={11} />} value={sequence.save_count} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--text-muted)' }}>
            {sequence.author && (
              <span>by <strong style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{sequence.author.username}</strong></span>
            )}
            <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <Clock size={10} />
              {timeAgo}
            </span>
          </div>
        </div>
      </article>
    </Link>
  )
}

function Badge({ color, label }: { color: string; label: string }) {
  const hex = color.replace('#', '')
  const r = parseInt(hex.slice(0,2), 16)
  const g = parseInt(hex.slice(2,4), 16)
  const b = parseInt(hex.slice(4,6), 16)

  return (
    <span style={{
      fontSize: 11,
      fontWeight: 500,
      padding: '2px 7px',
      borderRadius: 'var(--radius-sm)',
      background: `rgba(${r},${g},${b},0.12)`,
      color: color === '#888' ? 'var(--text-secondary)' : color,
      border: `0.5px solid rgba(${r},${g},${b},0.2)`,
    }}>
      {label}
    </span>
  )
}

function Stat({ icon, value }: { icon: React.ReactNode; value: number }) {
  return (
    <span style={{
      display: 'flex',
      alignItems: 'center',
      gap: 3,
      fontSize: 11,
      color: 'var(--text-muted)',
    }}>
      {icon}
      {value.toLocaleString()}
    </span>
  )
}
