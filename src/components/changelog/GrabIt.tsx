import { ArrowDownToLine } from 'lucide-react'
import Spoiler from './Spoiler'
import InlineMd from './InlineMd'
import { EMS_LINKS } from '@/lib/changelog/ems-archive'

const SOURCES = [
  { name: 'CurseForge', href: EMS_LINKS.curseforge, tone: 'fixed' },
  { name: 'Wago', href: EMS_LINKS.wago, tone: 'changed' },
  { name: 'WoWInterface', href: EMS_LINKS.wowinterface, tone: 'added' },
]

// The closing block of every changelog page: where to get it, and a short note that stays blurred until clicked.
export default function GrabIt({ title = 'Grab it', links, authorNote, siteNote, siteNoteLabel = 'How this page is built' }: {
  title?: string
  links?: { name: string; href: string; tone: string; external?: boolean }[]
  // Sataana's own words, shown exactly as he wrote them.
  authorNote?: string
  // A note written by LazyGrip about the page itself, labelled as such.
  siteNote?: string
  siteNoteLabel?: string
}) {
  const items = links ?? SOURCES.map(s => ({ ...s, external: true }))
  return (
    <section aria-labelledby="grab-it" className="cl-grab">
      <h2 id="grab-it" style={{ margin: '0 0 12px', fontSize: 'var(--text-lg)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span className="cl-ico cl-t-added"><ArrowDownToLine size={16} strokeWidth={2.2} aria-hidden /></span>
        {title}
      </h2>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {items.map(s => (
          <a key={s.name} href={s.href} className={`cl-chip cl-t-${s.tone}`} style={{ fontSize: 'var(--text-sm)', padding: '7px 16px' }}
            {...(s.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
            {s.name}
          </a>
        ))}
      </div>
      {authorNote && (
        <Spoiler label="P.S. from Sataana">
          <span>{authorNote}</span>
        </Spoiler>
      )}
      {siteNote && (
        <Spoiler label={siteNoteLabel}>
          <span><InlineMd text={siteNote} inline /></span>
        </Spoiler>
      )}
    </section>
  )
}
