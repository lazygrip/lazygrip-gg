type ForeverMarkProps = {
  width?: number
}

/**
 * The Forever page's hero art, drawn from scratch for this site: LazyGrip's sequence loop turned
 * on its side into an infinity sign, with step nodes riding the line and one emphasized node, the
 * way the home page mark does it. Nothing in it comes from Blizzard's art or anyone else's, so it
 * can sit on a public page without a licence question. Colors are the site's tokens, so it follows
 * the light and dark themes, and the motion (a dashed run along the loop, a slow pulse on the
 * nodes) switches off under prefers-reduced-motion in globals.css.
 */
const LOOP =
  'M120 60 C150 15 225 15 225 60 C225 105 150 105 120 60 C90 15 15 15 15 60 C15 105 90 105 120 60 Z'

const NODES: Array<{ x: number; y: number; r: number; strong?: boolean }> = [
  { x: 184, y: 26, r: 4.5 },
  { x: 225, y: 60, r: 8, strong: true },
  { x: 184, y: 94, r: 4.5 },
  { x: 56, y: 94, r: 4.5 },
  { x: 15, y: 60, r: 6.5 },
  { x: 56, y: 26, r: 4.5 },
]

export default function ForeverMark({ width = 300 }: ForeverMarkProps) {
  return (
    <svg
      width={width}
      height={(width * 120) / 240}
      viewBox="0 0 240 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="An infinity loop of sequence steps"
      style={{ maxWidth: '100%', overflow: 'visible' }}
    >
      <defs>
        <filter id="forever-glow" x="-30%" y="-60%" width="160%" height="220%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
      </defs>

      {/* soft glow under the whole loop */}
      <path d={LOOP} stroke="var(--accent)" strokeWidth="9" opacity="0.4" filter="url(#forever-glow)" />
      {/* the loop itself */}
      <path d={LOOP} stroke="var(--accent)" strokeWidth="2.5" strokeLinejoin="round" opacity="0.55" />
      {/* the dashes that run around it, one step after another */}
      <path d={LOOP} stroke="var(--accent-text)" strokeWidth="2.5" strokeLinecap="round" className="forever-loop-run" />

      {NODES.map((n, i) => (
        <g key={i} className="forever-node-pulse" style={{ animationDelay: `${i * 0.35}s` }}>
          <circle cx={n.x} cy={n.y} r={n.r + 5} fill="var(--accent)" opacity={n.strong ? 0.22 : 0.12} />
          <circle cx={n.x} cy={n.y} r={n.r} fill={n.strong ? 'var(--accent)' : 'var(--bg-primary)'} stroke="var(--accent)" strokeWidth="2" />
        </g>
      ))}
    </svg>
  )
}
