import Link from 'next/link'
import { Shield } from 'lucide-react'

export default function AboutPage() {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 24px' }}>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <div style={{
          width: 40,
          height: 40,
          background: 'var(--accent)',
          borderRadius: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Shield size={20} color="white" strokeWidth={2.5} />
        </div>
        <h1 style={{
          fontSize: 28,
          fontWeight: 600,
          letterSpacing: '-0.02em',
          color: 'var(--text-primary)',
        }}>
          About LazyGrip.net
        </h1>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        <div style={{
          background: 'var(--bg-primary)',
          border: '0.5px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: '24px',
        }}>
          <h2 style={{ fontSize: 16, fontWeight: 500, marginBottom: 12, color: 'var(--text-primary)' }}>What is LazyGrip.net?</h2>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
            LazyGrip.net is a community site for World of Warcraft players who use GRIP-EMS — a modern rotation addon that lets you build and share keypress-based macro sequences. The site gives GRIP users a single place to post their sequences, browse what other players have built, and rate what works.
          </p>
        </div>

        <div style={{
          background: 'var(--bg-primary)',
          border: '0.5px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: '24px',
        }}>
          <h2 style={{ fontSize: 16, fontWeight: 500, marginBottom: 12, color: 'var(--text-primary)' }}>Why did we build this?</h2>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
            GRIP-EMS is a newer addon and the community sharing sequences for it is still growing. We wanted a dedicated home for GRIP sequences — one that makes it easy to find something for your class, import it directly, and give feedback to the author. No forum threads to dig through, no copy-pasting from Reddit posts. Just sequences, organized and ready to use.
          </p>
        </div>

        <div style={{
          background: 'var(--bg-primary)',
          border: '0.5px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: '24px',
        }}>
          <h2 style={{ fontSize: 16, fontWeight: 500, marginBottom: 12, color: 'var(--text-primary)' }}>Who is it for?</h2>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
            LazyGrip.net is for any WoW player using GRIP-EMS — whether you are new to the addon and looking for a working sequence to get started, or an experienced player sharing something you have refined and validated through real content. Browsing is open to everyone. Posting and saving sequences requires a free account.
          </p>
        </div>

        <div style={{
          background: 'var(--bg-primary)',
          border: '0.5px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: '24px',
        }}>
          <h2 style={{ fontSize: 16, fontWeight: 500, marginBottom: 12, color: 'var(--text-primary)' }}>Resources</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>GRIP-EMS Official Guide</span>
              <a href="https://jesperlive.github.io/grip-ems-guide/" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>
                Visit →
              </a>
            </div>
            <div style={{ borderTop: '0.5px solid var(--border)', paddingTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>GRIP-EMS Discord (addon support)</span>
              <a href="https://discord.gg/UUdmCNUv" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>
                Join →
              </a>
            </div>
            <div style={{ borderTop: '0.5px solid var(--border)', paddingTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Frequently Asked Questions</span>
              <Link href="/faq" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>
                Read →
              </Link>
            </div>
          </div>
        </div>

        <div style={{
          background: 'var(--bg-primary)',
          border: '0.5px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: '24px',
        }}>
          <h2 style={{ fontSize: 16, fontWeight: 500, marginBottom: 12, color: 'var(--text-primary)' }}>Disclaimer</h2>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
            LazyGrip.net is an independent community site. It is not affiliated with, endorsed by, or connected to Blizzard Entertainment, the GRIP-EMS addon developer, or any other game company. World of Warcraft is a trademark of Blizzard Entertainment, Inc.
          </p>
        </div>

      </div>
    </div>
  )
}
