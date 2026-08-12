import { ArrowRight, Wrench, Trophy, Eye, HelpCircle, PlusCircle } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { WOW_CLASSES, CONTENT_TYPES, getClassColor } from '@/lib/wow-data'
import { fetchHomeStats, fetchTrendingSequences, fetchRecentSequences, fetchCurrentPatchTicker } from '@/lib/home-stats'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import StatBlock from '@/components/ui/StatBlock'
import SequenceMark from '@/components/ui/SequenceMark'

// Homepage is otherwise static (no cookies/headers touched — see public.ts), so without this
// it builds once and the stat block numbers freeze until the next deploy. 30m (shorter than
// the 1h window changelog uses elsewhere) so the patch-12.1 ticker picks up new posts sooner.
export const revalidate = 1800

export default async function HomePage() {
  const [stats, trending, currentPatchTicker] = await Promise.all([
    fetchHomeStats(),
    fetchTrendingSequences(6),
    fetchCurrentPatchTicker(10),
  ])
  // Previous-patches row excludes whatever the current-patch row already shows, so the
  // two tickers never surface the same sequence twice.
  const recent = await fetchRecentSequences(14, currentPatchTicker.patch)

  return (
    <div>
      <style>{`
        .info-trigger { position: relative; display: inline-block; }
        .info-trigger .info-tooltip {
          position: absolute;
          top: calc(100% + 10px);
          width: 320px;
          max-width: 82vw;
          background: var(--bg-primary);
          border: 0.5px solid var(--border-strong);
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow-md);
          padding: 16px;
          opacity: 0;
          visibility: hidden;
          pointer-events: none;
          transform: translateY(-4px);
          transition: opacity 0.15s, transform 0.15s;
          z-index: 60;
          text-align: left;
        }
        /* Invisible bridge over the 10px gap above the tooltip. Without this, that gap is a
           dead zone: it belongs to neither the pill nor the tooltip, so a mouse crossing it
           drops :hover for a frame, pointer-events snaps back to none, and the tooltip closes
           before the cursor ever reaches the link inside it. This keeps the hover area
           unbroken from the pill straight through to the card. */
        .info-trigger .info-tooltip::before {
          content: '';
          position: absolute;
          top: -10px;
          left: 0;
          right: 0;
          height: 10px;
        }
        .info-trigger:hover .info-tooltip,
        .info-trigger:focus-within .info-tooltip {
          opacity: 1;
          visibility: visible;
          pointer-events: auto;
          transform: translateY(0);
        }
        .info-trigger-left .info-tooltip { left: 0; }
        .info-trigger-right .info-tooltip { right: 0; }
        .info-trigger-center .info-tooltip { left: 50%; transform: translateX(-50%) translateY(-4px); }
        .info-trigger-center:hover .info-tooltip,
        .info-trigger-center:focus-within .info-tooltip { transform: translateX(-50%) translateY(0); }
        .info-trigger-link:hover { border-color: var(--accent) !important; background: var(--bg-secondary) !important; }
        .explore-grid { display: grid; grid-template-columns: 1.5fr 1fr; gap: 32px; }
        .browse-chip-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }

        /* Spec tooltip — hover a class chip, see its specs, click one straight to that
           filtered browse view. Flies out to the side of the chip (vertically centered)
           rather than dropping below it, so it never covers the next row of chips. Left-
           column chips open leftward, right-column chips open rightward — outward, away
           from the other column, instead of the two columns' tooltips landing on each other. */
        .spec-trigger { position: relative; }
        .spec-trigger .spec-tooltip {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          min-width: 170px;
          max-width: 60vw;
          background: var(--bg-primary);
          border: 0.5px solid var(--border-strong);
          border-radius: var(--radius-md);
          box-shadow: var(--shadow-md);
          padding: 6px;
          opacity: 0;
          visibility: hidden;
          pointer-events: none;
          transition: opacity 0.12s;
          z-index: 70;
        }
        /* Opens outward, away from the other column — left-column chips fly out to the left
           (toward the leaderboard side), right-column chips fly out to the right (toward the
           page edge). Previous version had these backwards, opening inward onto each other. */
        .spec-trigger-l .spec-tooltip { right: calc(100% - 20px); }
        .spec-trigger-r .spec-tooltip { left: calc(100% - 20px); }
        .spec-trigger:hover .spec-tooltip,
        .spec-trigger:focus-within .spec-tooltip {
          opacity: 1;
          visibility: visible;
          pointer-events: auto;
        }
        .spec-link {
          display: block;
          padding: 6px 8px;
          border-radius: var(--radius-sm);
          font-size: var(--text-sm);
          color: var(--text-secondary);
          text-decoration: none;
          white-space: nowrap;
        }
        .spec-link:hover { background: var(--bg-tertiary); color: var(--text-primary); }

        @media (max-width: 640px) {
          .hero-heading { font-size: 32px !important; letter-spacing: -0.02em !important; }
          .hero-stats { justify-content: center !important; }
          .class-chip-row { justify-content: center !important; }
          .utility-bar { flex-direction: column; align-items: center; gap: 14px; }
          .info-tooltip { left: 50% !important; right: auto !important; transform: translateX(-50%) translateY(-4px) !important; width: 280px; }
          .info-trigger:hover .info-tooltip, .info-trigger:focus-within .info-tooltip { transform: translateX(-50%) translateY(0) !important; }
          .explore-grid { grid-template-columns: 1fr !important; gap: 40px !important; }
          .browse-divider { border-left: none !important; padding-left: 0 !important; border-top: 0.5px solid var(--border); padding-top: 32px !important; }
        }
      `}</style>

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
              <a
                href="/guide"
                className="info-trigger-link"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 10,
                  background: 'var(--bg-tertiary)', border: '0.5px solid var(--border-strong)',
                  borderRadius: 99, padding: '8px 16px 8px 8px',
                  fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)',
                  textDecoration: 'none', transition: 'border-color 0.15s',
                }}
              >
                <span style={{
                  width: 26, height: 26, borderRadius: '50%', background: 'var(--accent-subtle)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', flexShrink: 0,
                }}>
                  <HelpCircle size={15} />
                </span>
                Why GRIP-EMS?
              </a>
              <div className="info-tooltip">
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
                  Because a sequence is only as good as the structure behind it. You get loop
                  blocks, priority and reverse-priority weighting, per-step intervals so a cooldown
                  gets tried every fourth press instead of every press, conditionals evaluated on
                  the line, and variables you can reuse across sequences. All of it is free — no
                  supporter tier, nothing behind a payment.
                </p>
                <a href="/guide" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 10, fontSize: 'var(--text-xs)', color: 'var(--accent)', fontWeight: 500, textDecoration: 'none' }}>
                  Read the guide <ArrowRight size={11} />
                </a>
              </div>
            </div>

            <div className="info-trigger info-trigger-center">
              <a
                href="/workshop"
                className="info-trigger-link"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 10,
                  background: 'var(--bg-tertiary)', border: '0.5px solid var(--border-strong)',
                  borderRadius: 99, padding: '8px 16px 8px 8px',
                  fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)',
                  textDecoration: 'none', transition: 'border-color 0.15s',
                }}
              >
                <span style={{
                  width: 26, height: 26, borderRadius: '50%', background: 'var(--accent-subtle)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', flexShrink: 0,
                }}>
                  <Wrench size={14} />
                </span>
                Build GRIP sequences in the browser
              </a>
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
                      <span style={{ color: 'var(--accent)', fontSize: 10 }}>&#10003;</span> {feature}
                    </span>
                  ))}
                </div>
                <a href="/workshop" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 'var(--text-xs)', color: 'var(--accent)', fontWeight: 500, textDecoration: 'none' }}>
                  Open Workshop <ArrowRight size={11} />
                </a>
              </div>
            </div>

            <div className="info-trigger info-trigger-right">
              <a
                href="/auth/signup"
                className="info-trigger-link"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 10,
                  background: 'var(--bg-tertiary)', border: '0.5px solid var(--border-strong)',
                  borderRadius: 99, padding: '8px 16px 8px 8px',
                  fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)',
                  textDecoration: 'none', transition: 'border-color 0.15s',
                }}
              >
                <span style={{
                  width: 26, height: 26, borderRadius: '50%', background: 'var(--accent-subtle)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', flexShrink: 0,
                }}>
                  <PlusCircle size={14} />
                </span>
                Post your sequence
              </a>
              <div className="info-tooltip">
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0, marginBottom: 10 }}>
                  Create a free account, paste your GRIP export string, fill in your class and
                  spec, and it goes live on the site. Takes about a minute, and there&apos;s no
                  paid tier to unlock.
                </p>
                <a href="/auth/signup" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 'var(--text-xs)', color: 'var(--accent)', fontWeight: 500, textDecoration: 'none' }}>
                  Create an account <ArrowRight size={11} />
                </a>
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
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '5px 12px',
            borderRadius: 99,
            background: 'var(--bg-tertiary)',
            border: '0.5px solid var(--border-strong)',
          }}>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Current version</span>
            <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>GRIP-EMS v2.3.19</span>
          </div>
        </div>
      </section>

      {/* Activity tickers — two staggered infinite CSS marquees, no client JS. Pattern
          borrowed from Modrinth's front page, which runs multiple rows of content
          scrolling in opposite directions at different speeds rather than one flat strip.
          Row 1 is current-patch sequences in bigger cards (the stuff most visitors actually
          want right now); row 2 is everything else, in the original thin ticker style.
          Each row omits itself independently if it has nothing to show. */}
      {(currentPatchTicker.sequences.length > 0 || recent.length > 0) && (
        <section style={{ borderBottom: '0.5px solid var(--border)', background: 'var(--bg-secondary)' }}>
          {currentPatchTicker.sequences.length > 0 && (
            <div style={{ position: 'relative', overflow: 'hidden', borderBottom: recent.length > 0 ? '0.5px solid var(--border)' : 'none' }}>
              {/* Label floats centered over the track instead of sitting in a fixed side
                  rail — cards scroll the full row width and pass underneath/behind it, so
                  it reads as a "tunnel" the ticker runs through rather than a label bolted
                  to one edge. Cards on either side stay clickable since the label only
                  covers the middle sliver. */}
              <div style={{
                position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
                zIndex: 2, display: 'flex', alignItems: 'center', gap: 8,
                padding: '9px 18px', borderRadius: 99, whiteSpace: 'nowrap',
                background: 'var(--accent-subtle)', border: '0.5px solid rgba(29,158,117,0.35)',
                boxShadow: 'var(--shadow-md)', pointerEvents: 'none',
              }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />
                <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--accent-text)' }}>
                  Current Patch {currentPatchTicker.patch}
                </span>
              </div>
              <div style={{ overflow: 'hidden' }}>
                <div style={{ display: 'flex', width: 'max-content', padding: '10px 0' }} className="marquee-track">
                  {[currentPatchTicker.sequences, currentPatchTicker.sequences].map((batch, batchIdx) => (
                    <div key={batchIdx} style={{ display: 'flex', flexShrink: 0 }}>
                      {batch.map((seq, i) => {
                        const classColor = getClassColor(seq.class_id)
                        return (
                          <a
                            key={`cp-${batchIdx}-${seq.id}-${i}`}
                            href={`/sequences/${seq.slug}`}
                            style={{
                              display: 'flex', flexDirection: 'column', gap: 5,
                              padding: '8px 14px', margin: '0 6px', width: 230, flexShrink: 0,
                              background: 'var(--bg-primary)', border: '0.5px solid var(--border-strong)',
                              borderLeft: `3px solid ${classColor}`, borderRadius: 'var(--radius-sm)',
                              textDecoration: 'none',
                            }}
                          >
                            <span style={{
                              fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)',
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}>
                              {seq.title}
                            </span>
                            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                              <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                                <Badge color={classColor} style={{ color: 'var(--text-primary)' }}>{seq.class_name}</Badge>
                                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {seq.author?.display_name || seq.author?.username || 'Unknown'}
                                </span>
                              </span>
                              <span style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0, color: 'var(--text-muted)' }}>
                                <Eye size={11} />
                                <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600 }}>{seq.view_count?.toLocaleString() ?? 0}</span>
                              </span>
                            </span>
                          </a>
                        )
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {recent.length > 0 && (
            <div style={{ position: 'relative', overflow: 'hidden' }}>
              <div style={{
                position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
                zIndex: 2, display: 'flex', alignItems: 'center', gap: 7,
                padding: '7px 16px', borderRadius: 99, whiteSpace: 'nowrap',
                background: 'var(--bg-tertiary)', border: '0.5px solid var(--border-strong)',
                boxShadow: 'var(--shadow-md)', pointerEvents: 'none',
              }}>
                <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                  Previous patches
                </span>
              </div>
              <div style={{ overflow: 'hidden' }}>
                <div style={{ display: 'flex', width: 'max-content', padding: '9px 0' }} className="marquee-track-reverse">
                  {[recent, recent].map((batch, batchIdx) => (
                    <div key={batchIdx} style={{ display: 'flex', flexShrink: 0 }}>
                      {batch.map((seq, i) => (
                        <a
                          key={`pp-${batchIdx}-${seq.id}-${i}`}
                          href={`/sequences/${seq.slug}`}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '8px 14px', margin: '0 6px', flexShrink: 0,
                            background: 'var(--bg-primary)', border: '0.5px solid var(--border-strong)',
                            borderRadius: 'var(--radius-sm)',
                            textDecoration: 'none', whiteSpace: 'nowrap',
                          }}
                        >
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: getClassColor(seq.class_id), flexShrink: 0 }} />
                          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)', fontWeight: 500 }}>{seq.title}</span>
                          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>· {seq.class_name}</span>
                          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>· {formatDistanceToNow(new Date(seq.created_at), { addSuffix: true })}</span>
                        </a>
                      ))}
                    </div>
                  ))}
                </div>
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
          {/* Top sequences */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Trophy size={16} color="var(--accent)" />
                <h2 style={{ fontSize: 18, fontWeight: 500, letterSpacing: '-0.01em' }}>Top sequences</h2>
              </div>
              <a href="/browse?sort=most_viewed" style={{ fontSize: 'var(--text-sm)', color: 'var(--accent)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                View all <ArrowRight size={13} />
              </a>
            </div>

            {trending.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {trending.map((seq, i) => {
                  const classColor = getClassColor(seq.class_id)
                  return (
                    <a key={seq.id} href={`/sequences/${seq.slug}`} style={{ textDecoration: 'none' }}>
                      <Card accentColor={classColor} padding="sm" style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                        <span style={{
                          width: 18, fontSize: 'var(--text-sm)', fontWeight: 700,
                          color: i < 3 ? 'var(--accent)' : 'var(--text-muted)', flexShrink: 0, textAlign: 'center',
                        }}>
                          {i + 1}
                        </span>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--text-primary)',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 3,
                          }}>
                            {seq.title}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Badge color={classColor} style={{ color: 'var(--text-primary)' }}>{seq.class_name}</Badge>
                            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {seq.author?.display_name || seq.author?.username || 'Unknown'}
                            </span>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, color: 'var(--text-muted)' }}>
                          <Eye size={12} />
                          <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)' }}>
                            {seq.view_count?.toLocaleString() ?? 0}
                          </span>
                        </div>
                      </Card>
                    </a>
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
              By class <span style={{ textTransform: 'none' as const, fontWeight: 400, color: 'var(--text-muted)' }}>— hover for specs</span>
            </div>
            <div className="browse-chip-grid" style={{ marginBottom: 24 }}>
              {WOW_CLASSES.map((cls, i) => (
                <div key={cls.id} className={`spec-trigger ${i % 2 === 0 ? 'spec-trigger-l' : 'spec-trigger-r'}`}>
                  <a
                    href={`/browse/${cls.slug}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 7,
                      padding: '7px 12px',
                      borderRadius: 99,
                      textDecoration: 'none',
                      background: `${cls.color}14`,
                      border: `0.5px solid ${cls.color}45`,
                      transition: 'background-color 0.15s, border-color 0.15s',
                      overflow: 'hidden',
                    }}
                  >
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: cls.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cls.name}</span>
                  </a>
                  <div className="spec-tooltip">
                    {cls.specs.map(spec => (
                      <a key={spec.id} href={`/browse/${cls.slug}?spec_id=${spec.id}`} className="spec-link">
                        {spec.name}
                      </a>
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
                <a
                  key={ct.slug}
                  href={`/browse/${ct.slug}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '7px 12px',
                    borderRadius: 99,
                    textDecoration: 'none',
                    background: 'var(--bg-tertiary)',
                    border: '0.5px solid var(--border-strong)',
                    color: 'var(--text-primary)',
                    fontSize: 'var(--text-sm)',
                    fontWeight: 500,
                  }}
                >
                  {ct.label}
                </a>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
