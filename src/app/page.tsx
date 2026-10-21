import Link from 'next/link'
import { ArrowRight, Wrench, Trophy, Crown, Eye, HelpCircle, PlusCircle } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { WOW_CLASSES, CONTENT_TYPES, getClassColor } from '@/lib/wow-data'
import { fetchHomeStats, fetchTrendingSequences, fetchRecentSequences, fetchCurrentPatchTicker, fetchTopCreators } from '@/lib/home-stats'
import { sanitizeAvatarUrl } from '@/lib/url-safety'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import StatBlock from '@/components/ui/StatBlock'
import SequenceMark from '@/components/ui/SequenceMark'
import ChangelogButton from '@/components/home/ChangelogButton'
import { EMS_RELEASES } from '@/lib/changelog/ems-archive'

// Rendered per request, like every page: the root layout needs a fresh CSP nonce on each
// response (see src/lib/csp.ts), so this page is no longer statically cached. The stat
// block and tickers read through the cookie-free public client, so a later unstable_cache
// around those queries is the way to put caching back if the traffic ever calls for it.

// Marks where a "what row is this" label card gets woven into a ticker. A symbol rather
// than a string/object literal so it can never collide with real sequence data.
const TICKER_LABEL = Symbol('ticker-label')

// Inserts a TICKER_LABEL marker every `every` real items — a label card dropped into the
// scroll periodically, like a radio station ID between songs, instead of pinned to one
// fixed spot. Always ends on a marker so the loop seam (this array gets duplicated for the
// seamless marquee trick) reads cleanly no matter how many items are in the list.
function withLabelCards<T>(items: T[], every: number): (T | typeof TICKER_LABEL)[] {
  if (items.length === 0) return []
  const out: (T | typeof TICKER_LABEL)[] = []
  items.forEach((item, i) => {
    out.push(item)
    if ((i + 1) % every === 0) out.push(TICKER_LABEL)
  })
  if (out[out.length - 1] !== TICKER_LABEL) out.push(TICKER_LABEL)
  return out
}

// The eye icon sits on every ticker card and every leaderboard row, 31 times on one render.
// Built once here, it is one element object reused everywhere, and Flight writes an element
// it has already written as a back-reference, so the payload carries one <svg> per size
// instead of 31 (#107).
const EYE_TICKER = <Eye size={11} />
const EYE_ROW = <Eye size={12} />

