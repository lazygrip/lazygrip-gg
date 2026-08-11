type SequenceMarkProps = {
  size?: number
}

/**
 * The hero's illustrated mark — oversized, line-art, Modrinth-scale rather than a small
 * badge icon. Not a generic glyph: it's literally LazyGrip's own product concept drawn as
 * a mark — a loop (the sequence), four step nodes, and one emphasized node (a priority-
 * weighted step), with a directional arrow showing the loop advancing. Two-tone accent
 * green on a soft background circle, matching the Modrinth reference point from the design
 * research rather than Nexus's photographic treatment.
 */
export default function SequenceMark({ size = 140 }: SequenceMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 160 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="LazyGrip sequence mark"
    >
      <circle cx="80" cy="80" r="76" fill="var(--accent-subtle)" stroke="var(--border)" strokeWidth="1" />

      {/* the loop */}
      <rect x="40" y="40" width="80" height="80" rx="24" stroke="var(--accent)" strokeWidth="3" fill="none" />

      {/* step nodes */}
      <circle cx="80" cy="40" r="5" fill="var(--accent)" opacity="0.55" />
      <circle cx="80" cy="120" r="5" fill="var(--accent)" opacity="0.55" />
      <circle cx="40" cy="80" r="5" fill="var(--accent)" opacity="0.55" />

      {/* the priority-weighted step, emphasized */}
      <circle cx="120" cy="80" r="8" fill="var(--accent)" stroke="var(--bg-primary)" strokeWidth="3" />

      {/* direction of advance */}
      <path d="M92 34 L103 40 L92 46 Z" fill="var(--accent)" />
    </svg>
  )
}
