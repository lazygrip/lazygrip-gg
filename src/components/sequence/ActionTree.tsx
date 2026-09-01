// Renders a decoded GRIP action tree (Loop / Step / If / Repeat / Pause / Embed
// nodes) as nested, labeled blocks instead of a flat numbered list.
//
// Previously this rendering logic lived only inline in
// src/app/workshop/decode/page.tsx. The public sequence page
// (SequencePageClient.tsx) never had it at all -- it rendered from the flat
// `steps` array, which has no loop/repeat information once a sequence's
// actions tree is decoded, so a Loop with Repeat > 1 rendered as one flat,
// unlabeled pass through its children. Extracted here so both places share
// one implementation instead of drifting.
//
// ActionNode itself lives in src/types/index.ts, not here. It used to be
// redeclared in this file as a second, separately-maintained copy -- which is
// exactly the kind of duplication that let the kind-naming bug below happen
// silently in one copy and not the other. Import it, don't redeclare it.
//
// KIND NAMING, CORRECTED 2026-09-02. The two decoders that produce this tree
// don't agree on what to call a leaf action node: src/lib/workshop/
// emsDecoder.ts (native !EMS1!/!GRIP1! format, the one src/app/post/page.tsx
// and src/app/sequences/[slug]/update/page.tsx actually decode through via
// /api/decode-grip) emits kind: "Step". src/lib/workshop/gseDecoder.ts
// (legacy-program !GSE3! conversions) emits kind: "Action" or "Repeat" for
// the same role. This component originally only matched 'Action' | 'Repeat'
// -- copied from /workshop/decode/page.tsx, which only worked because ITS
// data comes through /api/workshop/decode, a separate route with its own
// normalizeEmsActionKind() that silently renames "Step" to "Action" before
// the browser ever sees it. The public sequence page has no such adapter, so
// every Step node fell through to the generic "unknown kind" branch below:
// no step number, no macro text, just the literal word "Step" as a label.
// Caught in a post-deploy self-audit before any real sequence had actually
// been published through the fixed pipeline (0 of 93 sequences had `actions`
// populated at the time this was found), so no live data was ever exposed
// broken -- but it would have hit the very next real publish. Fixed here by
// matching both conventions directly, which also makes the redundant adapter
// in /api/workshop/decode/route.ts no longer load-bearing (left in place,
// harmless, not worth a second migration-adjacent change to remove).
import type { ActionNode } from '@/types'
export type { ActionNode }

function ActionLine({ text }: { text: string }) {
  const parts = text.split(/(\[[^\]]+\]|\/\w+)/g)
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('/')) return <span key={i} style={{ color: 'var(--accent)' }}>{part}</span>
        if (part.startsWith('[')) return <span key={i} style={{ color: '#5a8dee' }}>{part}</span>
        return <span key={i}>{part}</span>
      })}
    </>
  )
}

