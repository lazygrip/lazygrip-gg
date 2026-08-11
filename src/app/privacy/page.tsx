import type { Metadata } from 'next'
import PageHeader from '@/components/ui/PageHeader'
import Card from '@/components/ui/Card'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'What LazyGrip.net collects, how it is used, which third-party services are involved, and how to exercise your rights.',
  alternates: {
    canonical: 'https://lazygrip.net/privacy',
  },
  openGraph: {
    title: 'Privacy Policy',
    description: 'What LazyGrip.net collects, how it is used, which third-party services are involved, and how to exercise your rights.',
    url: 'https://lazygrip.net/privacy',
    siteName: 'LazyGrip.net',
    type: 'website',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'LazyGrip.net — GRIP-EMS sequences for World of Warcraft' }],
  },
}

const SECTIONS = [
  {
    title: 'Overview',
    body: <p>LazyGrip.net runs on Supabase for the database and authentication, and Vercel for hosting. This page covers what data we collect, what we do with it, and what rights you have. We do not sell your information.</p>,
  },
  {
    title: 'What We Collect',
    body: (
      <>
        <p>When you create an account we collect your email address and the username you pick. We store whatever you post to the site, sequences, comments, and ratings. We also collect basic usage data like page views and sequence view counts to understand how the site is being used.</p>
        <p style={{ marginTop: 12 }}>We do not collect payment information. The site is free and there is nothing to pay for.</p>
      </>
    ),
  },
  {
    title: 'How We Use It',
    body: <p>Your data is used to identify you on the site, show your username on content you post, send account notifications like password resets, keep the site running, and catch abuse. We do not use it for advertising and we do not share it with ad networks.</p>,
  },
  {
    title: 'Third-Party Services',
    body: <p>Supabase handles the database and authentication. Your account data and content live there. Vercel handles hosting and deployment and may collect anonymized request logs.</p>,
  },
  {
    title: 'Cookies',
    body: <p>The only cookies we use are for keeping you logged in. No ad tracking, no third-party tracking cookies.</p>,
  },
  {
    title: 'Your Rights',
    body: (
      <p>
        You can update your profile from your profile page anytime. You can delete sequences and comments you have posted. If you want your account and personal data fully removed, email{' '}
        <a href="mailto:admin@lazygrip.net" style={{ color: 'var(--accent)', textDecoration: 'none' }}>admin@lazygrip.net</a>{' '}
        with your username and we will take care of it within 30 days.
      </p>
    ),
  },
  {
    title: 'Data Retention',
    body: <p>We keep your account data and content as long as your account is open. When your account is deleted your personal information goes with it. Some anonymized usage data may stick around for analytics.</p>,
  },
  {
    title: 'Children',
    body: (
      <p>
        This site is not for anyone under 13 and we do not knowingly collect information from children under 13. If you think a child has submitted information to the site contact us at{' '}
        <a href="mailto:admin@lazygrip.net" style={{ color: 'var(--accent)', textDecoration: 'none' }}>admin@lazygrip.net</a>{' '}
        and we will remove it.
      </p>
    ),
  },
  {
    title: 'Changes',
    body: <p>We can update this policy. The date at the top will reflect when it last changed. Continued use of the site after updates means you accept the updated policy.</p>,
  },
  {
    title: 'Contact',
    body: <p>Questions go to <a href="mailto:admin@lazygrip.net" style={{ color: 'var(--accent)', textDecoration: 'none' }}>admin@lazygrip.net</a>.</p>,
  },
]

export default function PrivacyPage() {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 24px' }}>
      <PageHeader title="Privacy Policy" description={<span style={{ color: 'var(--text-muted)' }}>Last updated: May 3, 2026</span>} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
        {SECTIONS.map(section => (
          <Card key={section.title} style={{ padding: '20px 24px' }}>
            <h2 style={{ fontSize: 'var(--text-base)', fontWeight: 500, color: 'var(--text-primary)', marginBottom: 10 }}>{section.title}</h2>
            {section.body}
          </Card>
        ))}
      </div>
    </div>
  )
}
