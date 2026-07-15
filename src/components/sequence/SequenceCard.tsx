'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Eye, MessageSquare, Bookmark, Star, AlertTriangle } from 'lucide-react'
import { Sequence } from '@/types'
import { getClassColor, CONTENT_TYPES } from '@/lib/wow-data'
import { formatDistanceToNow, differenceInDays } from 'date-fns'

type Props = {
  sequence: Sequence
  currentPatch?: string | null // site-wide current patch, passed down from BrowseContent
}

const CONTENT_LABELS: Record<string, string> = {
  raid: 'Raid',
  mythic_plus: 'Mythic+',
  pvp: 'PvP',
  solo: 'Solo',
}

const STALE_DAYS_THRESHOLD = 60

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').trim()
}

export default function SequenceCard({ sequence, currentPatch }: Props) {
  const router = useRouter()
  const classColor = getClassColor(sequence.class_id)
  const contentLabel = CONTENT_LABELS[sequence.content_type] ?? sequence.content_type
  const timeAgo = formatDistanceToNow(new Date(sequence.created_at), { addSuffix: true })
  const plainDescription = sequence.description ? stripHtml(sequence.description) : null

  const avgScore = sequence.avg_score != null ? sequence.avg_score : null
  const ratingCount = sequence.rating_count != null ? sequence.rating_count : 0
  const hasRating = avgScore !== null && ratingCount > 0
  const scoreColor = avgScore !== null && avgScore >= 8
    ? '#1D9E75'
    : avgScore !== null && avgScore >= 6
      ? '#e0a020'
      : '#c44'

  // Staleness: patch mismatch (or no patch_version recorded) AND not updated in the last 60 days.
  // Both conditions required — purely informational, does not affect sort/ranking.
  const daysSinceUpdate = differenceInDays(new Date(), new Date(sequence.updated_at))
  const patchMismatch = !!currentPatch && (sequence.patch_version == null || sequence.patch_version !== currentPatch)
  const isStale = patchMismatch && daysSinceUpdate > STALE_DAYS_THRESHOLD

  const staleTooltip = isStale
    ? `Built for ${sequence.patch_version ?? 'an unrecorded patch'} — current patch is ${currentPatch}. Last updated ${daysSinceUpdate} days ago.`
    : undefined

  return (
    <article
      onClick={() => router.push(`/sequences/${sequence.slug}`)}
      title={staleTooltip}
      style={{
        background: isStale ? 'rgba(224,160,32,0.08)' : 'var(--bg-primary)',
        border: '0.5px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        borderLeft: `3px solid ${classColor}`,
        padding: '14px 16px',
        cursor: 'pointer',
        transition: 'border-color 0.15s, box-shadow 0.15s',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderTopColor = 'var(--border-strong)'
        e.currentTarget.style.borderRightColor = 'var(--border-strong)'
        e.currentTarget.style.borderBottomColor = 'var(--border-strong)'
        e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderTopColor = 'var(--border)'
        e.currentTarget.style.borderRightColor = 'var(--border)'
        e.currentTarget.style.borderBottomColor = 'var(--border)'
        e.currentTarget.style.boxShadow = 'none'
      }}
    >
      {/* Top row: title + rating */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <h3 style={{
          fontSize: 15,
          fontWeight: 600,
          color: 'var(--text-primary)',
          lineHeight: 1.3,
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          margin: 0,
        }}>
          {sequence.title}
        </h3>

        {hasRating && avgScore !== null && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 3,
            flexShrink: 0,
            background: `${scoreColor}18`,
            border: `0.5px solid ${scoreColor}40`,
            borderRadius: 'var(--radius-sm)',
            padding: '2px 7px',
          }}>
            <Star size={10} style={{ color: scoreColor, fill: scoreColor }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: scoreColor, lineHeight: 1 }}>
              {avgScore}
            </span>
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
              ({ratingCount})
            </span>
          </div>
        )}
      </div>

      {/* Badges */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
        <Badge color={classColor} label={sequence.class_name} />
        {sequence.spec_name && <Badge color="#5a8dee" label={sequence.spec_name} />}
        <Badge color="#1D9E75" label={contentLabel} />
        {sequence.grip_version && <Badge color="#888" label={`GRIP ${sequence.grip_version}`} />}
        {sequence.current_version_label && <Badge color="#1D9E75" label={sequence.current_version_label} />}
        {isStale && (
          <span
            title={staleTooltip}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 3,
              fontSize: 11,
              fontWeight: 500,
              padding: '2px 7px',
              borderRadius: 'var(--radius-sm)',
              background: 'rgba(224,160,32,0.16)',
              color: '#a06c00',
              border: '0.5px solid rgba(224,160,32,0.4)',
            }}
          >
            <AlertTriangle size={10} />
            Needs revalidation
          </span>
        )}
      </div>

      {/* Description */}
      {plainDescription && (
        <p style={{
          fontSize: 12,
          color: 'var(--text-secondary)',
          lineHeight: 1.5,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          margin: 0,
        }}>
          {plainDescription}
        </p>
      )}

      {/* Footer */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 2,
      }}>
        <div style={{ display: 'flex', gap: 10 }}>
          <Stat icon={<Eye size={12} />} value={sequence.view_count} highlight={sequence.view_count >= 100} />
          <Stat icon={<MessageSquare size={12} />} value={sequence.comment_count ?? 0} />
          <Stat icon={<Bookmark size={12} />} value={sequence.save_count} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--text-muted)' }}>
          {sequence.author && (
            <span>by{' '}
              <Link
                href={`/user/${sequence.author.username}`}
                onClick={e => e.stopPropagation()}
                style={{ color: 'var(--text-secondary)', fontWeight: 500, textDecoration: 'none' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
              >
                {sequence.author.username}
              </Link>
            </span>
          )}
          <span>{timeAgo}</span>
        </div>
      </div>
    </article>
  )
}

function Badge({ color, label }: { color: string; label: string }) {
  const hex = color.replace('#', '')
  const r = parseInt(hex.slice(0, 2), 16)
  const g = parseInt(hex.slice(2, 4), 16)
  const b = parseInt(hex.slice(4, 6), 16)

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

function Stat({ icon, value, highlight }: { icon: React.ReactNode; value: number; highlight?: boolean }) {
  return (
    <span style={{
      display: 'flex',
      alignItems: 'center',
      gap: 3,
      fontSize: 12,
      color: highlight ? 'var(--text-secondary)' : 'var(--text-muted)',
      fontWeight: highlight ? 500 : 400,
    }}>
      {icon}
      {value.toLocaleString()}
    </span>
  )
}