export default function ActionTree({ nodes, counter }: { nodes: ActionNode[]; counter: { n: number } }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {nodes.map((node, i) => {
        if (node.kind === 'Loop') {
          return (
            <div key={i} style={{
              border: '0.5px solid var(--border-strong)',
              borderRadius: 'var(--radius-md)',
              overflow: 'hidden',
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '6px 10px',
                background: 'var(--bg-tertiary)',
                borderBottom: '0.5px solid var(--border)',
              }}>
                <span style={{
                  fontSize: 'var(--text-xs)', fontWeight: 600, padding: '2px 7px',
                  background: 'var(--accent)', color: 'white',
                  borderRadius: 'var(--radius-sm)', letterSpacing: '0.03em',
                }}>
                  Loop
                </span>
                {node.stepFunction && (
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    {node.stepFunction}
                  </span>
                )}
                {node.repeat && node.repeat > 1 && (
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>×{node.repeat}</span>
                )}
              </div>
              <div style={{ padding: '8px 10px' }}>
                {node.children && node.children.length > 0
                  ? <ActionTree nodes={node.children} counter={counter} />
                  : <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Empty loop</span>
                }
              </div>
            </div>
          )
        }

        if (node.kind === 'If') {
          return (
            <div key={i} style={{
              border: '0.5px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              overflow: 'hidden',
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '6px 10px', background: 'var(--bg-tertiary)',
                borderBottom: '0.5px solid var(--border)',
              }}>
                <span style={{
                  fontSize: 'var(--text-xs)', fontWeight: 600, padding: '2px 7px',
                  background: 'var(--bg-secondary)', color: 'var(--text-secondary)',
                  border: '0.5px solid var(--border)', borderRadius: 'var(--radius-sm)',
                }}>If</span>
                {node.variable && (
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{node.variable}</span>
                )}
              </div>
              <div style={{ padding: '8px 10px' }}>
                {node.children && node.children.length > 0
                  ? <ActionTree nodes={node.children} counter={counter} />
                  : <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Empty branch</span>
                }
              </div>
            </div>
          )
        }

        if (node.kind === 'Action' || node.kind === 'Step' || node.kind === 'Repeat') {
          const n = ++counter.n
          const lines = (node.text || '').split('\n').filter(Boolean)
          return (
            <div key={i} style={{
              display: 'flex', gap: 10, padding: '5px 4px',
              borderBottom: '0.5px solid var(--border)', fontSize: 'var(--text-xs)',
            }}>
              <span style={{ color: 'var(--text-muted)', flexShrink: 0, minWidth: 20, textAlign: 'right' }}>{n}</span>
              <div style={{ flex: 1 }}>
                {node.kind === 'Repeat' && (
                  <span style={{
                    fontSize: 'var(--text-xs)', fontWeight: 600, padding: '1px 5px', marginBottom: 3, display: 'inline-block',
                    background: 'var(--bg-tertiary)', color: 'var(--text-muted)',
                    border: '0.5px solid var(--border)', borderRadius: 'var(--radius-sm)',
                  }}>Repeat · every {node.interval}</span>
                )}
                {/* EMS/GRIP's equivalent of GSE's Repeat weave: a Step node
                    carries its own `interval` when it's an Interleave node
                    (see emsDecoder.ts's isWeave/[IL:N] label). Same concept,
                    different decoder's naming -- shown the same way here so
                    neither convention silently loses the indicator. */}
                {node.kind === 'Step' && node.interval && node.interval >= 2 && (
                  <span style={{
                    fontSize: 'var(--text-xs)', fontWeight: 600, padding: '1px 5px', marginBottom: 3, display: 'inline-block',
                    background: 'var(--bg-tertiary)', color: 'var(--text-muted)',
                    border: '0.5px solid var(--border)', borderRadius: 'var(--radius-sm)',
                  }}>Interleave · every {node.interval}</span>
                )}
                <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                  {lines.map((line, j) => (
                    <div key={j} style={{ lineHeight: 1.6 }}>
                      <ActionLine text={line} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )
        }

        // Pause, Embed, or unknown
        return (
          <div key={i} style={{
            display: 'flex', gap: 10, padding: '5px 4px',
            borderBottom: '0.5px solid var(--border)', fontSize: 'var(--text-xs)',
          }}>
            <span style={{ color: 'var(--text-muted)', flexShrink: 0, minWidth: 20, textAlign: 'right' }}>–</span>
            <pre style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', margin: 0, whiteSpace: 'pre-wrap', flex: 1 }}>
              {node.label}
            </pre>
          </div>
        )
      })}
    </div>
  )
}

// Counts only real, clickable steps (Action/Step/Repeat leaves) in a tree,
// the way a reader thinks of "step count" -- Loop/If wrapper nodes are
// structure, not steps, and shouldn't inflate the number. Matches both
// decoder conventions (see the kind-naming note above ActionNode).
export function countActionSteps(nodes: ActionNode[]): number {
  let n = 0
  for (const node of nodes) {
    if (node.kind === 'Action' || node.kind === 'Step' || node.kind === 'Repeat') n += 1
    if (node.children && node.children.length) n += countActionSteps(node.children)
  }
  return n
}
