import type { Metadata } from 'next'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { CalendarDays, Download, FlaskConical, Library, MessageCircle } from 'lucide-react'
import { createPublicClient } from '@/lib/supabase/public'
import { getClassColor } from '@/lib/wow-data'
import { EMS_RELEASES } from '@/lib/changelog/ems-archive'
import ForeverMark from '@/components/forever/ForeverMark'
import {
  FOREVER_FACTS,
  FOREVER_LAUNCH_DATE,
  FOREVER_OBSERVATIONS,
  FOREVER_RAIDS_DATE,
  FOREVER_TIMELINE,
  daysUntil,
  type ForeverObservation,
  type ForeverObservationStatus,
} from '@/data/forever-observations'

// Only the cookie-free public client is used here, so the route stays cacheable. The sequence list
// and count are the live parts of the page; the observations, facts and timeline are a data file
// and change with a commit.
export const revalidate = 600

const DESCRIPTION =
  'Forever is live. What GRIP-EMS has been seen doing on WoW: Forever, which sequences are already posted, and what is still unproven, with every claim dated.'

export const metadata: Metadata = {
  title: 'GRIP-EMS on WoW: Forever',
  description: DESCRIPTION,
  alternates: { canonical: 'https://lazygrip.net/forever' },
  openGraph: {
    title: 'GRIP-EMS on WoW: Forever | LazyGrip.net',
    description: DESCRIPTION,
    url: 'https://lazygrip.net/forever',
    siteName: 'LazyGrip.net',
    type: 'website',
  },
}

const STATUS_LABEL: Record<ForeverObservationStatus, string> = {
  confirmed: 'Confirmed',
  reported: 'Reported',
  unsettled: 'Unsettled',
  untested: 'Untested',
}

const STATUS_COLOR: Record<ForeverObservationStatus, string> = {
  confirmed: '#1D9E75',
  reported: '#5a8dee',
  unsettled: '#e0a020',
  untested: '#888',
}

const CONTENT_LABELS: Record<string, string> = {
  raid: 'Raid',
  mythic_plus: 'Mythic+',
  pvp: 'PvP',
  solo: 'Solo',
}

type ForeverSequenceCard = {
  slug: string
  title: string
  class_id: number
  class_name: string
  spec_name: string | null
  content_type: string
  grip_version: string | null
  created_at: string
  author: { username: string | null } | Array<{ username: string | null }> | null
}

async function fetchForeverSequences(): Promise<{ count: number; sequences: ForeverSequenceCard[] } | null> {
  try {
    const supabase = createPublicClient()
    const { data, count, error } = await supabase
      .from('sequences')
      // !sequences_author_id_fkey pins the embed to the author relationship, see browse-query.ts.
      .select(
        'slug, title, class_id, class_name, spec_name, content_type, grip_version, created_at, author:profiles!sequences_author_id_fkey(username)',
        { count: 'exact' },
      )
      .eq('status', 'published')
      .eq('game_version', 'forever')
      .order('created_at', { ascending: false })
      .limit(6)
    if (error) return null
    return { count: count ?? (data ?? []).length, sequences: (data ?? []) as unknown as ForeverSequenceCard[] }
  } catch {
    return null
  }
}

function authorName(a: ForeverSequenceCard['author']): string | null {
  const row = Array.isArray(a) ? a[0] : a
  return row?.username ?? null
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

function formatShortDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

const link = { color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 } as const
const body = { color: 'var(--text-secondary)', lineHeight: 1.7, fontSize: 'var(--text-base)' } as const
const cardBase = {
  background: 'var(--bg-primary)',
  border: '0.5px solid var(--border)',
  borderRadius: 'var(--radius-lg)',
} as const

function SectionHeading({ eyebrow, title, children }: { eyebrow: string; title: string; children?: ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <p style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--accent)', letterSpacing: '.08em', textTransform: 'uppercase', margin: '0 0 6px' }}>
        {eyebrow}
      </p>
      <h2 style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em', margin: 0 }}>{title}</h2>
      {children ? <p style={{ ...body, margin: '8px 0 0', maxWidth: 680 }}>{children}</p> : null}
    </div>
  )
}

function StatusChip({ status }: { status: ForeverObservationStatus }) {
  return (
    <span
      style={{
        fontSize: 'var(--text-xs)',
        fontWeight: 600,
        padding: '2px 8px',
        borderRadius: 'var(--radius-sm)',
        color: STATUS_COLOR[status],
        border: `0.5px solid ${STATUS_COLOR[status]}55`,
        background: `${STATUS_COLOR[status]}18`,
        whiteSpace: 'nowrap',
      }}
    >
      {STATUS_LABEL[status]}
    </span>
  )
}

