'use client'
import { useEffect, useState, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getClassColor, CONTENT_TYPES } from '@/lib/wow-data'
import { formatDistanceToNow } from 'date-fns'
import Link from 'next/link'
import { Upload, Check, Save, BookmarkX } from 'lucide-react'

const AVATAR_COLORS = [
  { bg: '#1D9E75', label: 'Emerald' },
  { bg: '#5a8dee', label: 'Sapphire' },
  { bg: '#a330c9', label: 'Arcane' },
  { bg: '#c69b3a', label: 'Gold' },
  { bg: '#c0392b', label: 'Crimson' },
  { bg: '#ff7c0a', label: 'Flame' },
  { bg: '#3fc7eb', label: 'Frost' },
  { bg: '#aad372', label: 'Nature' },
]

export default function ProfilePage() {
  return (
    <Suspense fallback={null}>
      <ProfilePageInner />
    </Suspense>
  )
}

function ProfilePageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [postedSequences, setPostedSequences] = useState<any[]>([])
  const [savedSequences, setSavedSequences] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'posted' | 'saved' | 'settings'>('posted')

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [selectedColor, setSelectedColor] = useState<string | null>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [avatarSaved, setAvatarSaved] = useState(false)

  // Settings form state
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [battletag, setBattletag] = useState('')
  const [settingsSaving, setSettingsSaving] = useState(false)
  const [settingsSaved, setSettingsSaved] = useState(false)
  const [settingsError, setSettingsError] = useState<string | null>(null)

  // Read ?tab= from URL — resets tab on every navigation including from dropdown
  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab === 'saved') setActiveTab('saved')
    else if (tab === 'settings') setActiveTab('settings')
    else setActiveTab('posted')
  }, [searchParams])

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      setUser(user)

      const { data: prof } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (prof) {
        setProfile(prof)
        setAvatarUrl(prof.avatar_url ?? null)
        setSelectedColor(prof.avatar_color ?? AVATAR_COLORS[0].bg)
        setUsername(prof.username ?? '')
        setDisplayName(prof.display_name ?? '')
        setBio(prof.bio ?? '')
        setBattletag(prof.battletag ?? '')
      }

      const { data: posted } = await supabase
        .from('sequences')
        .select('id, title, slug, class_name, class_id, spec_name, content_type, hero_talent, patch_version, avg_score, rating_count, view_count, created_at')
        .eq('author_id', user.id)
        .eq('is_published', true)
        .order('created_at', { ascending: false })

      setPostedSequences(posted ?? [])

      const { data: saves } = await supabase
        .from('saves')
        .select('sequence:sequences(id, title, slug, class_name, class_id, spec_name, content_type, hero_talent, patch_version, avg_score, rating_count, view_count, created_at, author:profiles(username))')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      setSavedSequences((saves ?? []).map((s: any) => s.sequence).filter(Boolean))
      setLoading(false)
    }
    load()
  }, [])

  async function handleUnsave(seqId: string) {
    if (!user) return
    await supabase.from('saves').delete().eq('user_id', user.id).eq('sequence_id', seqId)
    setSavedSequences(prev => prev.filter((s: any) => s.id !== seqId))
  }

  async function saveAvatarColor(color: string) {
    if (!user) return
    setSelectedColor(color)
    setAvatarUrl(null)
    await supabase.from('profiles').update({ avatar_color: color, avatar_url: null }).eq('id', user.id)
    setAvatarSaved(true)
    setTimeout(() => setAvatarSaved(false), 2000)
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !user) return
    setUploadingAvatar(true)

    const ext = file.name.split('.').pop()
    const path = `${user.id}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true })

    if (uploadError) {
      console.error('Upload error:', JSON.stringify(uploadError))
      alert('Upload failed: ' + uploadError.message)
      setUploadingAvatar(false)
      return
    }

    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
	const bustUrl = `${publicUrl}?t=${Date.now()}`
	setAvatarUrl(bustUrl)
	await supabase.from('profiles').update({ avatar_url: bustUrl }).eq('id', user.id)
    setAvatarSaved(true)
    setTimeout(() => setAvatarSaved(false), 2000)
    setUploadingAvatar(false)
  }

  async function saveProfileSettings() {
    if (!user) return
    setSettingsSaving(true)
    setSettingsError(null)

    if (username !== profile?.username) {
      const { data: existing } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', username.trim())
        .neq('id', user.id)
        .single()
      if (existing) {
        setSettingsError('That username is already taken.')
        setSettingsSaving(false)
        return
      }
    }

    const { error } = await supabase
      .from('profiles')
      .update({
        username: username.trim(),
        display_name: displayName.trim(),
        bio: bio.trim(),
        battletag: battletag.trim(),
      })
      .eq('id', user.id)

    if (error) {
      setSettingsError('Save failed. Please try again.')
    } else {
      setProfile((p: any) => ({ ...p, username: username.trim(), display_name: displayName.trim(), bio: bio.trim(), battletag: battletag.trim() }))
      setSettingsSaved(true)
      setTimeout(() => setSettingsSaved(false), 2500)
    }
    setSettingsSaving(false)
  }

  const initial = profile?.username?.[0]?.toUpperCase() ?? user?.email?.[0]?.toUpperCase() ?? '?'
  const displayColor = selectedColor ?? AVATAR_COLORS[0].bg

  if (loading) return (
    <div style={{ maxWidth: 900, margin: '80px auto', padding: '0 24px', textAlign: 'center' }}>
      <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Loading profile...</p>
    </div>
  )

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '28px 24px' }}>

      {/* Profile header card */}
      <div style={{
        background: 'var(--bg-primary)',
        border: '0.5px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: '28px',
        marginBottom: 20,
        display: 'flex',
        gap: 20,
        alignItems: 'center',
      }}>
        <div style={{
          width: 64,
          height: 64,
          borderRadius: '50%',
          background: avatarUrl ? 'transparent' : displayColor,
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 24,
          fontWeight: 700,
          color: 'white',
          border: '2px solid var(--border)',
          flexShrink: 0,
        }}>
          {avatarUrl
            ? <img src={avatarUrl} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : initial
          }
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 4 }}>
            {profile?.username ?? user?.email}
          </h1>
          {profile?.bio && (
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {profile.bio}
            </p>
          )}
          <div style={{ display: 'flex', gap: 16 }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{postedSequences.length}</span> sequence{postedSequences.length !== 1 ? 's' : ''} posted
            </span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{savedSequences.length}</span> saved
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex',
        gap: 0,
        borderBottom: '0.5px solid var(--border)',
        marginBottom: 16,
      }}>
        {([
          { key: 'posted', label: `My Sequences (${postedSequences.length})` },
          { key: 'saved', label: `Saved (${savedSequences.length})` },
          { key: 'settings', label: 'Settings' },
        ] as const).map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '10px 18px',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === tab.key ? '2px solid var(--accent)' : '2px solid transparent',
              color: activeTab === tab.key ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontSize: 13,
              fontWeight: activeTab === tab.key ? 500 : 400,
              cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
              marginBottom: -1,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'settings' ? (
        <SettingsTab
          user={user}
          avatarUrl={avatarUrl}
          selectedColor={selectedColor}
          displayColor={displayColor}
          initial={initial}
          uploadingAvatar={uploadingAvatar}
          avatarSaved={avatarSaved}
          fileInputRef={fileInputRef}
          onUpload={handleAvatarUpload}
          onColorSelect={saveAvatarColor}
          username={username}
          setUsername={setUsername}
          displayName={displayName}
          setDisplayName={setDisplayName}
          bio={bio}
          setBio={setBio}
          battletag={battletag}
          setBattletag={setBattletag}
          onSave={saveProfileSettings}
          saving={settingsSaving}
          saved={settingsSaved}
          error={settingsError}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {(activeTab === 'posted' ? postedSequences : savedSequences).length === 0 ? (
            <div style={{
              background: 'var(--bg-primary)',
              border: '0.5px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: '40px 24px',
              textAlign: 'center',
            }}>
              <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>
                {activeTab === 'posted'
                  ? "You haven't posted any sequences yet."
                  : "You haven't saved any sequences yet."}
              </p>
              {activeTab === 'posted' && (
                <Link href="/post" style={{
                  display: 'inline-block',
                  marginTop: 12,
                  padding: '8px 16px',
                  background: 'var(--accent)',
                  color: 'white',
                  textDecoration: 'none',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 13,
                  fontWeight: 500,
                }}>
                  Post your first sequence
                </Link>
              )}
            </div>
          ) : (
            (activeTab === 'posted' ? postedSequences : savedSequences).map((seq: any) => (
              <SequenceRow key={seq.id} seq={seq} showAuthor={activeTab === 'saved'} onUnsave={activeTab === 'saved' ? handleUnsave : undefined} />
            ))
          )}
        </div>
      )}
    </div>
  )
}

function SettingsTab({
  user, avatarUrl, selectedColor, displayColor, initial,
  uploadingAvatar, avatarSaved, fileInputRef, onUpload, onColorSelect,
  username, setUsername, displayName, setDisplayName,
  bio, setBio, battletag, setBattletag,
  onSave, saving, saved, error,
}: {
  user: any
  avatarUrl: string | null
  selectedColor: string | null
  displayColor: string
  initial: string
  uploadingAvatar: boolean
  avatarSaved: boolean
  fileInputRef: React.RefObject<HTMLInputElement>
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
  onColorSelect: (color: string) => void
  username: string
  setUsername: (v: string) => void
  displayName: string
  setDisplayName: (v: string) => void
  bio: string
  setBio: (v: string) => void
  battletag: string
  setBattletag: (v: string) => void
  onSave: () => void
  saving: boolean
  saved: boolean
  error: string | null
}) {
  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 12px',
    background: 'var(--bg-secondary)',
    border: '0.5px solid var(--border-strong)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-primary)',
    fontSize: 13,
    fontFamily: 'var(--font-sans)',
    outline: 'none',
    boxSizing: 'border-box',
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 500,
    color: 'var(--text-secondary)',
    marginBottom: 6,
    display: 'block',
  }

  const hintStyle: React.CSSProperties = {
    fontSize: 11,
    color: 'var(--text-muted)',
    marginTop: 4,
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* Profile info */}
      <div style={{
        background: 'var(--bg-primary)',
        border: '0.5px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: '24px',
      }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 20 }}>Profile</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          <div>
            <label style={labelStyle}>Username</label>
            <input
              style={inputStyle}
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="your username"
              maxLength={30}
            />
            <p style={hintStyle}>Your unique handle on LazyGrip. Shown on all your sequences.</p>
          </div>

          <div>
            <label style={labelStyle}>Display name</label>
            <input
              style={inputStyle}
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="Your Name"
              maxLength={50}
            />
            <p style={hintStyle}>Optional longer name shown on your profile page.</p>
          </div>

          <div>
            <label style={labelStyle}>Bio</label>
            <textarea
              style={{ ...inputStyle, resize: 'vertical', minHeight: 80, lineHeight: 1.5 } as React.CSSProperties}
              value={bio}
              onChange={e => setBio(e.target.value)}
              placeholder="Tell the community a bit about yourself..."
              maxLength={300}
            />
            <p style={hintStyle}>{bio.length}/300</p>
          </div>

          <div>
            <label style={labelStyle}>Battle tag</label>
            <input
              style={inputStyle}
              value={battletag}
              onChange={e => setBattletag(e.target.value)}
              placeholder="YourName#1234"
              maxLength={20}
            />
            <p style={hintStyle}>Optional. Shown on your public profile.</p>
          </div>

        </div>
      </div>

      {/* Account */}
      <div style={{
        background: 'var(--bg-primary)',
        border: '0.5px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: '24px',
      }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 20 }}>Account</h2>
        <div>
          <label style={labelStyle}>Email</label>
          <input
            style={{ ...inputStyle, opacity: 0.6, cursor: 'not-allowed' }}
            value={user?.email ?? ''}
            readOnly
          />
          <p style={hintStyle}>Email cannot be changed here.</p>
        </div>
      </div>

      {/* Avatar */}
      <div style={{
        background: 'var(--bg-primary)',
        border: '0.5px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: '24px',
      }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 20 }}>Avatar</h2>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 24 }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            background: avatarUrl ? 'transparent' : displayColor,
            overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28, fontWeight: 700, color: 'white',
            border: '2px solid var(--border)', flexShrink: 0,
          }}>
            {avatarUrl
              ? <img src={avatarUrl} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : initial
            }
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ marginBottom: 16 }}>
              <p style={labelStyle}>Photo</p>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '6px 12px',
                  border: '0.5px solid var(--border-strong)',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-secondary)',
                  fontSize: 12, cursor: 'pointer',
                  fontFamily: 'var(--font-sans)',
                }}
              >
                <Upload size={12} />
                {uploadingAvatar ? 'Uploading...' : 'Upload photo'}
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onUpload} />
            </div>
            <div>
              <p style={labelStyle}>Color</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {AVATAR_COLORS.map(opt => (
                  <button
                    key={opt.bg}
                    onClick={() => onColorSelect(opt.bg)}
                    title={opt.label}
                    style={{
                      width: 28, height: 28, borderRadius: '50%', background: opt.bg,
                      border: selectedColor === opt.bg && !avatarUrl ? '2.5px solid var(--text-primary)' : '2px solid transparent',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      padding: 0, outline: 'none',
                    }}
                  >
                    {selectedColor === opt.bg && !avatarUrl && <Check size={12} color="white" strokeWidth={3} />}
                  </button>
                ))}
              </div>
            </div>
            {avatarSaved && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--accent)', marginTop: 10 }}>
                <Check size={12} /> Saved
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Save button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={onSave}
          disabled={saving}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '8px 18px',
            background: 'var(--accent)', color: 'white',
            border: 'none', borderRadius: 'var(--radius-md)',
            fontSize: 13, fontWeight: 500,
            cursor: saving ? 'not-allowed' : 'pointer',
            opacity: saving ? 0.7 : 1,
            fontFamily: 'var(--font-sans)',
          }}
        >
          <Save size={13} />
          {saving ? 'Saving...' : 'Save changes'}
        </button>
        {saved && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, color: 'var(--accent)' }}>
            <Check size={13} /> Saved
          </span>
        )}
        {error && <span style={{ fontSize: 13, color: '#c0392b' }}>{error}</span>}
      </div>

    </div>
  )
}

function SequenceRow({ seq, showAuthor, onUnsave }: { seq: any; showAuthor: boolean; onUnsave?: (id: string) => void }) {
  const classColor = getClassColor(seq.class_id)
  const contentLabel = CONTENT_TYPES.find(c => c.value === seq.content_type)?.label ?? seq.content_type

  return (
    <Link href={`/sequences/${seq.slug}`} style={{ textDecoration: 'none' }}>
      <div
        style={{
          background: 'var(--bg-primary)',
          border: '0.5px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: '14px 18px',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          borderLeft: `3px solid ${classColor}`,
          cursor: 'pointer',
        }}
        onMouseEnter={e => (e.currentTarget.style.borderLeftColor = 'var(--accent)')}
        onMouseLeave={e => (e.currentTarget.style.borderLeftColor = classColor)}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {seq.title}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: classColor }}>{seq.class_name}</span>
            {seq.spec_name && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>· {seq.spec_name}</span>}
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>· {contentLabel}</span>
            {seq.hero_talent && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>· {seq.hero_talent}</span>}
            {showAuthor && seq.author?.username && (
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>· by {seq.author.username}</span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 16, flexShrink: 0, alignItems: 'center' }}>
          {seq.avg_score && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--accent)', lineHeight: 1 }}>{seq.avg_score}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{seq.rating_count ?? 0} ratings</div>
            </div>
          )}
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{seq.view_count?.toLocaleString() ?? 0} views</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{formatDistanceToNow(new Date(seq.created_at), { addSuffix: true })}</div>
          </div>
          {onUnsave && (
            <button
              onClick={e => { e.preventDefault(); e.stopPropagation(); onUnsave(seq.id) }}
              title="Remove from saved"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 4,
                color: 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                borderRadius: 'var(--radius-sm)',
              }}
              onMouseEnter={e => (e.currentTarget.style.color = '#c0392b')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
            >
              <BookmarkX size={15} />
            </button>
          )}
        </div>
      </div>
    </Link>
  )
}
