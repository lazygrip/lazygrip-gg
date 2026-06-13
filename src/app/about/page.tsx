import Link from 'next/link'
import { Shield } from 'lucide-react'

export default function AboutPage() {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
        <div style={{
          width: 40, height: 40, background: 'var(--accent)', borderRadius: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Shield size={20} color="white" strokeWidth={2.5} />
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
          About LazyGrip.net
        </h1>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        <div style={{ background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '24px' }}>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
            This site exists because GRIP-EMS needed a place where sequences could actually be found. Right now if you want a Guardian Druid sequence for Mythic+ you are digging through Discord threads, Reddit posts, or forum replies that are three patches out of date. That is not good enough for an addon that deserves better than that.
          </p>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.8, marginTop: 12 }}>
            LazyGrip.net is a sequence library. You browse by class, find something for your spec and content type, copy the GRIP import string, and you are done. If you built something worth sharing you post it here, someone else runs it, and they tell you how it held up. That is the whole thing.
          </p>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.8, marginTop: 12 }}>
            It is open to anyone running GRIP-EMS. Browsing does not require an account. Posting and saving sequences does, and it is free.
          </p>
        </div>

        <div style={{ background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '24px' }}>
          <h2 style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 12 }}>Resources</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>GRIP-EMS Official Guide</span>
              <a href="https://jesperlive.github.io/grip-ems-guide/" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>Visit</a>
            </div>
            <div style={{ borderTop: '0.5px solid var(--border)', paddingTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>GRIP-EMS Discord</span>
              <a href="https://discord.gg/UUdmCNUv" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>Join</a>
            </div>
            <div style={{ borderTop: '0.5px solid var(--border)', paddingTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>GRIP-EMS Subreddit</span>
              <a href="https://www.reddit.com/r/GRIPEMS/" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>Visit</a>
            </div>
            <div style={{ borderTop: '0.5px solid var(--border)', paddingTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>FAQ</span>
              <Link href="/faq" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>Read</Link>
            </div>
          </div>
        </div>

        <div style={{ background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '24px' }}>
          <h2 style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 10 }}>Disclaimer</h2>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
            LazyGrip.net is an independent site with no affiliation with Blizzard Entertainment or the GRIP-EMS addon developer. World of Warcraft is a trademark of Blizzard Entertainment, Inc.
          </p>
        </div>

      </div>
    </div>
  )
}
