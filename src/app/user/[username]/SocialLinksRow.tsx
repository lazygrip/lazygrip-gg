import { MessageCircle, Twitch, Youtube, Twitter, Globe } from 'lucide-react'
import { sanitizeSocialLinkUrl } from '@/lib/url-safety'
import type { SocialLinks } from '@/types'

// Renders the row of social-platform icon badges on the public profile
// header. Server component (no client state needed, it's plain anchors) --
// deliberately its own file rather than folded into page.tsx, mirroring the
// project convention of splitting distinct visual pieces out (ProfileTabs is
// the client-only exception to that, for its own reason).
//
// Same icon-badge-plus-brand-color treatment profile/page.tsx's
// SOCIAL_PLATFORMS settings-tab list uses, kept as its own local list rather
// than a shared import: the two files render genuinely different things
// (inputs vs. links) off the same keys, and duplicating five short lines
// costs less than coupling a settings form to a public-page component.
const PLATFORMS = [
  { key: 'discord', label: 'Discord', color: '#5865F2', icon: MessageCircle },
  { key: 'twitch', label: 'Twitch', color: '#9146FF', icon: Twitch },
  { key: 'youtube', label: 'YouTube', color: '#FF0000', icon: Youtube },
  { key: 'twitter', label: 'Twitter / X', color: '#1DA1F2', icon: Twitter },
  { key: 'website', label: 'Website', color: 'var(--text-muted)', icon: Globe },
] as const

export default function SocialLinksRow({ links }: { links: SocialLinks | null | undefined }) {
  if (!links) return null

  const entries = PLATFORMS
    .map(p => ({ ...p, href: sanitizeSocialLinkUrl(links[p.key]) }))
    .filter((p): p is typeof p & { href: string } => p.href !== null)

  if (entries.length === 0) return null

  return (
    <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
      {entries.map(({ key, label, color, icon: Icon, href }) => (
        <a
          key={key}
          href={href}
          target="_blank"
          rel="noopener noreferrer nofollow"
          title={label}
          aria-label={label}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 30,
            height: 30,
            borderRadius: '50%',
            background: 'var(--bg-secondary)',
            border: '0.5px solid var(--border)',
            color,
            flexShrink: 0,
          }}
        >
          <Icon size={15} />
        </a>
      ))}
    </div>
  )
}