function ObservationCard({ o }: { o: ForeverObservation }) {
  return (
    <div style={{ ...cardBase, borderRadius: 'var(--radius-md)', padding: '14px 16px' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <StatusChip status={o.status} />
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
          {formatDate(o.date)} · {o.source}
        </span>
      </div>
      <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.65, margin: 0 }}>{o.text}</p>
    </div>
  )
}

const STEPS: Array<{ title: string; text: ReactNode; icon: ReactNode }> = [
  {
    title: 'Update the addon',
    icon: <Download size={18} />,
    text: (
      <>
        Install v2.4.23 or later from{' '}
        <a href="https://www.curseforge.com/wow/addons/grip-enhanced-macro-sequencer" target="_blank" rel="noopener noreferrer" style={link}>CurseForge</a>
        , Wago or WoWInterface, the same way you would on retail. v2.4.20 broke at every Forever login, so an old copy is worth replacing.
      </>
    ),
  },
  {
    title: 'Grab a sequence',
    icon: <Library size={18} />,
    text: (
      <>
        Use the <Link href="/browse?game_version=forever" style={link}>Forever filter on Browse</Link>. The plain Browse page shows retail only, so a retail sequence can&apos;t land on your Forever client by accident.
      </>
    ),
  },
  {
    title: 'Check it saves',
    icon: <FlaskConical size={18} />,
    text: 'Bind it, reload the UI, and make sure the keybind and your settings survived before you judge a sequence, because that is the first thing to rule out.',
  },
  {
    title: 'Tell us what happened',
    icon: <MessageCircle size={18} />,
    text: (
      <>
        Post it in the{' '}
        <a href="https://discord.gg/UUdmCNUv" target="_blank" rel="noopener noreferrer" style={link}>GRIP-EMS Discord</a>
        {' '}with the date and what you ran, and it goes on the list below with your name on it.
      </>
    ),
  },
]

