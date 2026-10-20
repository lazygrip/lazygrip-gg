import { toneOf } from '@/lib/changelog/tone'

// A release's fingerprint: one segment per kind of change, as wide as that kind is common.
// Scanning a list of releases shows at a glance which were feature releases and which were fix sweeps.
export default function Fingerprint({ counts, height }: { counts: Record<string, number>; height?: number }) {
  const parts = Object.entries(counts).filter(([, n]) => n > 0)
  if (parts.length === 0) return null
  const label = parts.map(([k, n]) => `${n} ${k.toLowerCase()}`).join(', ')
  return (
    <div className="cl-bar" role="img" aria-label={label} style={height ? { height } : undefined}>
      {parts.map(([k, n]) => (
        <i key={k} className={`cl-t-${toneOf(k)}`} style={{ ['--n' as string]: Math.sqrt(n) } as React.CSSProperties} title={`${n} ${k.toLowerCase()}`} />
      ))}
    </div>
  )
}
