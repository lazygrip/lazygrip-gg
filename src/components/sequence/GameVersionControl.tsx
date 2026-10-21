'use client'

import { useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { GAME_VERSIONS, isGameVersion } from '@/lib/wow-data'
import type { GameVersion } from '@/types'

// Author-only. Which client a sequence is for is declared, never inferred: WoW: Forever
// declares the same interface number as Classic Era, so nothing in an export says which one a
// string was built on. The write goes through set_sequence_game_version (migration 050), which
// checks ownership against the row itself, so this control is a convenience and not the gate.

type Props = {
  supabase: SupabaseClient
  sequenceId: string
  value: GameVersion
  onChanged: (next: GameVersion) => void
}

export default function GameVersionControl({ supabase, sequenceId, value, onChanged }: Props) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function change(next: string) {
    if (!isGameVersion(next) || next === value) return
    setSaving(true)
    setError(null)
    const { error: rpcError } = await supabase.rpc('set_sequence_game_version', {
      p_sequence_id: sequenceId,
      p_game_version: next,
    })
    setSaving(false)
    if (rpcError) {
      setError('Could not change the game version. Try again in a moment.')
      return
    }
    onChanged(next)
  }

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 10,
        margin: '0 0 16px',
        padding: '10px 14px',
        background: 'var(--bg-primary)',
        border: '0.5px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        fontSize: 'var(--text-sm)',
        color: 'var(--text-secondary)',
      }}
    >
      <label htmlFor="game-version-select" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
        Game version
      </label>
      <select
        id="game-version-select"
        value={value}
        disabled={saving}
        onChange={e => change(e.target.value)}
      >
        {GAME_VERSIONS.map(g => (
          <option key={g.value} value={g.value}>{g.label}</option>
        ))}
      </select>
      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
        Pick the client this sequence was built and tested on. Only you see this control.
      </span>
      {error && <span role="alert" style={{ fontSize: 'var(--text-xs)', color: '#c44' }}>{error}</span>}
    </div>
  )
}
