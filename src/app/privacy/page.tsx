export default function PrivacyPage() {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 24px' }}>
      <h1 style={{
        fontSize: 28,
        fontWeight: 600,
        letterSpacing: '-0.02em',
        marginBottom: 8,
        color: 'var(--text-primary)',
      }}>
        Privacy Policy
      </h1>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 40 }}>
        Last updated: May 3, 2026
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24, fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.8 }}>

        <Section title="Overview">
          <p>LazyGrip.net is built on Supabase (database and authentication) and hosted on Vercel. This policy explains what data we collect, how we use it, and your rights regarding that data. We do not sell your personal information.</p>
        </Section>

        <Section title="What We Collect">
          <p>When you create an account we collect your email address and the username you choose. We store content you post to the site including sequences, comments, and ratings. We also collect basic usage data such as page views and sequence view counts, which are used to improve the site.</p>
          <p style={{ marginTop: 12 }}>We do not collect payment information. LazyGrip.net is free and has no paid features.</p>
        </Section>

        <Section title="How We Use Your Data">
          <ul style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <li>To identify you on the site and display your username on content you post</li>
            <li>To send you important account notifications such as password resets</li>
            <li>To maintain and improve the site</li>
            <li>To detect and prevent abuse</li>
          </ul>
          <p style={{ marginTop: 12 }}>We do not use your data for advertising and we do not share it with advertising networks.</p>
        </Section>

        <Section title="Third-Party Services">
          <p>LazyGrip.net uses the following third-party services to operate:</p>
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { name: 'Supabase', desc: 'Database and authentication. Your account data and posted content are stored here.' },
              { name: 'Vercel', desc: 'Site hosting and deployment. Vercel may collect anonymized request logs.' },
            ].map(s => (
              <div key={s.name} style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: '0.5px solid var(--border)' }}>
                <span style={{ fontWeight: 500, color: 'var(--text-primary)', minWidth: 100, flexShrink: 0 }}>{s.name}</span>
                <span>{s.desc}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Cookies">
          <p>LazyGrip.net uses cookies only for authentication — to keep you logged in between visits. We do not use advertising cookies or third-party tracking cookies.</p>
        </Section>

        <Section title="Your Rights">
          <p>You can update your profile information at any time from your profile page. You can delete sequences and comments you have posted. To request full account deletion and removal of your personal data, email <a href="mailto:admin@lazygrip.net" style={{ color: 'var(--accent)', textDecoration: 'none' }}>admin@lazygrip.net</a> with your username. We will process deletion requests within 30 days.</p>
        </Section>

        <Section title="Data Retention">
          <p>We retain your account data and content for as long as your account is open. When your account is deleted, your personal information is removed. Some anonymized usage data may be retained for site analytics.</p>
        </Section>

        <Section title="Children">
          <p>LazyGrip.net is not directed at children under 13. We do not knowingly collect personal information from children under 13. If you believe a child has provided us with personal information, contact us at admin@lazygrip.net and we will delete it.</p>
        </Section>

        <Section title="Changes">
          <p>We may update this policy from time to time. We will update the date at the top of this page when changes are made. Continued use of the site after updates are posted constitutes your acceptance of the updated policy.</p>
        </Section>

        <Section title="Contact">
          <p>Questions about this privacy policy can be sent to <a href="mailto:admin@lazygrip.net" style={{ color: 'var(--accent)', textDecoration: 'none' }}>admin@lazygrip.net</a>.</p>
        </Section>

      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: 'var(--bg-primary)',
      border: '0.5px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      padding: '20px 24px',
    }}>
      <h2 style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 10 }}>
        {title}
      </h2>
      {children}
    </div>
  )
}
