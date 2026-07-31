import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'The terms that apply to using LazyGrip.net, posting requirements and verification, and the content standards expected of accounts.',
  alternates: {
    canonical: 'https://lazygrip.net/tos',
  },
  openGraph: {
    title: 'Terms of Service',
    description: 'The terms that apply to using LazyGrip.net, posting requirements and verification, and the content standards expected of accounts.',
    url: 'https://lazygrip.net/tos',
    siteName: 'LazyGrip.net',
    type: 'website',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'LazyGrip.net — GRIP-EMS sequences for World of Warcraft' }],
  },
}

export default function TermsPage() {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 24px' }}>
      <h1 style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 8, color: 'var(--text-primary)' }}>
        Terms of Service
      </h1>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 40 }}>Last updated: July 31, 2026</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.8 }}>

        <div style={{ background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px 24px' }}>
          <h2 style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 10 }}>Agreement</h2>
          <p>Using LazyGrip.net means you agree to these terms. If you do not, do not use the site. This applies to everyone, visitors and registered users alike.</p>
        </div>

        <div style={{ background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px 24px' }}>
          <h2 style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 10 }}>Who Can Use the Site</h2>
          <p>You need to be at least 13 to create an account. Creating one means you are confirming you meet that requirement.</p>
        </div>

        <div style={{ background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px 24px' }}>
          <h2 style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 10 }}>Your Account</h2>
          <p>Everything that happens under your account is your responsibility. Keep your password to yourself. If you think your account has been compromised contact us at admin@lazygrip.net right away. We can suspend or terminate accounts that violate these terms.</p>
        </div>

        <div style={{ background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px 24px' }}>
          <h2 style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 10 }}>Acceptable Use</h2>
          <p>Do not use LazyGrip.net to break laws, harass or threaten other users, post spam or unsolicited ads, try to get into someone else's account, run automated tools against the site, impersonate anyone, or post content that infringes on someone else's intellectual property.</p>
        </div>

        <div style={{ background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px 24px' }}>
          <h2 style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 10 }}>Posting Requirements</h2>
          <p style={{ marginBottom: 12 }}>Anyone can browse and download sequences without an account. Posting a sequence is different: your account needs to be verified and have a display name set before you can publish.</p>
          <p style={{ marginBottom: 12 }}>Verified means your sign-in is fully completed, either a confirmed email address or a finished Discord/Battle.net login. If your account is still showing as pending or unverified, finish that process first. New accounts also need to be a little established before posting: give it about an hour after signing up.</p>
          <p>New accounts are limited in how often they can post while we get to know them. This is to keep low-effort or bad-faith posts off the site. It is not a judgment on you personally, and it eases up as your account ages.</p>
        </div>

        <div style={{ background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px 24px' }}>
          <h2 style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 10 }}>Content Standards</h2>
          <p>Anything you post needs to comply with World of Warcraft's Terms of Service, not reference or require bots or cheat engines, be something you actually have the right to share, and not be misleading or harmful. We can remove content that does not meet these standards without notice.</p>
        </div>

        <div style={{ background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px 24px' }}>
          <h2 style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 10 }}>Your Content</h2>
          <p>You own what you post and you keep owning it. By posting you confirm that you wrote the sequence, or that its author has given you permission to share it. Posting someone else&apos;s sequence without permission is not allowed and we will remove it. By posting you give us a licence to store, display, and distribute your content to other users. That licence ends when you delete the content or close your account, after any backup retention period clears.</p>
        </div>

        <div style={{ background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px 24px' }}>
          <h2 style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 10 }}>Copyright and DMCA</h2>
          <p style={{ marginBottom: 12 }}>If a sequence or other content on this site is yours and you did not agree to it being here, email <a href="mailto:admin@lazygrip.net" style={{ color: 'var(--accent)', textDecoration: 'none' }}>admin@lazygrip.net</a> with the sequence name, the page URL, and how we can tell it is your work. We take it down while we look into it. You do not need to send a legal notice and you do not need a lawyer for this informal route.</p>

          <p style={{ marginBottom: 12 }}>If you want to send a formal DMCA takedown notice instead, our designated agent for copyright notices is:</p>

          <p style={{ marginBottom: 12 }}>
            <strong style={{ color: 'var(--text-primary)', fontWeight: 500 }}>LazyGrip.net DMCA Agent</strong><br />
            Email: <a href="mailto:admin@lazygrip.net" style={{ color: 'var(--accent)', textDecoration: 'none' }}>admin@lazygrip.net</a>
          </p>

          <p style={{ marginBottom: 12 }}>This designation covers both LazyGrip.net and the GRIP-EMS Community forum. We&apos;re in the process of registering this agent with the U.S. Copyright Office.</p>

          <p style={{ marginBottom: 6 }}>A formal notice needs to include:</p>
          <ul style={{ marginBottom: 12, paddingLeft: 20 }}>
            <li>A signature (physical or electronic) from the copyright owner or someone authorized to act for them</li>
            <li>What the copyrighted work is</li>
            <li>What material is infringing and a link to where it is on our site</li>
            <li>Your name, address, phone number, and email</li>
            <li>A statement that you believe in good faith the use isn&apos;t authorized by the copyright owner, their agent, or the law</li>
            <li>A statement, under penalty of perjury, that the notice is accurate and you&apos;re authorized to act for the copyright owner</li>
          </ul>

          <p style={{ marginBottom: 12 }}>We&apos;ll remove or disable the material and let the person who posted it know.</p>

          <p style={{ marginBottom: 6 }}><strong style={{ color: 'var(--text-primary)', fontWeight: 500 }}>If your content gets taken down and you think that was a mistake</strong>, you can send a counter-notice to the same email with:</p>
          <ul style={{ marginBottom: 12, paddingLeft: 20 }}>
            <li>Your signature</li>
            <li>What was removed and where it was before removal</li>
            <li>A statement, under penalty of perjury, that you believe it was removed by mistake or misidentification</li>
            <li>Your name, address, phone number, and a statement that you&apos;ll accept service of process from the person who filed the original notice</li>
          </ul>

          <p style={{ marginBottom: 12 }}>If we get a valid counter-notice, we may restore the content in 10-14 business days unless the original complaining party tells us they&apos;ve filed a lawsuit to keep it down.</p>

          <p style={{ marginBottom: 12 }}><strong style={{ color: 'var(--text-primary)', fontWeight: 500 }}>Repeat infringers.</strong> Accounts with multiple substantiated infringement notices against them will have posting privileges suspended or terminated.</p>

          <p>Knowingly filing a false takedown or counter-notice can carry its own legal liability under 17 U.S.C. § 512(f) — don&apos;t do that.</p>
        </div>

        <div style={{ background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px 24px' }}>
          <h2 style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 10 }}>Enforcement</h2>
          <p>We can investigate violations and remove content, suspend accounts, or terminate access. We do not review everything before it goes up and we are not responsible for what users post.</p>
        </div>

        <div style={{ background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px 24px' }}>
          <h2 style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 10 }}>Disclaimers</h2>
          <p>LazyGrip.net is provided as-is. We do not guarantee the site is always available, that sequences will perform as described, or that any content is error-free. You use sequences from this site at your own risk. LazyGrip.net is a community site, independently owned and operated, with no affiliation with or endorsement from Blizzard Entertainment. It is not an official GRIP-EMS site.</p>
        </div>

        <div style={{ background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px 24px' }}>
          <h2 style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 10 }}>Limits on Liability</h2>
          <p>To the extent the law allows, LazyGrip.net and its operators are not liable for indirect, incidental, or consequential damages from your use of the site. If you have a claim against us the most we owe you is $50.</p>
        </div>

        <div style={{ background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px 24px' }}>
          <h2 style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 10 }}>Termination</h2>
          <p>You can stop using the site whenever you want. Email admin@lazygrip.net to request account deletion. We can terminate your access at any time for any reason including violations of these terms.</p>
        </div>

        <div style={{ background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px 24px' }}>
          <h2 style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 10 }}>Changes</h2>
          <p>We can update these terms. If you keep using the site after changes are posted you are accepting the updated terms. The date at the top of this page will reflect when changes were made.</p>
        </div>

        <div style={{ background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px 24px' }}>
          <h2 style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 10 }}>Contact</h2>
          <p>Send questions to <a href="mailto:admin@lazygrip.net" style={{ color: 'var(--accent)', textDecoration: 'none' }}>admin@lazygrip.net</a>.</p>
        </div>

      </div>
    </div>
  )
}
