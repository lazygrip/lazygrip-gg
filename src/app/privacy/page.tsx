export default function PrivacyPage() {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 24px' }}>
      <h1 style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 8, color: 'var(--text-primary)' }}>
        Privacy Policy
      </h1>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 40 }}>Last updated: May 3, 2026</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.8 }}>

        <div style={{ background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px 24px' }}>
          <h2 style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 10 }}>Overview</h2>
          <p>LazyGrip.net runs on Supabase for the database and authentication, and Vercel for hosting. This page covers what data we collect, what we do with it, and what rights you have. We do not sell your information.</p>
        </div>

        <div style={{ background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px 24px' }}>
          <h2 style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 10 }}>What We Collect</h2>
          <p>When you create an account we collect your email address and the username you pick. We store whatever you post to the site, sequences, comments, and ratings. We also collect basic usage data like page views and sequence view counts to understand how the site is being used.</p>
          <p style={{ marginTop: 12 }}>We do not collect payment information. The site is free and there is nothing to pay for.</p>
        </div>

        <div style={{ background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px 24px' }}>
          <h2 style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 10 }}>How We Use It</h2>
          <p>Your data is used to identify you on the site, show your username on content you post, send account notifications like password resets, keep the site running, and catch abuse. We do not use it for advertising and we do not share it with ad networks.</p>
        </div>

        <div style={{ background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px 24px' }}>
          <h2 style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 10 }}>Third-Party Services</h2>
          <p>Supabase handles the database and authentication. Your account data and content live there. Vercel handles hosting and deployment and may collect anonymized request logs.</p>
        </div>

        <div style={{ background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px 24px' }}>
          <h2 style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 10 }}>Cookies</h2>
          <p>The only cookies we use are for keeping you logged in. No ad tracking, no third-party tracking cookies.</p>
        </div>

        <div style={{ background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px 24px' }}>
          <h2 style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 10 }}>Your Rights</h2>
          <p>You can update your profile from your profile page anytime. You can delete sequences and comments you have posted. If you want your account and personal data fully removed, email <a href="mailto:admin@lazygrip.net" style={{ color: 'var(--accent)', textDecoration: 'none' }}>admin@lazygrip.net</a> with your username and we will take care of it within 30 days.</p>
        </div>

        <div style={{ background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px 24px' }}>
          <h2 style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 10 }}>Data Retention</h2>
          <p>We keep your account data and content as long as your account is open. When your account is deleted your personal information goes with it. Some anonymized usage data may stick around for analytics.</p>
        </div>

        <div style={{ background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px 24px' }}>
          <h2 style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 10 }}>Children</h2>
          <p>This site is not for anyone under 13 and we do not knowingly collect information from children under 13. If you think a child has submitted information to the site contact us at <a href="mailto:admin@lazygrip.net" style={{ color: 'var(--accent)', textDecoration: 'none' }}>admin@lazygrip.net</a> and we will remove it.</p>
        </div>

        <div style={{ background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px 24px' }}>
          <h2 style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 10 }}>Changes</h2>
          <p>We can update this policy. The date at the top will reflect when it last changed. Continued use of the site after updates means you accept the updated policy.</p>
        </div>

        <div style={{ background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px 24px' }}>
          <h2 style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 10 }}>Contact</h2>
          <p>Questions go to <a href="mailto:admin@lazygrip.net" style={{ color: 'var(--accent)', textDecoration: 'none' }}>admin@lazygrip.net</a>.</p>
        </div>

      </div>
    </div>
  )
}
