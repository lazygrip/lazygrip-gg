import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

type PageHeaderProps = {
  icon?: LucideIcon
  title: string
  description?: ReactNode
  maxWidth?: number
}

/**
 * Standard header for interior pages (About, FAQ, Guide, etc.) — icon badge, title,
 * optional description paragraph. Not for the homepage hero, which has its own
 * bespoke treatment (illustrated mark, stat block, dual CTA).
 */
export default function PageHeader({ icon: Icon, title, description, maxWidth = 620 }: PageHeaderProps) {
  return (
    <div style={{ marginBottom: 36 }}>
      {Icon && (
        <div
          style={{
            width: 40,
            height: 40,
            background: 'var(--accent)',
            borderRadius: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 16,
          }}
        >
          <Icon size={20} color="white" strokeWidth={2.5} />
        </div>
      )}
      <h1
        style={{
          fontSize: 'var(--text-2xl)',
          fontWeight: 600,
          letterSpacing: '-0.03em',
          lineHeight: 1.2,
          marginBottom: description ? 12 : 0,
          color: 'var(--text-primary)',
        }}
      >
        {title}
      </h1>
      {description && (
        <p
          style={{
            fontSize: 'var(--text-base)',
            color: 'var(--text-secondary)',
            lineHeight: 1.75,
            maxWidth,
          }}
        >
          {description}
        </p>
      )}
    </div>
  )
}