export default async function HomePage() {
  const [stats, trending, currentPatchTicker, topCreators] = await Promise.all([
    fetchHomeStats(),
    fetchTrendingSequences(6),
    fetchCurrentPatchTicker(10),
    fetchTopCreators(5),
  ])
  // Previous-patches row excludes whatever the current-patch row already shows, so the
  // two tickers never surface the same sequence twice.
  const recent = await fetchRecentSequences(14, currentPatchTicker.patch)

  // Each ticker's cards are built once, and that one array is rendered into both batches of
  // the seamless loop. The HTML still carries both copies, which the loop's -50% scroll
  // needs, but Flight writes the array once and the second batch as a back-reference (#107).
  const currentPatchCards = withLabelCards(currentPatchTicker.sequences, 8).map((item, i) => {
    if (item === TICKER_LABEL) {
      return (
        <div key={`cp-label-${i}`} className="home-cp-label">
          <span className="home-cp-label-dot" />
          <span className="home-cp-label-text">
            Current Patch {currentPatchTicker.patch} Sequences
          </span>
        </div>
      )
    }
    const seq = item
    const classColor = getClassColor(seq.class_id)
    return (
      <Link
        key={`cp-${seq.id}-${i}`}
        href={`/sequences/${seq.slug}`}
        className="home-cp-card"
        style={{ borderLeft: `3px solid ${classColor}` }}
        prefetch={false}>
        <span className="home-cp-title">
          {seq.title}
        </span>
        <span className="home-cp-meta">
          <span className="home-cp-who">
            <Badge color={classColor} style={{ color: 'var(--text-primary)' }}>{seq.class_name}</Badge>
            <span className="home-author">
              {seq.author?.display_name || seq.author?.username || 'Unknown'}
            </span>
          </span>
          <span className="home-cp-views">
            {EYE_TICKER}
            <span className="home-cp-count">{seq.view_count?.toLocaleString() ?? 0}</span>
          </span>
        </span>
      </Link>
    )
  })

  const recentCards = withLabelCards(recent, 10).map((item, i) => {
    if (item === TICKER_LABEL) {
      return (
        <div key={`pp-label-${i}`} className="home-pp-label">
          <span className="home-pp-label-dot" />
          <span className="home-pp-label-text">
            Previous Patch Sequences
          </span>
        </div>
      )
    }
    const seq = item
    return (
      <Link
        key={`pp-${seq.id}-${i}`}
        href={`/sequences/${seq.slug}`}
        className="home-pp-card"
        prefetch={false}>
        <span className="home-pp-dot" style={{ background: getClassColor(seq.class_id) }} />
        <span className="home-pp-title">{seq.title}</span>
        <span className="home-pp-meta">· {seq.class_name}</span>
        <span className="home-pp-meta">· {formatDistanceToNow(new Date(seq.created_at), { addSuffix: true })}</span>
      </Link>
    )
  })

  return (
    <div>
      {/* Hero — kept deliberately short: one screen, no scroll needed to see the CTA and the
          proof numbers together. Reordered from a nav-like utility bar sitting above an
          undersized mark to a conventional mark → headline → pitch → actions → proof stack
          (mirrors how Linear and Raycast build a hero: one bold focal element, then a single
          top-to-bottom read), so the section reads as one composed block instead of
          independently floating pieces. */}
      <section
        className="bg-hero"
        style={{
          background: 'var(--bg-primary)',
          borderBottom: '0.5px solid var(--border)',
          padding: '52px 24px 56px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={{ maxWidth: 760, margin: '0 auto', textAlign: 'center', position: 'relative' }}>
          {/* Mark — the site's one true visual anchor. Bigger, with a layered two-ring glow
              (a wide soft field plus a tighter, brighter core, the way Raycast backs its
              headline with a bold graphic rather than a small logo) instead of a single
              faint blur, so it actually holds the top of the composition. */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div
                aria-hidden
                style={{
                  position: 'absolute',
                  width: 280, height: 280,
                  borderRadius: '50%',
                  background: 'radial-gradient(circle, var(--accent-subtle) 0%, transparent 70%)',
                }}
              />
              <div
                aria-hidden
                style={{
                  position: 'absolute',
                  width: 160, height: 160,
                  borderRadius: '50%',
                  background: 'radial-gradient(circle, rgba(29,158,117,0.4) 0%, transparent 72%)',
                }}
              />
              <SequenceMark size={112} />
            </div>
          </div>

          <h1
            className="hero-heading"
            style={{
              fontSize: 'var(--text-4xl)',
              fontWeight: 700,
              letterSpacing: '-0.03em',
              lineHeight: 1.08,
              marginBottom: 16,
              color: 'var(--text-primary)',
            }}
          >
            You blacked out.
            <br />
            <span style={{ color: 'var(--accent)' }}>Your rotation didn&apos;t.</span>
          </h1>

          <p
            style={{
              fontSize: 'var(--text-base)',
              color: 'var(--text-secondary)',
              lineHeight: 1.5,
              maxWidth: 460,
              margin: '0 auto 20px',
            }}
          >
            Your brain lags under pressure, but your macro won&apos;t. Because &quot;I panicked&quot;
            isn&apos;t a strategy.
          </p>

          {/* Product anchor — the headline and pitch above never actually say what this is.
              A short, punchy motto needs something concrete to land on, so this names the
              real system (GRIP-EMS) and what the site is right before the CTAs. Deliberately
              plain text, no pill chrome — a bordered badge here reads as a fourth button next
              to the three real CTAs below; this needs to read as a label/statement instead. */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, marginBottom: 36 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-2xl)', fontWeight: 700, color: 'var(--accent)', letterSpacing: '0.02em', lineHeight: 1 }}>
              GRIP-EMS
            </span>
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
              sequence library for World of Warcraft
            </span>
          </div>

          {/* Action row — three entry points into the site as CTAs directly under the pitch,
              not a nav-like bar floating above the mark. Same hover-tooltip mechanic as
              before, same order (Why GRIP-EMS? → Build in browser → Post your sequence),
              just tightened into a centered cluster instead of spread edge-to-edge. */}
          <div className="utility-bar" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 40, position: 'relative' }}>
            <div className="info-trigger info-trigger-left">
              <Link
                href="/guide"
                className="info-trigger-link"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 10,
                  background: 'var(--bg-tertiary)', border: '0.5px solid var(--border-strong)',
                  borderRadius: 99, padding: '8px 16px 8px 8px',
                  fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)',
                  textDecoration: 'none', transition: 'border-color 0.15s',
                }}
               prefetch={false}>
                <span style={{
                  width: 26, height: 26, borderRadius: '50%', background: 'var(--accent-subtle)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', flexShrink: 0,
                }}>
                  <HelpCircle size={15} />
                </span>
                Why GRIP-EMS?
              </Link>
              <div className="info-tooltip">
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
                  Because a sequence is only as good as the structure behind it. You get loop
                  blocks, priority and reverse-priority weighting, per-step intervals so a cooldown
                  gets tried every fourth press instead of every press, conditionals evaluated on
                  the line, and variables you can reuse across sequences. All of it is free — no
                  supporter tier, nothing behind a payment.
                </p>
                <Link href="/guide" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 10, fontSize: 'var(--text-xs)', color: 'var(--accent)', fontWeight: 500, textDecoration: 'none' }} prefetch={false}>
                  Read the guide <ArrowRight size={11} />
                </Link>
              </div>
            </div>

            <div className="info-trigger info-trigger-center">
              <Link
                href="/workshop"
                className="info-trigger-link"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 10,
                  background: 'var(--bg-tertiary)', border: '0.5px solid var(--border-strong)',
                  borderRadius: 99, padding: '8px 16px 8px 8px',
                  fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)',
                  textDecoration: 'none', transition: 'border-color 0.15s',
                }}
               prefetch={false}>
                <span style={{
                  width: 26, height: 26, borderRadius: '50%', background: 'var(--accent-subtle)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', flexShrink: 0,
                }}>
                  <Wrench size={14} />
                </span>
                Build GRIP sequences in the browser
              </Link>
              <div className="info-tooltip">
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0, marginBottom: 10 }}>
                  The Workshop is a full sequence builder in the browser. Create collections with
                  multiple sequences and versions, add loops, if branches, and pause blocks, set
                  keypress macros, and export a ready-to-import GRIP string without ever opening
                  the addon.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
                  {[
                    'Spell autocomplete by class',
                    'Drag and drop reordering',
                    'Spell ID conversion',
                  ].map(feature => (
                    <span key={feature} style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ color: 'var(--accent)', fontSize: 12 }}>&#10003;</span> {feature}
                    </span>
                  ))}
                </div>
                <Link href="/workshop" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 'var(--text-xs)', color: 'var(--accent)', fontWeight: 500, textDecoration: 'none' }} prefetch={false}>
                  Open Workshop <ArrowRight size={11} />
                </Link>
              </div>
            </div>

            <div className="info-trigger info-trigger-right">
              <Link
                href="/auth/signup"
                className="info-trigger-link"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 10,
                  background: 'var(--bg-tertiary)', border: '0.5px solid var(--border-strong)',
                  borderRadius: 99, padding: '8px 16px 8px 8px',
                  fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)',
                  textDecoration: 'none', transition: 'border-color 0.15s',
                }}
               prefetch={false}>
                <span style={{
                  width: 26, height: 26, borderRadius: '50%', background: 'var(--accent-subtle)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', flexShrink: 0,
                }}>
                  <PlusCircle size={14} />
                </span>
                Post your sequence
              </Link>
              <div className="info-tooltip">
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0, marginBottom: 10 }}>
                  Create a free account, paste your GRIP export string, fill in your class and
                  spec, and it goes live on the site. Takes about a minute, and there&apos;s no
                  paid tier to unlock.
                </p>
                <Link href="/auth/signup" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 'var(--text-xs)', color: 'var(--accent)', fontWeight: 500, textDecoration: 'none' }} prefetch={false}>
                  Create an account <ArrowRight size={11} />
                </Link>
              </div>
            </div>
          </div>

          {stats && (
            <div className="hero-stats" style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
              <StatBlock
                stats={[
                  { value: String(stats.sequenceCount), label: 'Sequences' },
                  { value: `${stats.classCount}/13`, label: 'Classes covered' },
                  { value: String(stats.memberCount), label: 'Members' },
                  { value: stats.viewCount.toLocaleString(), label: 'Views' },
                ]}
              />
            </div>
          )}

          {/* Current GRIP-EMS version — used to only live in the guide sidebar, which meant
              a first-time visitor had no way to know it without digging into docs. This is
              exactly the kind of "proof the site is maintained" detail that belongs up front. */}
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: 10 }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '5px 12px',
              borderRadius: 99,
              background: 'var(--bg-tertiary)',
              border: '0.5px solid var(--border-strong)',
            }}>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Current version</span>
              <Link prefetch={false} href="/guide/ems-changelog" style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--accent)', fontFamily: 'var(--font-mono)', textDecoration: 'none' }}>GRIP-EMS v2.4.21</Link>
            </div>
            {/* Keyed on the newest release in the changelog archive, not on the version string
                above, so it only says New when there is actually a new changelog to read. */}
            <ChangelogButton latest={EMS_RELEASES[0].version} />
          </div>
        </div>
      </section>

      {/* Activity tickers — two staggered infinite CSS marquees, no client JS. Pattern
          borrowed from Modrinth's front page, which runs multiple rows of content
          scrolling in opposite directions at different speeds rather than one flat strip.
          Row 1 is current-patch sequences in bigger cards (the stuff most visitors actually
          want right now); row 2 is everything else, in the original thin ticker style. A
          label card (built with withLabelCards, defined below the component) is woven into
          the flow every 8-10 real cards to announce what the row is, instead of a fixed
          floating label — that read as a "tunnel" the cards disappeared behind, which
          didn't work. Each row omits itself independently if it has nothing to show. */}
      {(currentPatchTicker.sequences.length > 0 || recent.length > 0) && (
        <section className="home-ticker" style={{ borderBottom: '0.5px solid var(--border)', background: 'var(--bg-secondary)' }}>
          {currentPatchTicker.sequences.length > 0 && (
            <div style={{ overflow: 'hidden', borderBottom: recent.length > 0 ? '0.5px solid var(--border)' : 'none' }}>
              <div style={{ display: 'flex', width: 'max-content', padding: '10px 0' }} className="marquee-track">
                {[0, 1].map(batchIdx => (
                  <div key={batchIdx} className="home-tick-batch">
                    {currentPatchCards}
                  </div>
                ))}
              </div>
            </div>
          )}

          {recent.length > 0 && (
            <div style={{ overflow: 'hidden' }}>
              <div style={{ display: 'flex', width: 'max-content', padding: '9px 0' }} className="marquee-track-reverse">
                {[0, 1].map(batchIdx => (
                  <div key={batchIdx} className="home-tick-batch">
                    {recentCards}
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Explore — leaderboard, browse-by-class, and browse-by-content as three columns in
          one section instead of three separate full-width stops. This is the actual "well
          organized, easy to navigate" part of the page: everything you'd want to do next is
          visible at once, side by side, rather than a long stack you scroll through in order. */}
      <section style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 24px' }}>
        <div className="explore-grid">
          {/* Top Creators -- ranked by fetchTopCreators (summed view_count across a
              creator's published sequences, same metric "Top sequences" ranks by).
              Sits to the left of Top sequences per Slowdog's annotated screenshot
              (2026-09-10) marking that spot for it. Links to the /creators directory
              and each row links straight to that creator's public /user/[username]
              page. */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Crown size={16} color="var(--accent)" />
                <h2 style={{ fontSize: 18, fontWeight: 500, letterSpacing: '-0.01em' }}>Top Creators</h2>
              </div>
              <Link href="/creators" style={{ fontSize: 'var(--text-sm)', color: 'var(--accent)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }} prefetch={false}>
                View all <ArrowRight size={13} />
              </Link>
            </div>

            {topCreators.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {topCreators.map((creator, i) => {
                  const safeAvatarUrl = sanitizeAvatarUrl(creator.avatar_url)
                  const displayColor = creator.avatar_color ?? '#1D9E75'
                  const initial = creator.username[0]?.toUpperCase() ?? '?'
                  return (
                    <Link key={creator.id} href={`/user/${creator.username}`} className="home-lb-link" prefetch={false}>
                      <Card padding="sm" className="home-creator-row">
                        <span className={i < 3 ? 'home-lb-rank home-lb-rank-top' : 'home-lb-rank'}>
                          {i + 1}
                        </span>

                        <div className="home-lb-avatar" style={{ background: safeAvatarUrl ? 'transparent' : displayColor }}>
                          {safeAvatarUrl
                            ? <img src={safeAvatarUrl} alt={creator.username} className="home-lb-avatar-img" />
                            : initial
                          }
                        </div>

                        <div className="home-lb-body">
                          <div className="home-lb-name">
                            {creator.display_name || creator.username}
                          </div>
                          <div className="home-lb-sub">
                            {creator.sequenceCount} sequence{creator.sequenceCount !== 1 ? 's' : ''}
                          </div>
                        </div>

                        <div className="home-lb-views">
                          {EYE_ROW}
                          <span className="home-lb-count">
                            {creator.totalViews.toLocaleString()}
                          </span>
                        </div>
                      </Card>
                    </Link>
                  )
                })}
              </div>
            ) : (
              <Card padding="sm" style={{ textAlign: 'center' }}>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>No creators yet — be the first to post a sequence.</p>
              </Card>
            )}
          </div>

          {/* Top sequences */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Trophy size={16} color="var(--accent)" />
                <h2 style={{ fontSize: 18, fontWeight: 500, letterSpacing: '-0.01em' }}>Top sequences</h2>
              </div>
              <Link href="/browse?sort=most_viewed" style={{ fontSize: 'var(--text-sm)', color: 'var(--accent)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }} prefetch={false}>
                View all <ArrowRight size={13} />
              </Link>
            </div>

            {trending.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {trending.map((seq, i) => {
                  const classColor = getClassColor(seq.class_id)
                  return (
                    <Link key={seq.id} href={`/sequences/${seq.slug}`} className="home-lb-link" prefetch={false}>
                      <Card accentColor={classColor} padding="sm" className="home-seq-row">
                        <span className={i < 3 ? 'home-lb-rank home-lb-rank-top' : 'home-lb-rank'}>
                          {i + 1}
                        </span>

                        <div className="home-lb-body">
                          <div className="home-lb-title">
                            {seq.title}
                          </div>
                          <div className="home-lb-meta">
                            <Badge color={classColor} style={{ color: 'var(--text-primary)' }}>{seq.class_name}</Badge>
                            <span className="home-author">
                              {seq.author?.display_name || seq.author?.username || 'Unknown'}
                            </span>
                          </div>
                        </div>

                        <div className="home-lb-views">
                          {EYE_ROW}
                          <span className="home-lb-count">
                            {seq.view_count?.toLocaleString() ?? 0}
                          </span>
                        </div>
                      </Card>
                    </Link>
                  )
                })}
              </div>
            ) : (
              <Card padding="sm" style={{ textAlign: 'center' }}>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>No sequences yet — be the first to post one.</p>
              </Card>
            )}
          </div>

          {/* Browse — class and content-type together in one column, gridded (not
              ragged flex-wrap) so it reads as one tidy block next to the leaderboard
              instead of a loose wall of pills. Left border + padding gives it real
              separation from the leaderboard rather than the two blocks touching. */}
          <div className="browse-divider" style={{ borderLeft: '0.5px solid var(--border)', paddingLeft: 32 }}>
            <h2 style={{ fontSize: 18, fontWeight: 500, letterSpacing: '-0.01em', marginBottom: 16 }}>Browse Sequences</h2>

            <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' as const, letterSpacing: '.06em', marginBottom: 10 }}>
              By class <span className="spec-hint" style={{ textTransform: 'none' as const, fontWeight: 400, color: 'var(--text-muted)' }}>- hover for specs</span>
            </div>
            <div className="browse-chip-grid" style={{ marginBottom: 24 }}>
              {WOW_CLASSES.map((cls, i) => (
                <div key={cls.id} className={`spec-trigger ${i % 2 === 0 ? 'spec-trigger-l' : 'spec-trigger-r'}`}>
                  <Link
                    href={`/browse/${cls.slug}`}
                    className="home-class-chip"
                    style={{ background: `${cls.color}14`, border: `0.5px solid ${cls.color}45` }}
                   prefetch={false}>
                    <span className="home-class-dot" style={{ background: cls.color }} />
                    <span className="home-class-name">{cls.name}</span>
                  </Link>
                  <div className="spec-tooltip">
                    {cls.specs.map(spec => (
                      <Link key={spec.id} href={`/browse/${cls.slug}?spec_id=${spec.id}`} className="spec-link" prefetch={false}>
                        {spec.name}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' as const, letterSpacing: '.06em', marginBottom: 10 }}>
              By content
            </div>
            <div className="browse-chip-grid">
              {CONTENT_TYPES.map(ct => (
                <Link
                  key={ct.slug}
                  href={`/browse/${ct.slug}`}
                  className="home-content-chip"
                 prefetch={false}>
                  {ct.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
