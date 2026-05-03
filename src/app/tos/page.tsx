export default function TermsPage() {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 24px' }}>
      <h1 style={{
        fontSize: 28,
        fontWeight: 600,
        letterSpacing: '-0.02em',
        marginBottom: 8,
        color: 'var(--text-primary)',
      }}>
        Terms of Service
      </h1>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 40 }}>
        Last updated: May 3, 2026
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24, fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.8 }}>

        <Section title="Agreement">
          <p>By using LazyGrip.net you agree to these terms. If you do not agree, do not use the site. These terms apply to all visitors and registered users.</p>
        </Section>

        <Section title="Who Can Use the Site">
          <p>You must be at least 13 years old to create an account. By creating an account you confirm that you meet this requirement.</p>
        </Section>

        <Section title="Your Account">
          <p>You are responsible for all activity that occurs under your account. Keep your password secure and do not share it. If you believe your account has been compromised, contact us at admin@lazygrip.net immediately. We reserve the right to suspend or terminate accounts that violate these terms.</p>
        </Section>

        <Section title="Acceptable Use">
          <p>You may not use LazyGrip.net to:</p>
          <ul style={{ paddingLeft: 20, marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <li>Break any applicable law or regulation</li>
            <li>Harass, threaten, or harm other users</li>
            <li>Post spam, advertisements, or unsolicited promotional content</li>
            <li>Attempt to access another user's account without permission</li>
            <li>Use automated tools to scrape, crawl, or overload the site</li>
            <li>Impersonate any person or entity</li>
            <li>Post content that infringes on anyone's intellectual property</li>
          </ul>
        </Section>

        <Section title="Content Standards">
          <p>Sequences and other content posted to LazyGrip.net must:</p>
          <ul style={{ paddingLeft: 20, marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <li>Comply with World of Warcraft's Terms of Service</li>
            <li>Not reference, require, or facilitate botting, automation software, or cheat engines</li>
            <li>Be your own original work or content you have the right to share</li>
            <li>Not be misleading, fraudulent, or harmful to other users</li>
          </ul>
          <p style={{ marginTop: 12 }}>We reserve the right to remove any content that violates these standards without notice.</p>
        </Section>

        <Section title="Your Content">
          <p>You retain ownership of sequences and other content you post. By posting content on LazyGrip.net you grant us a non-exclusive license to store, display, and distribute that content to other users of the site. This license ends when you delete your content or close your account, after any backup retention period expires.</p>
        </Section>

        <Section title="Enforcement">
          <p>We may investigate violations of these terms and take action including removing content, suspending accounts, or terminating access. We are not obligated to preview content before it is posted, and we take no responsibility for content posted by users.</p>
        </Section>

        <Section title="Disclaimers">
          <p>LazyGrip.net is provided as-is without any warranty of any kind. We do not guarantee that the site will be available at all times, that sequences posted by users will perform as described, or that any content is free from errors. Use of sequences found on this site is entirely at your own risk.</p>
          <p style={{ marginTop: 12 }}>LazyGrip.net is not affiliated with Blizzard Entertainment or the GRIP-EMS addon developer.</p>
        </Section>

        <Section title="Limits on Liability">
          <p>To the maximum extent permitted by law, LazyGrip.net and its operators will not be liable for any indirect, incidental, or consequential damages arising from your use of the site. Our total liability to you for any claim related to the site will not exceed $50.</p>
        </Section>

        <Section title="Termination">
          <p>You may stop using LazyGrip.net at any time. You may request account deletion by emailing admin@lazygrip.net. We may terminate your access at any time for any reason, including violation of these terms.</p>
        </Section>

        <Section title="Changes">
          <p>We may update these terms from time to time. Continued use of the site after changes are posted constitutes your acceptance of the updated terms. We will update the date at the top of this page when changes are made.</p>
        </Section>

        <Section title="Contact">
          <p>Questions about these terms can be sent to <a href="mailto:admin@lazygrip.net" style={{ color: 'var(--accent)', textDecoration: 'none' }}>admin@lazygrip.net</a>.</p>
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
