export default function FAQPage() {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 24px' }}>
      <h1 style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 8, color: 'var(--text-primary)' }}>
        Frequently Asked Questions
      </h1>
      <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 40, lineHeight: 1.6 }}>
        About LazyGrip.net and GRIP-EMS.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>

        <div>
          <h2 style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 12 }}>
            About GRIP-EMS
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

            <div style={{ background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px 24px' }}>
              <h3 style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 10 }}>What is GRIP-EMS?</h3>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                It is a World of Warcraft addon that runs your rotation automatically, one action per keypress. You build a sequence of spells, bind it to a key, and it cycles through them as you press. It is available on CurseForge and WoWInterface and it is free.
              </p>
            </div>

            <div style={{ background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px 24px' }}>
              <h3 style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 10 }}>Is it allowed by Blizzard?</h3>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                Yes. One action per keypress is within the rules. The site will not host anything that requires bots or prohibited automation tools.
              </p>
            </div>

            <div style={{ background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px 24px' }}>
              <h3 style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 10 }}>Where do I learn how to build sequences?</h3>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                The LazyGrip guide covers installation, settings, how the step engine works, building sequences from scratch, and validating your work against logs.{' '}
                <a href="/guide" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>
                  lazygrip.net/guide
                </a>
              </p>
            </div>

            <div style={{ background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px 24px' }}>
              <h3 style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 10 }}>I need help with the addon itself.</h3>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                The GRIP-EMS Discord is the fastest place to get help. The developer is in there along with the rest of the community.{' '}
                <a href="https://discord.gg/UUdmCNUv" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>
                  discord.gg/UUdmCNUv
                </a>
              </p>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7, marginTop: 8 }}>
                The community also has a subreddit for discussion, sharing sequences, and general GRIP-EMS questions.{' '}
                <a href="https://www.reddit.com/r/GRIPEMS/" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>
                  r/GRIPEMS
                </a>
              </p>
            </div>

          </div>
        </div>

        <div>
          <h2 style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 12 }}>
            Using LazyGrip.net
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

            <div style={{ background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px 24px' }}>
              <h3 style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 10 }}>How do I import a sequence?</h3>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                Copy the GRIP import string from the sequence page, go in-game, type /gems import, and paste it. Done.
              </p>
            </div>

            <div style={{ background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px 24px' }}>
              <h3 style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 10 }}>How do I post a sequence?</h3>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                Create a free account, click Post Sequence in the header, fill in your class and spec, paste your GRIP export string, and it goes live.
              </p>
            </div>

            <div style={{ background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px 24px' }}>
              <h3 style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 10 }}>Can I edit or delete something I posted?</h3>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                Yes. Open your sequence page while logged in and the Edit and Delete buttons are there. Only you can see them. Delete asks for confirmation before it removes anything.
              </p>
            </div>

            <div style={{ background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px 24px' }}>
              <h3 style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 10 }}>How do I save a sequence?</h3>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                Hit the Save button on any sequence page. Your saved sequences show up on your profile.
              </p>
            </div>

          </div>
        </div>

        <div>
          <h2 style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 12 }}>
            Account and Privacy
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

            <div style={{ background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px 24px' }}>
              <h3 style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 10 }}>Is this free?</h3>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                Yes. Browsing, posting, saving, and commenting are all free and there are no paid tiers.
              </p>
            </div>

            <div style={{ background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px 24px' }}>
              <h3 style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 10 }}>How do I delete my account?</h3>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                Email admin@lazygrip.net with your username and we will remove your account and data within 30 days.
              </p>
            </div>

            <div style={{ background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px 24px' }}>
              <h3 style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 10 }}>Is LazyGrip.net affiliated with Blizzard or the GRIP-EMS developer?</h3>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                No. This is an independent site with no connection to either.
              </p>
            </div>

          </div>
        </div>

      </div>
    </div>
  )
}
