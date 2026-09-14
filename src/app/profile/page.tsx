'use client'
import { useEffect, useState, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getClassColor, CONTENT_TYPES } from '@/lib/wow-data'
import { formatDistanceToNow } from 'date-fns'
import Link from 'next/link'
import { Upload, Check, Save, BookmarkX, Link2, Unlink, AlertCircle, Trash2, Lock, Globe, X, MessageCircle, Twitch, Youtube, Twitter } from 'lucide-react'
import { sanitizeAvatarUrl } from '@/lib/url-safety'

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

const CONNECTABLE_PROVIDERS = [
  { id: 'discord', label: 'Discord', color: '#5865F2' },
  { id: 'custom:battlenet', label: 'Battle.net', color: '#148EFF' },
]

// Backs both the Settings-tab inputs below and the public profile's icon row
// (see /user/[username]/page.tsx). lucide-react has no literal Discord glyph,
// so it gets the same generic-icon-plus-brand-color treatment
// CONNECTABLE_PROVIDERS above already uses for the same platform.
const SOCIAL_PLATFORMS = [
  { key: 'discord', label: 'Discord', color: '#5865F2', icon: MessageCircle, placeholder: 'discord.gg/your-invite' },
  { key: 'twitch', label: 'Twitch', color: '#9146FF', icon: Twitch, placeholder: 'twitch.tv/yourchannel' },
  { key: 'youtube', label: 'YouTube', color: '#FF0000', icon: Youtube, placeholder: 'youtube.com/@yourchannel' },
  { key: 'twitter', label: 'Twitter / X', color: '#1DA1F2', icon: Twitter, placeholder: 'x.com/yourhandle' },
  { key: 'website', label: 'Website', color: 'var(--text-muted)', icon: Globe, placeholder: 'yoursite.com' },
] as const

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
  const [draftSequences, setDraftSequences] = useState<any[]>([])
  const [privateSequences, setPrivateSequences] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'posted' | 'saved' | 'drafts' | 'private' | 'settings'>('posted')

  // Batch publish state -- selection lives on the profile page since that's
  // where the multi-select UI is, but the actual publish call is a single
  // RPC (publish_draft_sequences_batch) so there's no per-row network chatter.
  const [selectedDraftIds, setSelectedDraftIds] = useState<Set<string>>(new Set())
  const [batchPublishing, setBatchPublishing] = useState(false)
  const [batchPublishError, setBatchPublishError] = useState<string | null>(null)

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const safeAvatarUrl = sanitizeAvatarUrl(avatarUrl)
  const [selectedColor, setSelectedColor] = useState<string | null>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [avatarSaved, setAvatarSaved] = useState(false)

  // Banner (migration 030). Separate storage bucket ('banners') and separate
  // upload/saved state from the avatar, since the two are independent images
  // with no shared "color instead of a photo" fallback the way avatars have.
  const [bannerUrl, setBannerUrl] = useState<string | null>(null)
  const safeBannerUrl = sanitizeAvatarUrl(bannerUrl)
  const [uploadingBanner, setUploadingBanner] = useState(false)
  const [bannerSaved, setBannerSaved] = useState(false)
  const bannerInputRef = useRef<HTMLInputElement>(null)

  // Social links + featured sequence (migration 030). Both save through the
  // main "Save changes" button alongside bio/battletag, not on their own
  // like the avatar/banner uploads -- there's no upload step to trigger an
  // immediate write for either of these.
  const [socialLinks, setSocialLinks] = useState<{ discord: string; twitch: string; youtube: string; twitter: string; website: string }>({
    discord: '', twitch: '', youtube: '', twitter: '', website: '',
  })
  const [featuredSequenceId, setFeaturedSequenceId] = useState<string>('')

  // Settings form state
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [battletag, setBattletag] = useState('')
  // profiles.discord_bridge_opted_out (migration 017). Per-user, covering every
  // sequence this account owns, in both directions of the comment bridge.
  // Default false here matches the column default: the bridge is on unless the
  // user turns it off.
  const [bridgeOptedOut, setBridgeOptedOut] = useState(false)
  const [settingsSaving, setSettingsSaving] = useState(false)
  const [settingsSaved, setSettingsSaved] = useState(false)
  const [settingsError, setSettingsError] = useState<string | null>(null)

  // Connected accounts state
  const [identities, setIdentities] = useState<any[]>([])
  const [identitiesLoading, setIdentitiesLoading] = useState(true)
  const [linkingProvider, setLinkingProvider] = useState<string | null>(null)
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null)
  const [identityError, setIdentityError] = useState<string | null>(null)

  // Read ?tab= from URL — resets tab on every navigation including from dropdown
  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab === 'saved') setActiveTab('saved')
    else if (tab === 'drafts') setActiveTab('drafts')
    else if (tab === 'private') setActiveTab('private')
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
        // The select above is select('*'), so the column arrives with no query
        // change. Defaulted to false rather than left undefined: the column is
        // NOT NULL, so a missing value can only mean a row written before
        // migration 017 landed, and the bridge is on in that case.
        setBridgeOptedOut(prof.discord_bridge_opted_out === true)
        setBannerUrl(prof.banner_url ?? null)
        // social_links defaults to '{}' at the DB level (migration 030), so
        // this is never null for a row read after that migration -- the ??
        // here only covers a row somehow read before the default applied.
        const links = prof.social_links ?? {}
        setSocialLinks({
          discord: links.discord ?? '',
          twitch: links.twitch ?? '',
          youtube: links.youtube ?? '',
          twitter: links.twitter ?? '',
          website: links.website ?? '',
        })
        setFeaturedSequenceId(prof.featured_sequence_id ?? '')
      }

      const { data: posted } = await supabase
        .from('sequences')
        .select('id, title, slug, class_name, class_id, spec_name, content_type, hero_talent, patch_version, avg_score, rating_count, view_count, created_at')
        .eq('author_id', user.id)
        .eq('status', 'published')
        .order('created_at', { ascending: false })

      setPostedSequences(posted ?? [])

      const { data: drafts } = await supabase
        .from('sequences')
        .select('id, title, class_name, class_id, spec_name, content_type, hero_talent, grip_string, collection_sequences, updated_at')
        .eq('author_id', user.id)
        .eq('status', 'draft')
        .order('updated_at', { ascending: false })

      setDraftSequences(drafts ?? [])

      const { data: privates } = await supabase
        .from('sequences')
        .select('id, title, slug, class_name, class_id, spec_name, content_type, hero_talent, patch_version, avg_score, rating_count, view_count, created_at')
        .eq('author_id', user.id)
        .eq('status', 'private')
        .order('created_at', { ascending: false })

      setPrivateSequences(privates ?? [])

      const { data: saves } = await supabase
        .from('saves')
        // The inner author:profiles(...) needs !sequences_author_id_fkey to
        // disambiguate as of migration 030 -- see sequence-server.ts's
        // fetchSequencePage for the full explanation. sequence:sequences(...)
        // itself doesn't need a hint; saves has only one FK to sequences.
        .select('sequence:sequences(id, title, slug, class_name, class_id, spec_name, content_type, hero_talent, patch_version, avg_score, rating_count, view_count, created_at, author:profiles!sequences_author_id_fkey(username))')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      setSavedSequences((saves ?? []).map((s: any) => s.sequence).filter(Boolean))
      setLoading(false)

      await loadIdentities()
    }
    load()
  }, [])

  async function loadIdentities() {
    setIdentitiesLoading(true)
    const { data, error } = await supabase.auth.getUserIdentities()
    if (!error && data) {
      setIdentities(data.identities ?? [])
    }
    setIdentitiesLoading(false)
  }

  async function handleLinkProvider(providerId: string) {
    setIdentityError(null)
    setLinkingProvider(providerId)
    const { data, error } = await supabase.auth.linkIdentity({
      provider: providerId as any,
      options: {
        redirectTo: `${window.location.origin}/profile?tab=settings`,
      },
    })
    if (error) {
      setIdentityError(`Failed to connect: ${error.message}`)
      setLinkingProvider(null)
      return
    }
    if (data?.url) {
      window.location.href = data.url
    }
  }

  async function handleUnlinkProvider(identity: any) {
    setIdentityError(null)
    if (identities.length < 2) {
      setIdentityError("You can't disconnect your only sign-in method. Connect another one first.")
      return
    }
    setUnlinkingId(identity.identity_id)
    const { error } = await supabase.auth.unlinkIdentity(identity)
    if (error) {
      setIdentityError(`Failed to disconnect: ${error.message}`)
    } else {
      await loadIdentities()
    }
    setUnlinkingId(null)
  }

  async function handleUnsave(seqId: string) {
    if (!user) return
    await supabase.from('saves').delete().eq('user_id', user.id).eq('sequence_id', seqId)
    setSavedSequences(prev => prev.filter((s: any) => s.id !== seqId))
  }

  // Moves a sequence between 'published' and 'private'. Protected by the
  // existing "Authors can update their own sequences" RLS policy (author_id =
  // auth.uid()) -- the .eq('author_id', user.id) below is belt-and-suspenders,
  // not the actual security boundary. Updates local state directly rather than
  // refetching both lists, since the row itself (minus status) doesn't change.
  async function handleSetStatus(seq: any, newStatus: 'published' | 'private') {
    if (!user) return
    const { error } = await supabase
      .from('sequences')
      .update({ status: newStatus })
      .eq('id', seq.id)
      .eq('author_id', user.id)
    if (error) return

    if (newStatus === 'private') {
      setPostedSequences(prev => prev.filter((s: any) => s.id !== seq.id))
      setPrivateSequences(prev => [seq, ...prev])
    } else {
      setPrivateSequences(prev => prev.filter((s: any) => s.id !== seq.id))
      setPostedSequences(prev => [seq, ...prev])
    }
  }

  function toggleDraftSelection(id: string) {
    setSelectedDraftIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleBatchPublish() {
    if (!user || selectedDraftIds.size === 0) return
    setBatchPublishing(true)
    setBatchPublishError(null)

    const { data, error } = await supabase.rpc('publish_draft_sequences_batch', {
      p_sequence_ids: Array.from(selectedDraftIds),
      p_author_id: user.id,
    })

    if (error) {
      // The RPC is all-or-nothing (single transaction) -- on failure, nothing
      // in the batch published, so the drafts list doesn't need reloading.
      setBatchPublishError(error.message || 'Batch publish failed. Please try again.')
      setBatchPublishing(false)
      return
    }

    const publishedIds = new Set<string>((data?.results ?? []).map((r: any) => r.sequence_id))
    setDraftSequences(prev => prev.filter(d => !publishedIds.has(d.id)))
    setSelectedDraftIds(new Set())
    setBatchPublishing(false)
  }

  async function handleDeleteDraft(id: string) {
    // Same delete pattern and status guard as discardDraft in post/page.tsx --
    // the .eq('status', 'draft') means this can never delete a published row
    // even if id somehow pointed to the wrong sequence.
    await supabase.from('sequences').delete().eq('id', id).eq('status', 'draft')
    setDraftSequences(prev => prev.filter(d => d.id !== id))
    setSelectedDraftIds(prev => {
      if (!prev.has(id)) return prev
      const next = new Set(prev)
      next.delete(id)
      return next
    })
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

  // Mirrors handleAvatarUpload exactly except for the bucket name -- 'banners'
  // is a separate bucket (migration 030) with its own "own file only" RLS
  // policy, same {auth.uid()}.{ext} filename convention as avatars, so a
  // banner upload can never collide with or overwrite a user's avatar file.
  async function handleBannerUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !user) return
    setUploadingBanner(true)

    const ext = file.name.split('.').pop()
    const path = `${user.id}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('banners')
      .upload(path, file, { upsert: true })

    if (uploadError) {
      console.error('Banner upload error:', JSON.stringify(uploadError))
      alert('Upload failed: ' + uploadError.message)
      setUploadingBanner(false)
      return
    }

    const { data: { publicUrl } } = supabase.storage.from('banners').getPublicUrl(path)
    const bustUrl = `${publicUrl}?t=${Date.now()}`
    setBannerUrl(bustUrl)
    await supabase.from('profiles').update({ banner_url: bustUrl }).eq('id', user.id)
    setBannerSaved(true)
    setTimeout(() => setBannerSaved(false), 2000)
    setUploadingBanner(false)
  }

  async function handleRemoveBanner() {
    if (!user) return
    setBannerUrl(null)
    await supabase.from('profiles').update({ banner_url: null }).eq('id', user.id)
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

    // Empty-string fields are dropped rather than saved as '' -- keeps
    // social_links holding only platforms the creator actually filled in, so
    // the public profile's "only render icons for keys that are set" check
    // (see /user/[username]/page.tsx) doesn't need to also treat '' as unset.
    const trimmedLinks = Object.fromEntries(
      Object.entries(socialLinks)
        .map(([k, v]) => [k, v.trim()])
        .filter(([, v]) => v.length > 0)
    )

    const { error } = await supabase
      .from('profiles')
      .update({
        username: username.trim(),
        display_name: displayName.trim(),
        bio: bio.trim(),
        battletag: battletag.trim(),
        discord_bridge_opted_out: bridgeOptedOut,
        social_links: trimmedLinks,
        featured_sequence_id: featuredSequenceId || null,
      })
      .eq('id', user.id)

    if (error) {
      setSettingsError('Save failed. Please try again.')
    } else {
      setProfile((p: any) => ({
        ...p,
        username: username.trim(),
        display_name: displayName.trim(),
        bio: bio.trim(),
        battletag: battletag.trim(),
        discord_bridge_opted_out: bridgeOptedOut,
        social_links: trimmedLinks,
        featured_sequence_id: featuredSequenceId || null,
      }))
      setSettingsSaved(true)
      setTimeout(() => setSettingsSaved(false), 2500)
    }
    setSettingsSaving(false)
  }

  const initial = profile?.username?.[0]?.toUpperCase() ?? user?.email?.[0]?.toUpperCase() ?? '?'
  const displayColor = selectedColor ?? AVATAR_COLORS[0].bg
  // Feeds the shared posted/saved/private render block below -- one list swap
  // point instead of a three-way ternary repeated at both the empty-state
  // check and the .map() call.
  const currentList = activeTab === 'posted' ? postedSequences : activeTab === 'private' ? privateSequences : savedSequences

  if (loading) return (
    <div style={{ maxWidth: 900, margin: '80px auto', padding: '0 24px', textAlign: 'center' }}>
      <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-base)' }}>Loading profile...</p>
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
          background: safeAvatarUrl ? 'transparent' : displayColor,
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
          {safeAvatarUrl
            ? <img src={safeAvatarUrl} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : initial
          }
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ fontSize: 'var(--text-lg)', fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 4 }}>
            {profile?.username ?? user?.email}
          </h1>
          {profile?.bio && (
            <p style={{ fontSize: 'var(--text-base)', color: 'var(--text-secondary)', marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {profile.bio}
            </p>
          )}
          <div style={{ display: 'flex', gap: 16 }}>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
              <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{postedSequences.length}</span> sequence{postedSequences.length !== 1 ? 's' : ''} posted
            </span>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
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
          { key: 'drafts', label: `Drafts (${draftSequences.length})` },
          { key: 'private', label: `Private (${privateSequences.length})` },
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
              fontSize: 'var(--text-sm)',
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
          bannerUrl={bannerUrl}
          uploadingBanner={uploadingBanner}
          bannerSaved={bannerSaved}
          bannerInputRef={bannerInputRef}
          onBannerUpload={handleBannerUpload}
          onBannerRemove={handleRemoveBanner}
          socialLinks={socialLinks}
          setSocialLinks={setSocialLinks}
          featuredSequenceId={featuredSequenceId}
          setFeaturedSequenceId={setFeaturedSequenceId}
          publishedSequences={postedSequences}
          username={username}
          setUsername={setUsername}
          displayName={displayName}
          setDisplayName={setDisplayName}
          bio={bio}
          setBio={setBio}
          battletag={battletag}
          setBattletag={setBattletag}
          bridgeOptedOut={bridgeOptedOut}
          setBridgeOptedOut={setBridgeOptedOut}
          onSave={saveProfileSettings}
          saving={settingsSaving}
          saved={settingsSaved}
          error={settingsError}
          identities={identities}
          identitiesLoading={identitiesLoading}
          linkingProvider={linkingProvider}
          unlinkingId={unlinkingId}
          identityError={identityError}
          onLinkProvider={handleLinkProvider}
          onUnlinkProvider={handleUnlinkProvider}
        />
      ) : activeTab === 'drafts' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {selectedDraftIds.size > 0 && (
            <div style={{
              position: 'sticky',
              top: 12,
              zIndex: 5,
              background: 'var(--bg-primary)',
              border: '0.5px solid var(--border-strong)',
              borderRadius: 'var(--radius-lg)',
              padding: '10px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
            }}>
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                {selectedDraftIds.size} draft{selectedDraftIds.size !== 1 ? 's' : ''} selected
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {batchPublishError && (
                  <span style={{ fontSize: 'var(--text-xs)', color: '#c0392b' }}>{batchPublishError}</span>
                )}
                <button
                  onClick={() => setSelectedDraftIds(new Set())}
                  disabled={batchPublishing}
                  style={{
                    padding: '7px 14px',
                    background: 'none',
                    border: '0.5px solid var(--border-strong)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--text-secondary)',
                    fontSize: 'var(--text-sm)', cursor: 'pointer', fontFamily: 'var(--font-sans)',
                  }}
                >
                  Clear
                </button>
                <button
                  onClick={handleBatchPublish}
                  disabled={batchPublishing}
                  style={{
                    padding: '7px 16px',
                    background: 'var(--accent)',
                    color: 'white',
                    border: 'none',
                    borderRadius: 'var(--radius-md)',
                    fontSize: 'var(--text-sm)', fontWeight: 500,
                    cursor: batchPublishing ? 'not-allowed' : 'pointer',
                    opacity: batchPublishing ? 0.7 : 1,
                    fontFamily: 'var(--font-sans)',
                  }}
                >
                  {batchPublishing ? 'Publishing...' : `Publish ${selectedDraftIds.size} selected`}
                </button>
              </div>
            </div>
          )}
          {draftSequences.length === 0 ? (
            <div style={{
              background: 'var(--bg-primary)',
              border: '0.5px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: '40px 24px',
              textAlign: 'center',
            }}>
              <p style={{ fontSize: 'var(--text-base)', color: 'var(--text-muted)' }}>
                You don't have any drafts in progress.
              </p>
              <Link href="/post" style={{
                display: 'inline-block',
                marginTop: 12,
                padding: '8px 16px',
                background: 'var(--accent)',
                color: 'white',
                textDecoration: 'none',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--text-sm)',
                fontWeight: 500,
              }}>
                Start a new sequence
              </Link>
            </div>
          ) : (
            draftSequences.map((draft: any) => (
              <DraftRow
                key={draft.id}
                draft={draft}
                selected={selectedDraftIds.has(draft.id)}
                onToggleSelect={toggleDraftSelection}
                onDelete={handleDeleteDraft}
              />
            ))
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {currentList.length === 0 ? (
            <div style={{
              background: 'var(--bg-primary)',
              border: '0.5px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: '40px 24px',
              textAlign: 'center',
            }}>
              <p style={{ fontSize: 'var(--text-base)', color: 'var(--text-muted)' }}>
                {activeTab === 'posted'
                  ? "You haven't posted any sequences yet."
                  : activeTab === 'private'
                  ? "You don't have any private sequences. Finished a sequence but not ready to share it? Mark it private from My Sequences."
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
                  fontSize: 'var(--text-sm)',
                  fontWeight: 500,
                }}>
                  Post your first sequence
                </Link>
              )}
            </div>
          ) : (
            currentList.map((seq: any) => (
              <SequenceRow
                key={seq.id}
                seq={seq}
                showAuthor={activeTab === 'saved'}
                onUnsave={activeTab === 'saved' ? handleUnsave : undefined}
                onSetStatus={
                  activeTab === 'posted'
                    ? (s: any) => handleSetStatus(s, 'private')
                    : activeTab === 'private'
                    ? (s: any) => handleSetStatus(s, 'published')
                    : undefined
                }
                statusActionLabel={activeTab === 'posted' ? 'Make private' : activeTab === 'private' ? 'Publish' : undefined}
                href={activeTab === 'private' ? `/post?edit=${seq.id}&mode=edit` : undefined}
              />
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
  bannerUrl, uploadingBanner, bannerSaved, bannerInputRef, onBannerUpload, onBannerRemove,
  socialLinks, setSocialLinks, featuredSequenceId, setFeaturedSequenceId, publishedSequences,
  username, setUsername, displayName, setDisplayName,
  bio, setBio, battletag, setBattletag,
  bridgeOptedOut, setBridgeOptedOut,
  onSave, saving, saved, error,
  identities, identitiesLoading, linkingProvider, unlinkingId, identityError,
  onLinkProvider, onUnlinkProvider,
}: {
  user: any
  avatarUrl: string | null
  selectedColor: string | null
  displayColor: string
  initial: string
  uploadingAvatar: boolean
  avatarSaved: boolean
  fileInputRef: React.RefObject<HTMLInputElement | null>
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
  onColorSelect: (color: string) => void
  bannerUrl: string | null
  uploadingBanner: boolean
  bannerSaved: boolean
  bannerInputRef: React.RefObject<HTMLInputElement | null>
  onBannerUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
  onBannerRemove: () => void
  socialLinks: { discord: string; twitch: string; youtube: string; twitter: string; website: string }
  setSocialLinks: React.Dispatch<React.SetStateAction<{ discord: string; twitch: string; youtube: string; twitter: string; website: string }>>
  featuredSequenceId: string
  setFeaturedSequenceId: (v: string) => void
  publishedSequences: any[]
  username: string
  setUsername: (v: string) => void
  displayName: string
  setDisplayName: (v: string) => void
  bio: string
  setBio: (v: string) => void
  battletag: string
  setBattletag: (v: string) => void
  bridgeOptedOut: boolean
  setBridgeOptedOut: (v: boolean) => void
  onSave: () => void
  saving: boolean
  saved: boolean
  error: string | null
  identities: any[]
  identitiesLoading: boolean
  linkingProvider: string | null
  unlinkingId: string | null
  identityError: string | null
  onLinkProvider: (providerId: string) => void
  onUnlinkProvider: (identity: any) => void
}) {
  const safeAvatarUrl = sanitizeAvatarUrl(avatarUrl)
  const safeBannerUrl = sanitizeAvatarUrl(bannerUrl)

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 12px',
    background: 'var(--bg-secondary)',
    border: '0.5px solid var(--border-strong)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-primary)',
    fontSize: 'var(--text-sm)',
    fontFamily: 'var(--font-sans)',
    outline: 'none',
    boxSizing: 'border-box',
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 'var(--text-xs)',
    fontWeight: 500,
    color: 'var(--text-secondary)',
    marginBottom: 6,
    display: 'block',
  }

  const hintStyle: React.CSSProperties = {
    fontSize: 'var(--text-xs)',
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
        <h2 style={{ fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 20 }}>Profile</h2>
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

          <div>
            <label style={labelStyle}>Featured sequence</label>
            <select
              style={{ ...inputStyle, cursor: 'pointer' }}
              value={featuredSequenceId}
              onChange={e => setFeaturedSequenceId(e.target.value)}
            >
              <option value="">None</option>
              {publishedSequences.map((seq: any) => (
                <option key={seq.id} value={seq.id}>{seq.title}</option>
              ))}
            </select>
            <p style={hintStyle}>
              Pinned at the top of your public profile. Only your published sequences can be
              featured -- this list won't show drafts or private ones.
            </p>
          </div>

          {/* THE CHECKBOX IS CHECKED WHEN OPTED OUT, and that is deliberate.
              The column is named for the opt-out and the label says opt out, so
              the UI, the state and the database all read the same direction and
              there is no inversion anywhere between them. Labelling this as
              "enable the bridge" would add a second inversion for no gain.

              THE LABEL SAYS COMMENTS, NOT "the Discord bridge", and that is
              also deliberate: comments are the whole reach of this flag.
              fireSequencePublishedRelay has exactly two callers,
              api/notify-discord/route.ts:325 and
              api/admin/sequence-thread/route.ts:374, and
              discord_bridge_opted_out is read in neither of them. An opted-out
              author therefore still gets a forum thread per published sequence,
              still gets the creator ping, and still gets publish, update and
              edit cards posted into it. Whoever widens the flag to cover those
              needs that list of call sites, so it lives here next to the claim
              the label makes rather than waiting to be grepped for. */}
          <div>
            <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={bridgeOptedOut}
                onChange={e => setBridgeOptedOut(e.target.checked)}
                style={{ cursor: 'pointer' }}
              />
              Opt out of Discord comment syncing
            </label>
            <p style={hintStyle}>
              With this on, comments on your sequences are not sent to the GRIP Discord,
              and Discord replies in your sequence threads are not brought back to the site.
            </p>
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
        <h2 style={{ fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 20 }}>Account</h2>
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

      {/* Connected Accounts */}
      <div style={{
        background: 'var(--bg-primary)',
        border: '0.5px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: '24px',
      }}>
        <h2 style={{ fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 6 }}>Connected accounts</h2>
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 20 }}>
          Connect Discord or Battle.net so you can sign in with either one and keep a single account.
          Connecting Discord also lets the GRIP bot tag you in the Discord thread for each sequence
          you publish, so you hear about it when someone asks a question there.
        </p>

        {identityError && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            color: '#c41e3a', fontSize: 'var(--text-xs)', marginBottom: 14,
          }}>
            <AlertCircle size={13} />
            {identityError}
          </div>
        )}

        {identitiesLoading ? (
          <p style={{ fontSize: 'var(--text-base)', color: 'var(--text-muted)' }}>Loading...</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {CONNECTABLE_PROVIDERS.map(p => {
              const linked = identities.find(i => i.provider === p.id)
              const isLinking = linkingProvider === p.id
              const isUnlinking = linked && unlinkingId === linked.identity_id

              return (
                <div key={p.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 14px',
                  border: '0.5px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: 6,
                      background: p.color,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Link2 size={14} color="white" />
                    </div>
                    <div>
                      <div style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--text-primary)' }}>{p.label}</div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                        {linked ? 'Connected' : 'Not connected'}
                      </div>
                    </div>
                  </div>

                  {linked ? (
                    <button
                      onClick={() => onUnlinkProvider(linked)}
                      disabled={isUnlinking}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        padding: '6px 12px',
                        border: '0.5px solid var(--border-strong)',
                        borderRadius: 'var(--radius-md)',
                        background: 'none',
                        color: 'var(--text-secondary)',
                        fontSize: 'var(--text-xs)', cursor: isUnlinking ? 'not-allowed' : 'pointer',
                        opacity: isUnlinking ? 0.6 : 1,
                        fontFamily: 'var(--font-sans)',
                      }}
                    >
                      <Unlink size={12} />
                      {isUnlinking ? 'Disconnecting...' : 'Disconnect'}
                    </button>
                  ) : (
                    <button
                      onClick={() => onLinkProvider(p.id)}
                      disabled={isLinking}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        padding: '6px 12px',
                        border: 'none',
                        borderRadius: 'var(--radius-md)',
                        background: p.color,
                        color: 'white',
                        fontSize: 'var(--text-xs)', cursor: isLinking ? 'not-allowed' : 'pointer',
                        opacity: isLinking ? 0.7 : 1,
                        fontFamily: 'var(--font-sans)',
                      }}
                    >
                      <Link2 size={12} />
                      {isLinking ? 'Connecting...' : 'Connect'}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Avatar */}
      <div style={{
        background: 'var(--bg-primary)',
        border: '0.5px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: '24px',
      }}>
        <h2 style={{ fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 20 }}>Avatar</h2>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 24 }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            background: safeAvatarUrl ? 'transparent' : displayColor,
            overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28, fontWeight: 700, color: 'white',
            border: '2px solid var(--border)', flexShrink: 0,
          }}>
            {safeAvatarUrl
              ? <img src={safeAvatarUrl} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
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
                  fontSize: 'var(--text-xs)', cursor: 'pointer',
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
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 'var(--text-xs)', color: 'var(--accent)', marginTop: 10 }}>
                <Check size={12} /> Saved
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Banner -- the wide image behind the avatar on the public profile
          header. No color fallback the way Avatar has, since a banner with
          nothing set just isn't shown at all on the public page rather than
          rendering an empty colored strip. */}
      <div style={{
        background: 'var(--bg-primary)',
        border: '0.5px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: '24px',
      }}>
        <h2 style={{ fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 6 }}>Banner</h2>
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 16 }}>
          Shown across the top of your public profile page, behind your avatar.
        </p>
        <div style={{
          width: '100%',
          height: 120,
          borderRadius: 'var(--radius-md)',
          background: safeBannerUrl ? `center / cover no-repeat url(${safeBannerUrl})` : 'var(--bg-tertiary)',
          border: '0.5px solid var(--border-strong)',
          marginBottom: 14,
          display: safeBannerUrl ? 'block' : 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          {!safeBannerUrl && (
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>No banner uploaded</span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={() => bannerInputRef.current?.click()}
            disabled={uploadingBanner}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '6px 12px',
              border: '0.5px solid var(--border-strong)',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-secondary)',
              color: 'var(--text-secondary)',
              fontSize: 'var(--text-xs)', cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
            }}
          >
            <Upload size={12} />
            {uploadingBanner ? 'Uploading...' : safeBannerUrl ? 'Replace banner' : 'Upload banner'}
          </button>
          {safeBannerUrl && (
            <button
              onClick={onBannerRemove}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '6px 12px',
                border: '0.5px solid var(--border-strong)',
                borderRadius: 'var(--radius-md)',
                background: 'none',
                color: 'var(--text-secondary)',
                fontSize: 'var(--text-xs)', cursor: 'pointer',
                fontFamily: 'var(--font-sans)',
              }}
            >
              <X size={12} />
              Remove
            </button>
          )}
          <input ref={bannerInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onBannerUpload} />
          {bannerSaved && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 'var(--text-xs)', color: 'var(--accent)' }}>
              <Check size={12} /> Saved
            </span>
          )}
        </div>
      </div>

      {/* Social links -- rendered as an icon row on the public profile header
          (see /user/[username]/page.tsx) whenever a value is set. All optional,
          all plain text (not validated as URLs) so a Discord invite code or a
          bare handle works exactly as well as a full link. */}
      <div style={{
        background: 'var(--bg-primary)',
        border: '0.5px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: '24px',
      }}>
        <h2 style={{ fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 6 }}>Social links</h2>
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 16 }}>
          Shown as icons on your public profile. Leave any blank to hide them.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {SOCIAL_PLATFORMS.map(platform => {
            const Icon = platform.icon
            return (
              <div key={platform.key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 6, flexShrink: 0,
                  background: platform.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon size={14} color="white" />
                </div>
                <input
                  style={inputStyle}
                  value={socialLinks[platform.key]}
                  onChange={e => setSocialLinks(prev => ({ ...prev, [platform.key]: e.target.value }))}
                  placeholder={platform.placeholder}
                  maxLength={200}
                />
              </div>
            )
          })}
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
            fontSize: 'var(--text-sm)', fontWeight: 500,
            cursor: saving ? 'not-allowed' : 'pointer',
            opacity: saving ? 0.7 : 1,
            fontFamily: 'var(--font-sans)',
          }}
        >
          <Save size={13} />
          {saving ? 'Saving...' : 'Save changes'}
        </button>
        {saved && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 'var(--text-sm)', color: 'var(--accent)' }}>
            <Check size={13} /> Saved
          </span>
        )}
        {error && <span style={{ fontSize: 'var(--text-sm)', color: '#c0392b' }}>{error}</span>}
      </div>

    </div>
  )
}

function DraftRow({
  draft, selected, onToggleSelect, onDelete,
}: {
  draft: any
  selected: boolean
  onToggleSelect: (id: string) => void
  onDelete: (id: string) => void
}) {
  const classColor = draft.class_id ? getClassColor(draft.class_id) : 'var(--text-muted)'
  const contentLabel = CONTENT_TYPES.find(c => c.value === draft.content_type)?.label ?? draft.content_type
  const isCollection = Array.isArray(draft.collection_sequences) && draft.collection_sequences.length > 0
  const checkedCount = isCollection
    ? draft.collection_sequences.filter((s: any) => s.checked).length
    : 0

  // Same checks publish_draft_sequence / publish_draft_sequences_batch
  // enforce server-side, branched the same way: collections need at least
  // one checked sequence instead of a grip_string. Kept in sync manually
  // since there's no shared client/server validation module -- if those
  // RPCs' required-field checks change, this needs updating too.
  const missing: string[] = []
  if (!draft.title || !draft.title.trim() || draft.title === 'Untitled draft') missing.push('title')
  if (!draft.class_id) missing.push('class')
  if (isCollection) {
    if (checkedCount === 0) missing.push('a selected sequence')
  } else {
    if (!draft.grip_string || !draft.grip_string.trim()) missing.push('GRIP export')
  }
  const readyToPublish = missing.length === 0

  return (
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
      }}
    >
      <input
        type="checkbox"
        checked={selected}
        disabled={!readyToPublish}
        title={readyToPublish ? undefined : `Can't publish yet -- missing ${missing.join(', ')}`}
        onClick={e => e.stopPropagation()}
        onChange={() => onToggleSelect(draft.id)}
        style={{ width: 16, height: 16, cursor: readyToPublish ? 'pointer' : 'not-allowed', flexShrink: 0 }}
      />
      <Link
        href={`/post?draftId=${draft.id}`}
        style={{ textDecoration: 'none', flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer' }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--text-primary)', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {draft.title && draft.title !== 'Untitled draft' ? draft.title : 'Untitled draft'}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            {draft.class_name && <span style={{ fontSize: 'var(--text-xs)', color: classColor }}>{draft.class_name}</span>}
            {draft.spec_name && <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>· {draft.spec_name}</span>}
            {draft.content_type && <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>· {contentLabel}</span>}
            {draft.hero_talent && <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>· {draft.hero_talent}</span>}
            {isCollection && <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>· Collection ({checkedCount}/{draft.collection_sequences.length} selected)</span>}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
          <span style={{
            fontSize: 'var(--text-xs)',
            fontWeight: 500,
            padding: '3px 8px',
            borderRadius: 'var(--radius-sm)',
            color: readyToPublish ? 'var(--accent)' : '#c69b3a',
            background: readyToPublish ? 'rgba(29,158,117,0.12)' : 'rgba(198,155,58,0.14)',
          }}>
            {readyToPublish ? 'Ready to publish' : `Missing ${missing.join(', ')}`}
          </span>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
            edited {formatDistanceToNow(new Date(draft.updated_at), { addSuffix: true })}
          </span>
        </div>
      </Link>
      <button
        onClick={e => {
          e.preventDefault()
          e.stopPropagation()
          if (window.confirm('Delete this draft? This cannot be undone.')) {
            onDelete(draft.id)
          }
        }}
        title="Delete draft"
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: 6,
          color: 'var(--text-muted)',
          display: 'flex',
          alignItems: 'center',
          borderRadius: 'var(--radius-sm)',
          flexShrink: 0,
        }}
        onMouseEnter={e => (e.currentTarget.style.color = '#c41e3a')}
        onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
      >
        <Trash2 size={15} />
      </button>
    </div>
  )
}