export default async function ForeverPage() {
  const forever = await fetchForeverSequences()
  const count = forever?.count ?? null

  const raidsIn = daysUntil(FOREVER_RAIDS_DATE)
  const raidsLine =
    raidsIn > 1 ? `Raids open Dec 9, in ${raidsIn} days` : raidsIn === 1 ? 'Raids open tomorrow' : raidsIn === 0 ? 'Raids open today' : 'Raids are open'

  const live = FOREVER_OBSERVATIONS.filter(o => o.date >= FOREVER_LAUNCH_DATE || o.status === 'untested')
  const beta = FOREVER_OBSERVATIONS.filter(o => !live.includes(o))

  // The first timeline entry that has not happened yet gets the "next" treatment.
  const nextIdx = FOREVER_TIMELINE.findIndex(t => daysUntil(t.date) > 0)

  const tiles = [
    { value: count === null ? 'n/a' : String(count), label: 'Forever sequences on the site' },
    { value: `v${EMS_RELEASES[0].version}`, label: 'Current GRIP-EMS release' },
    { value: FOREVER_FACTS.interfaceNumber, label: 'Interface number Forever declares' },
  ]

  return (
    <div>
      {/* Hero */}
      <section className="forever-hero" style={{ background: 'var(--bg-primary)', borderBottom: '0.5px solid var(--border)', padding: '56px 24px 52px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ maxWidth: 860, margin: '0 auto', textAlign: 'center', position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
            <ForeverMark width={290} />
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginBottom: 18 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '5px 12px', borderRadius: 999, background: 'var(--accent-subtle)', border: '0.5px solid var(--accent)', color: 'var(--accent-text)', fontSize: 'var(--text-xs)', fontWeight: 600 }}>
              <span className="forever-live-dot" style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block' }} />
              Live since Nov 4
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 999, background: 'var(--bg-tertiary)', border: '0.5px solid var(--border-strong)', color: 'var(--text-secondary)', fontSize: 'var(--text-xs)', fontWeight: 500 }}>
              <CalendarDays size={12} />
              {raidsLine}
            </span>
          </div>

          <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3rem)', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.1, letterSpacing: '-0.02em', margin: '0 0 16px' }}>
            GRIP-EMS on <span className="forever-title-accent">WoW: Forever</span>
          </h1>
          <p style={{ ...body, fontSize: 'var(--text-lg)', maxWidth: 640, margin: '0 auto 26px' }}>
            Forever is live, and this page keeps score on what GRIP-EMS has actually been seen doing on it, which sequences are already up, and what nobody has proven yet, with every claim dated so you can tell when it&apos;s gone stale.
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 10, marginBottom: 34 }}>
            <Link href="/browse?game_version=forever" style={{ display: 'inline-flex', alignItems: 'center', padding: '10px 20px', borderRadius: 'var(--radius-md)', background: 'var(--accent)', color: 'white', textDecoration: 'none', fontWeight: 600, fontSize: 'var(--text-base)' }}>
              Browse Forever sequences
            </Link>
            <Link href="/guide/wow-forever" style={{ display: 'inline-flex', alignItems: 'center', padding: '10px 20px', borderRadius: 'var(--radius-md)', border: '0.5px solid var(--border-strong)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', textDecoration: 'none', fontWeight: 500, fontSize: 'var(--text-base)' }}>
              Read the full write-up
            </Link>
          </div>

          <div className="forever-tiles" style={{ maxWidth: 660, margin: '0 auto' }}>
            {tiles.map(t => (
              <div key={t.label} style={{ ...cardBase, padding: '16px 12px', background: 'var(--bg-secondary)' }}>
                <div style={{ fontSize: 'clamp(0.95rem, 4.2vw, 1.25rem)', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>{t.value}</div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.4 }}>{t.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div style={{ maxWidth: 1040, margin: '0 auto', padding: '56px 24px 64px' }}>
        {/* Sequences */}
        <section style={{ marginBottom: 56 }}>
          <SectionHeading eyebrow="On the site now" title="Forever sequences">
            {count === null
              ? 'Forever sequences are listed separately from retail, and you can browse them with the Game filter.'
              : count === 0
                ? 'There are no Forever sequences on the site yet. None has been validated on a Forever client, and that is the bar they have to clear before they are called validated here, the same as everywhere else on the site.'
                : `There ${count === 1 ? 'is 1 Forever sequence' : `are ${count} Forever sequences`} on the site, posted by the community. Every one of them is unvalidated until somebody runs it on a Forever client and says so, so read the notes on each before you lean on it.`}
          </SectionHeading>

          {forever && forever.sequences.length > 0 ? (
            <div className="forever-seq-grid" style={{ marginBottom: 18 }}>
              {forever.sequences.map(s => {
                const color = getClassColor(s.class_id)
                const author = authorName(s.author)
                return (
                  <Link
                    key={s.slug}
                    href={`/sequences/${s.slug}`}
                    prefetch={false}
                    className="forever-card"
                    style={{ ...cardBase, display: 'block', textDecoration: 'none', overflow: 'hidden', borderTop: `3px solid ${color}` }}
                  >
                    <div style={{ padding: '14px 16px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <span style={{ width: 9, height: 9, borderRadius: '50%', background: color, flexShrink: 0 }} />
                        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', fontWeight: 500 }}>
                          {s.class_name}{s.spec_name ? `, ${s.spec_name}` : ''}
                        </span>
                      </div>
                      <div style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3, marginBottom: 12 }}>{s.title}</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                        <span style={{ fontSize: 'var(--text-xs)', padding: '2px 8px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
                          {CONTENT_LABELS[s.content_type] ?? s.content_type}
                        </span>
                        {s.grip_version ? (
                          <span style={{ fontSize: 'var(--text-xs)', padding: '2px 8px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                            GRIP {s.grip_version}
                          </span>
                        ) : null}
                        <span style={{ fontSize: 'var(--text-xs)', padding: '2px 8px', borderRadius: 'var(--radius-sm)', color: STATUS_COLOR.untested, border: `0.5px solid ${STATUS_COLOR.untested}55`, background: `${STATUS_COLOR.untested}18` }}>
                          Unvalidated
                        </span>
                      </div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                        {author ? `by ${author} · ` : ''}posted {formatDistanceToNow(new Date(s.created_at), { addSuffix: true })}
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          ) : null}

          <p style={{ ...body, margin: 0 }}>
            <Link href="/browse?game_version=forever" style={link}>Browse every Forever sequence</Link>
            {' '}(the plain Browse page shows retail only).
          </p>
        </section>

        {/* How to get going */}
        <section style={{ marginBottom: 56 }}>
          <SectionHeading eyebrow="Get going" title="Four steps from retail habits to Forever" />
          <div className="forever-steps">
            {STEPS.map((s, i) => (
              <div key={s.title} style={{ ...cardBase, padding: '18px 18px 16px', background: 'var(--bg-secondary)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <span style={{ width: 28, height: 28, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'var(--accent-subtle)', border: '0.5px solid var(--accent)', color: 'var(--accent-text)', fontSize: 'var(--text-sm)', fontWeight: 700 }}>
                    {i + 1}
                  </span>
                  <span style={{ color: 'var(--text-muted)', display: 'inline-flex' }}>{s.icon}</span>
                </div>
                <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 6px' }}>{s.title}</h3>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>{s.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Timeline */}
        <section style={{ marginBottom: 56, maxWidth: 820 }}>
          <SectionHeading eyebrow="The road so far" title="From the beta to the raids">
            The game&apos;s dates and the addon&apos;s releases on one line, so you can see which fixes landed before or after the thing you&apos;re troubleshooting.
          </SectionHeading>
          <ol className="forever-tl">
            {FOREVER_TIMELINE.map((t, i) => {
              const done = daysUntil(t.date) <= 0
              const isNext = i === nextIdx
              const accent = t.kind === 'addon' ? 'var(--accent)' : '#8f86ff'
              const away = daysUntil(t.date)
              return (
                <li key={t.date + t.title} className="forever-tl-item">
                  <span
                    className="forever-tl-dot"
                    style={{
                      background: done ? accent : 'var(--bg-primary)',
                      border: `2px solid ${done ? accent : 'var(--border-strong)'}`,
                      boxShadow: isNext ? `0 0 0 4px ${accent}33` : 'none',
                    }}
                  />
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '2px 10px' }}>
                    <span style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{formatShortDate(t.date)}</span>
                    <span style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: done ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{t.title}</span>
                    <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: accent, textTransform: 'uppercase', letterSpacing: '.06em' }}>
                      {t.kind === 'addon' ? 'GRIP-EMS' : 'Game'}
                    </span>
                    {isNext ? (
                      <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--accent-text)' }}>Next, in {away} days</span>
                    ) : null}
                  </div>
                  <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.6, margin: '4px 0 0' }}>{t.detail}</p>
                </li>
              )
            })}
          </ol>
        </section>

        {/* Field notes */}
        <section style={{ marginBottom: 56, maxWidth: 820 }}>
          <SectionHeading eyebrow="Field notes" title="What has been observed">
            One entry per claim, with the date it was last confirmed and who it came from. Check the dates before you trust any of it as still current, because a Forever patch can change any of it.
          </SectionHeading>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
            {live.map(o => <ObservationCard key={o.id} o={o} />)}
          </div>
          {beta.length > 0 ? (
            <details style={{ ...cardBase, padding: '12px 16px' }}>
              <summary style={{ cursor: 'pointer', fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>
                Beta history ({beta.length})
              </summary>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', lineHeight: 1.6, margin: '10px 0 12px' }}>
                These are from before launch, so they describe the beta client and earlier addon releases and may no longer apply.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {beta.map(o => <ObservationCard key={o.id} o={o} />)}
              </div>
            </details>
          ) : null}
        </section>

        {/* Posting */}
        <section style={{ marginBottom: 56, maxWidth: 820 }}>
          <SectionHeading eyebrow="Contribute" title="Posting one" />
          <p style={{ ...body, margin: '0 0 12px' }}>
            Post it the way you post any sequence, then open it and set Game version to WoW: Forever. That control is only visible to you as the author, and until you set it the sequence is listed under retail. The post form still asks for a retail class and spec, because that is the model the site knows, and Forever may not fit it, so that part will change once it is measured and not before.
          </p>
        </section>

        {/* Closing call */}
        <section style={{ ...cardBase, background: 'var(--bg-secondary)', border: '0.5px solid var(--accent)', padding: '30px 28px', textAlign: 'center' }}>
          <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 10px' }}>Nobody has cleared the bar yet</h2>
          <p style={{ ...body, maxWidth: 600, margin: '0 auto 20px' }}>
            A sequence counts as validated here once somebody runs it on a Forever client, past a UI reload, and says so with a date. That&apos;s the whole test, and the first name on that list is still open.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 10 }}>
            <a href="https://discord.gg/UUdmCNUv" target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 20px', borderRadius: 'var(--radius-md)', background: 'var(--accent)', color: 'white', textDecoration: 'none', fontWeight: 600, fontSize: 'var(--text-base)' }}>
              <MessageCircle size={16} />
              Report a test in Discord
            </a>
            <Link href="/guide/wow-forever" style={{ display: 'inline-flex', alignItems: 'center', padding: '10px 20px', borderRadius: 'var(--radius-md)', border: '0.5px solid var(--border-strong)', color: 'var(--text-primary)', textDecoration: 'none', fontWeight: 500, fontSize: 'var(--text-base)' }}>
              Read the Forever guide
            </Link>
          </div>
        </section>
      </div>
    </div>
  )
}
