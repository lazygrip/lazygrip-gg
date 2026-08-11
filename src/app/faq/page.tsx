import type { Metadata } from 'next'
import PageHeader from '@/components/ui/PageHeader'
import Card from '@/components/ui/Card'

export const metadata: Metadata = {
  title: 'GRIP-EMS FAQ',
  description: 'Common questions about GRIP-EMS and LazyGrip.net: importing sequences, whether one-button macros are allowed, accounts, and privacy.',
  alternates: {
    canonical: 'https://lazygrip.net/faq',
  },
  openGraph: {
    title: 'GRIP-EMS FAQ',
    description: 'Common questions about GRIP-EMS and LazyGrip.net: importing sequences, whether one-button macros are allowed, accounts, and privacy.',
    url: 'https://lazygrip.net/faq',
    siteName: 'LazyGrip.net',
    type: 'website',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'LazyGrip.net — GRIP-EMS sequences for World of Warcraft' }],
  },
}

const GROUPS = [
  {
    heading: 'About GRIP-EMS',
    items: [
      {
        q: 'What is GRIP-EMS?',
        a: 'It is a World of Warcraft addon that runs your rotation automatically, one action per keypress. You build a sequence of spells, bind it to a key, and it cycles through them as you press. It is available on CurseForge and WoWInterface and it is free.',
      },
      {
        q: 'Is it allowed by Blizzard?',
        a: 'Yes. One action per keypress is within the rules. The site will not host anything that requires bots or prohibited automation tools.',
      },
      {
        q: 'Where do I learn how to build sequences?',
        a: (
          <>
            The LazyGrip guide covers installation, settings, how the step engine works, building sequences from scratch, and validating your work against logs.{' '}
            <a href="/guide" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>lazygrip.net/guide</a>
          </>
        ),
      },
      {
        q: 'I need help with the addon itself.',
        a: (
          <>
            <p style={{ margin: 0 }}>
              The GRIP-EMS Discord is the fastest place to get help. The developer is in there along with the rest of the community.{' '}
              <a href="https://discord.gg/UUdmCNUv" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>discord.gg/UUdmCNUv</a>
            </p>
            <p style={{ marginTop: 8 }}>
              The community also has a subreddit for discussion, sharing sequences, and general GRIP-EMS questions.{' '}
              <a href="https://www.reddit.com/r/GRIPEMS/" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>r/GRIPEMS</a>
            </p>
          </>
        ),
      },
    ],
  },
  {
    heading: 'Using LazyGrip.net',
    items: [
      {
        q: 'How do I import a sequence?',
        a: 'Copy the GRIP import string from the sequence page, go in-game, type /gems import, and paste it. Done.',
      },
      {
        q: 'How do I post a sequence?',
        a: 'Create a free account, click Post Sequence in the header, fill in your class and spec, paste your GRIP export string, and it goes live.',
      },
      {
        q: 'Can I edit or delete something I posted?',
        a: 'Yes. Open your sequence page while logged in and the Edit and Delete buttons are there. Only you can see them. Delete asks for confirmation before it removes anything.',
      },
      {
        q: 'How do I save a sequence?',
        a: 'Hit the Save button on any sequence page. Your saved sequences show up on your profile.',
      },
    ],
  },
  {
    heading: 'Account and Privacy',
    items: [
      {
        q: 'Is this free?',
        a: 'Yes. Browsing, posting, saving, and commenting are all free and there are no paid tiers.',
      },
      {
        q: 'How do I delete my account?',
        a: (
          <>
            Email{' '}
            <a href="mailto:admin@lazygrip.net" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>admin@lazygrip.net</a>
            {' '}with your username and we will remove your account and data within 30 days.
          </>
        ),
      },
      {
        q: 'Who runs LazyGrip.net?',
        a: 'LazyGrip.net is a community site, independently owned and operated. It is not an official GRIP-EMS site, and it is not affiliated with or endorsed by Blizzard Entertainment. The GRIP-EMS developer contributes code to the site as a collaborator, by arrangement, and holds neither ownership nor administrative control over the site or its repository.',
      },
    ],
  },
]

export default function FAQPage() {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 24px' }}>
      <PageHeader title="Frequently Asked Questions" description="About LazyGrip.net and GRIP-EMS." />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
        {GROUPS.map(group => (
          <div key={group.heading}>
            <h2 style={{ fontSize: 'var(--text-xs)', fontWeight: 500, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 12 }}>
              {group.heading}
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {group.items.map(item => (
                <Card key={item.q} padding="md" style={{ padding: '20px 24px' }}>
                  <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--text-primary)', marginBottom: 10 }}>{item.q}</h3>
                  <div style={{ fontSize: 'var(--text-base)', color: 'var(--text-secondary)', lineHeight: 1.7 }}>{item.a}</div>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
