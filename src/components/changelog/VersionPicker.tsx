'use client'
import { useState } from 'react'
import Link from 'next/link'
import { toneOf } from '@/lib/changelog/tone'

export type PickerRelease = {
  version: string
  slug: string
  date: string | null
  counts: Record<string, number>
}

// "I'm on version X": lists every release since, with how many entries each one carries,
// so a player who skipped a few updates can see what they missed in one place.
export default function VersionPicker({ releases }: { releases: PickerRelease[] }) {
  const [version, setVersion] = useState('')
  const idx = releases.findIndex(r => r.version === version)
  const missed = idx > 0 ? releases.slice(0, idx) : []

  return (
    <div>
      <label htmlFor="ems-version" style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
        What version are you on?
      </label>
      <select
        id="ems-version"
        value={version}
        onChange={e => setVersion(e.target.value)}
        className="cl-field"
        style={{ maxWidth: 320 }}
      >
        <option value="">Pick your version</option>
        {releases.map(r => <option key={r.version} value={r.version}>v{r.version}</option>)}
      </select>

      {version !== '' && idx === 0 && (
        <p style={{ marginTop: 12, fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>You are on the latest release.</p>
      )}
      {missed.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 8 }}>
            {missed.length} {missed.length === 1 ? 'release' : 'releases'} since v{version}, newest first:
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {missed.map(r => (
              <Link key={r.version} prefetch={false} href={`/guide/ems-changelog/${r.slug}`}
                style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'baseline', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', textDecoration: 'none' }}>
                <span style={{ color: 'var(--accent)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>v{r.version}</span>
                <span>{r.date}</span>
                <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {Object.entries(r.counts).map(([k, n]) => (
                    <span key={k} className={`cl-pill cl-t-${toneOf(k)}`}>{n} {k.toLowerCase()}</span>
                  ))}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
