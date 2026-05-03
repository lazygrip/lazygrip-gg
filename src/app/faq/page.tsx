import Link from 'next/link'

const FAQS = [
  {
    section: 'About GRIP-EMS',
    items: [
      {
        q: 'What is GRIP-EMS?',
        a: 'GRIP-EMS (Greater Rotation Intelligence Platform – Enhanced Macro System) is a World of Warcraft addon that lets you build and run automated rotation sequences. It fires one action per keypress, which complies with Blizzard\'s Terms of Service. It is available on CurseForge and WoWInterface.',
      },
      {
        q: 'Where can I learn how to build GRIP-EMS sequences?',
        a: null,
        link: { href: 'https://jesperlive.github.io/grip-ems-guide/', label: 'GRIP-EMS Official Guide →', text: 'The official GRIP-EMS guide covers everything from installation to building your first sequence. Written and maintained by the addon developer.' },
      },
      {
        q: 'Are GRIP-EMS sequences allowed by Blizzard?',
        a: 'Yes. GRIP-EMS sequences fire one action per keypress and do not automate input beyond what Blizzard permits. LazyGrip.net does not host sequences that reference or require any prohibited automation tools, bots, or cheat engines.',
      },
      {
        q: 'I need help with the GRIP-EMS addon itself.',
        a: null,
        discord: true,
      },
    ],
  },
  {
    section: 'Using LazyGrip.net',
    items: [
      {
        q: 'What is LazyGrip.net?',
        a: 'LazyGrip.net is a community site for sharing, browsing, and rating GRIP-EMS sequences. Anyone can browse without an account. Creating a free account lets you post sequences, save favorites, and leave comments.',
      },
      {
        q: 'How do I import a sequence?',
        a: 'Copy the GRIP import string from the sequence page. In-game, type /gems import and paste the string. The sequence will be added to your GRIP-EMS addon automatically.',
      },
      {
        q: 'How do I post a sequence?',
        a: 'Create a free account, then click Post Sequence in the header. Fill in the class, spec, content type, and paste your GRIP export string. Your sequence will be live immediately.',
      },
      {
        q: 'Can I edit or delete a sequence I posted?',
        a: 'Yes. Open your sequence page while logged in and you will see Edit and Delete buttons visible only to you as the author. Edit loads the sequence back into the post form. Delete shows a confirmation dialog before permanently removing it.',
      },
      {
        q: 'How do I save a sequence for later?',
        a: 'Click the Save button on any sequence page while logged in. Your saved sequences are accessible from your profile page.',
      },
    ],
  },
  {
    section: 'Account and Privacy',
    items: [
      {
        q: 'Is LazyGrip.net free?',
        a: 'Yes. Browsing, posting, saving, and commenting are all free. There are no paid tiers.',
      },
      {
        q: 'How do I delete my account?',
        a: 'You can request account deletion at any time by emailing admin@lazygrip.net. Include your username and we will remove your account and associated data within 30 days.',
      },
      {
        q: 'Is LazyGrip.net affiliated with Blizzard Entertainment or the GRIP-EMS addon?',
        a: 'No. LazyGrip.net is an independent community site. It is not affiliated with, endorsed by, or connected to Blizzard Entertainment or the GRIP-EMS addon developer.',
      },
    ],
  },
]

export default function FAQPage() {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 24px' }}>
      <h1 style={{
        fontSize: 28,
        fontWeight: 600,
        letterSpacing: '-0.02em',
        marginBottom: 8,
        color: 'var(--text-primary)',
      }}>
        Frequently Asked Questions
      </h1>
      <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 40, lineHeight: 1.6 }}>
        Everything you need to know about LazyGrip.net and GRIP-EMS.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
        {FAQS.map((section) => (
          <div key={section.section}>
            <h2 style={{
              fontSize: 12,
              fontWeight: 500,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '.06em',
              marginBottom: 12,
            }}>
              {section.section}
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {section.items.map((item, i) => (
                <div key={i} style={{
                  background: 'var(--bg-primary)',
                  border: '0.5px solid var(--border)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '20px 24px',
                }}>
                  <h3 style={{
                    fontSize: 14,
                    fontWeight: 500,
                    color: 'var(--text-primary)',
                    marginBottom: 10,
                  }}>
                    {item.q}
                  </h3>
                  {item.discord ? (
                    <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                      Join the GRIP-EMS Discord for addon support, bug reports, and help from the community and the developer.{' '}
                      <a href="https://discord.gg/UUdmCNUv" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>
                        Join the GRIP-EMS Discord →
                      </a>
                    </p>
                  ) : item.link ? (
                    <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                      {item.link.text}{' '}
                      <a href={item.link.href} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>
                        {item.link.label}
                      </a>
                    </p>
                  ) : (
                    <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                      {item.a}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