function SequenceRow({ seq, showAuthor, onUnsave, onSetStatus, statusActionLabel, href }: {
  seq: any
  showAuthor: boolean
  onUnsave?: (id: string) => void
  onSetStatus?: (seq: any) => void
  statusActionLabel?: string
  // Private sequences have no reachable /sequences/[slug] page -- that route
  // (and its generateStaticParams/fetchSequencePage backing) only ever
  // fetches status='published' rows through the cookie-free public client,
  // for anyone including the author, exactly like a draft row already can't
  // be viewed there. So the Private tab passes the author's own /post?edit=
  // link instead -- the same "view/edit this sequence" entry point the
  // sequence detail page's own Edit button uses.
  href?: string
}) {
  const classColor = getClassColor(seq.class_id)
  const contentLabel = CONTENT_TYPES.find(c => c.value === seq.content_type)?.label ?? seq.content_type

  return (
    <Link href={href ?? `/sequences/${seq.slug}`} style={{ textDecoration: 'none' }}>
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
          <div style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--text-primary)', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {seq.title}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 'var(--text-xs)', color: classColor }}>{seq.class_name}</span>
            {seq.spec_name && <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>· {seq.spec_name}</span>}
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>· {contentLabel}</span>
            {seq.hero_talent && <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>· {seq.hero_talent}</span>}
            {showAuthor && seq.author?.username && (
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                · by{' '}
                <Link
                  href={`/user/${seq.author.username}`}
                  onClick={e => e.stopPropagation()}
                  style={{ color: 'var(--text-muted)', textDecoration: 'none' }}
                  onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                  onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
                >
                  {seq.author.username}
                </Link>
              </span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 16, flexShrink: 0, alignItems: 'center' }}>
          {seq.avg_score && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--accent)', lineHeight: 1 }}>{seq.avg_score}</div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{seq.rating_count ?? 0} ratings</div>
            </div>
          )}
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{seq.view_count?.toLocaleString() ?? 0} views</div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{formatDistanceToNow(new Date(seq.created_at), { addSuffix: true })}</div>
          </div>
          {onSetStatus && statusActionLabel && (
            <button
              onClick={e => { e.preventDefault(); e.stopPropagation(); onSetStatus(seq) }}
              title={statusActionLabel === 'Publish' ? 'Publish this sequence' : 'Make this sequence private -- only visible to you'}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                background: 'none',
                border: '0.5px solid var(--border-strong)',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                padding: '5px 10px',
                color: 'var(--text-secondary)',
                fontSize: 'var(--text-xs)',
                fontFamily: 'var(--font-sans)',
                flexShrink: 0,
              }}
            >
              {statusActionLabel === 'Publish' ? <Globe size={12} /> : <Lock size={12} />}
              {statusActionLabel}
            </button>
          )}
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
