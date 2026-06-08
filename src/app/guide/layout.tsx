'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BookOpen, Download, Cpu, Layers, ArrowLeftRight, BarChart2, ChevronRight } from 'lucide-react'

const NAV_ITEMS = [
  { href: '/guide', label: 'Overview', icon: <BookOpen size={14} />, exact: true },
  { href: '/guide/installation', label: 'Installation', icon: <Download size={14} />, exact: false },
  { href: '/guide/how-it-works', label: 'How it works', icon: <Cpu size={14} />, exact: false },
  { href: '/guide/building-sequences', label: 'Building sequences', icon: <Layers size={14} />, exact: false },
  { href: '/guide/from-gse', label: 'Coming from GSE', icon: <ArrowLeftRight size={14} />, exact: false },
  { href: '/guide/validating', label: 'Validating your work', icon: <BarChart2 size={14} />, exact: false },
]

export default function GuideLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <>
      <style>{`
        .guide-layout { max-width: 1100px; margin: 0 auto; padding: 32px 24px; display: flex; gap: 32px; align-items: flex-start; }
        .guide-sidebar { width: 220px; flex-shrink: 0; position: sticky; top: 88px; }
        .guide-content { flex: 1; min-width: 0; }
        .guide-nav-label { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; color: var(--text-muted); margin-bottom: 8px; padding-left: 8px; }
        .guide-nav-item { display: flex; align-items: center; gap: 8px; padding: 7px 10px; border-radius: var(--radius-md); font-size: 13px; font-weight: 400; color: var(--text-secondary); text-decoration: none; transition: background 0.12s, color 0.12s; margin-bottom: 2px; border: 0.5px solid transparent; }
        .guide-nav-item:hover { background: var(--bg-tertiary); color: var(--text-primary); }
        .guide-nav-item.active { background: var(--accent-subtle); color: var(--accent-text); font-weight: 500; border-color: rgba(29,158,117,0.2); }
        .guide-nav-item.active svg { color: var(--accent); }
        .guide-breadcrumb { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text-muted); margin-bottom: 24px; }
        .guide-breadcrumb a { color: var(--text-muted); text-decoration: none; }
        .guide-breadcrumb a:hover { color: var(--accent); }
        @media (max-width: 700px) {
          .guide-layout { flex-direction: column; padding: 16px; gap: 16px; }
          .guide-sidebar { width: 100%; position: static; }
          .guide-sidebar-nav { display: flex; flex-wrap: wrap; gap: 4px; }
          .guide-nav-item { flex: 0 0 auto; }
        }
      `}</style>

      <div className="guide-layout">
        <aside className="guide-sidebar">
          <div className="guide-nav-label">Guide</div>
          <nav className="guide-sidebar-nav">
            {NAV_ITEMS.map(item => {
              const active = item.exact
                ? pathname === item.href
                : pathname === item.href || pathname.startsWith(item.href + '/')
              return (
                <Link key={item.href} href={item.href} className={`guide-nav-item${active ? ' active' : ''}`}>
                  {item.icon}
                  {item.label}
                </Link>
              )
            })}
          </nav>

          <div style={{ marginTop: 24, padding: '12px', background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Current version</div>
            <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>GRIP-EMS v2.1.16</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>All specs supported</div>
          </div>
        </aside>

        <div className="guide-content">
          {pathname !== '/guide' && (
            <div className="guide-breadcrumb">
              <Link href="/guide">Guide</Link>
              <ChevronRight size={11} />
              <span style={{ color: 'var(--text-secondary)' }}>
                {NAV_ITEMS.find(i => pathname.startsWith(i.href) && i.href !== '/guide')?.label}
              </span>
            </div>
          )}
          {children}
        </div>
      </div>
    </>
  )
}
