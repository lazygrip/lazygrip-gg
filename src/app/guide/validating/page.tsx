import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Validating Your Work | GRIP-EMS Guide',
  description: 'How to know your GRIP-EMS sequence is actually working. Warcraft Logs CSV exports as the proof standard for Guardian Druid and beyond.',
}

function Body({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.75, marginBottom: 12 }}>
      {children}
    </p>
  )
}

function MetricRow({ name, target, why }: { name: string; target: string; why: string }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '160px 120px 1fr', gap: 1, borderBottom: '0.5px solid var(--border)' }}>
      <div style={{ padding: '10px 14px', background: 'var(--bg-tertiary)', fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{name}</div>
      <div style={{ padding: '10px 14px', background: 'var(--accent-subtle)', fontSize: 13, color: 'var(--accent-text)', fontFamily: 'var(--font-mono)' }}>{target}</div>
      <div style={{ padding: '10px 14px', background: 'var(--bg-primary)', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{why}</div>
    </div>
  )
}

export default function ValidatingPage() {
  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1.2, marginBottom: 12, color: 'var(--text-primary)' }}>
          Validating your work
        </h1>
        <p style={{ fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.75, maxWidth: 600 }}>
          Gut feel is not validation. Dummy parsing is not validation. Warcraft Logs CSV exports are validation, because they show you exactly how many times each spell fired, in what order, and against what content. Everything else is noise.
        </p>
      </div>

      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 14, color: 'var(--text-primary)' }}>
          Why logs are the standard
        </h2>
        <Body>
          When you are iterating on a sequence, you are making decisions about step order, step frequency, and timing. Your gut tells you the sequence felt good, but your gut does not know whether Ironfur was up for 94% of a fight or 71%. Your gut does not know whether Thrash fired 3.2 times per minute or 2.1. Logs do.
        </Body>
        <Body>
          The specific problem with tank validation is that the consequences of a bad sequence are sometimes invisible in the moment. A sequence with poor Ironfur uptime does not feel dramatically different on a plus 10 where you are significantly overgearing the content. It shows up on a plus 13 when the healer goes dry trying to cover the gaps. Logs let you find those gaps before the key tells you about them the hard way.
        </Body>
        <Body>
          The validation workflow used for every sequence published on LazyGrip is: run the key, export the Warcraft Logs CSV, parse it for the target metrics, adjust the sequence if any metric is out of range, rerun. No sequence gets published before at least two validated keys at relevant difficulty. The V7.1 Guardian sequence has been validated across five keys including plus 13 Pit, plus 13 Darkflame Cleft, plus 13 Seat of the Triumvirate, plus 14 Ara-Kara, and plus 14 Skyreach.
        </Body>
      </section>

      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 14, color: 'var(--text-primary)' }}>
          How to export from Warcraft Logs
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            { n: 1, title: 'Enable logging before the key', body: 'In-game, type /combatlog or go to System then Network and enable Advanced Combat Logging. This needs to be on before you enter the dungeon. If you forget, the log will not have the data you need.' },
            { n: 2, title: 'Upload to Warcraft Logs', body: 'Go to warcraftlogs.com, log in, and use the Warcraft Logs Uploader client to upload your combat log file from the WoW Logs folder. The file is named WoWCombatLog.txt and resets each session, so upload after each key you want to analyze.' },
            { n: 3, title: 'Find your report', body: 'Navigate to the report for the key. Click on your character name to filter to your own casts.' },
            { n: 4, title: 'Export the CSV', body: 'Click the Casts tab, then use the export option to download a CSV of your cast data. This gives you spell name, cast time, and cast count in a format you can filter and sort.' },
            { n: 5, title: 'Parse the numbers', body: 'Filter the CSV by spell name. Count Thrash casts and divide by fight duration in minutes to get CPM. Find Ironfur in the uptime buffs tab rather than the casts tab to get a percentage. Compare against your targets.' },
          ].map(step => (
            <div key={step.n} style={{ display: 'flex', gap: 14, padding: '14px', background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--accent)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, flexShrink: 0, marginTop: 1 }}>
                {step.n}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>{step.title}</div>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.65 }}>{step.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 14, color: 'var(--text-primary)' }}>
          Target metrics: Guardian Druid V7.1
        </h2>
        <Body>
          These are the numbers the V7.1 sequence produces when it is running correctly. Validated across plus 13 and plus 14 content on two separate Guardian Druid characters. If your numbers are significantly outside these ranges, something is structurally wrong with the sequence or the step timing.
        </Body>
        <div style={{ border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', marginBottom: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '160px 120px 1fr', background: 'var(--bg-tertiary)', borderBottom: '0.5px solid var(--border)' }}>
            {['Metric', 'Target', 'Notes'].map(h => (
              <div key={h} style={{ padding: '8px 14px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>{h}</div>
            ))}
          </div>
          <MetricRow name="Thrash % of damage" target="~47%" why="Primary damage and healing source. Below 40% usually means step spacing is off or Thrash is failing too often." />
          <MetricRow name="Ironfur uptime" target="91 to 97%" why="Anything below 85% on a single-target fight is a structural problem. Check step 7/14/21/28 spacing in your sequence." />
          <MetricRow name="Moonfire CPM" target="~1.3 CPM" why="If this is above 3 CPM, MOONSPAM is misconfigured or being replaced with a direct /cast Moonfire. The castsequence gate exists specifically to hold this number." />
          <MetricRow name="Mangle cast count" target="Regular throughout" why="Mangle should fire at most steps that are not Thrash or Ironfur. Investigate if Mangle disappears entirely." />
          <MetricRow name="Incarnation timing" target="3rd keypress" why="Incarnation should fire on the third press of every pull. If it is firing later, something is advancing the sequence before combat starts." />
        </div>
      </section>

      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 14, color: 'var(--text-primary)' }}>
          What bad numbers tell you
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            { symptom: 'Ironfur uptime below 80%', cause: 'Ironfur steps are too far apart in the loop, or GRIP-EMS is holding on a failed step ahead of an Ironfur step too often. Check that [combat] guards are not blocking Ironfur from firing. Ironfur only works in Bear Form in combat, so a missing combat entry step can cascade.' },
            { symptom: 'Thrash CPM very low', cause: 'Thrash is being skipped or the sequence is spending too many steps on other spells. Count the Thrash steps in your sequence and compare to total steps. On a 30-step loop with 11 Thrash steps at 150ms you should see roughly 2.4 Thrash per minute minimum.' },
            { symptom: 'Moonfire at 10+ CPM', cause: 'MOONSPAM is misconfigured. Either the external macro is not named correctly, or you have replaced the macroref step with a direct /cast Moonfire. Rebuild the MOONSPAM macro and re-reference it.' },
            { symptom: 'Incarnation not firing', cause: 'The sequence is not at step 3 when Incarnation is off cooldown. Either resetOnCombat is disabled so the sequence starts mid-loop, or the sequence is advancing pre-pull due to missing [combat] guards on early steps.' },
            { symptom: 'Everything looks fine on dummies but falls apart in keys', cause: 'Dummies do not have movement, interrupts, crowd control, or the latency spikes that real keys have. A sequence that cannot handle brief holds on failed steps will look clean on a dummy and degrade in live content. This is exactly the scenario where hold-on-failure behavior matters most.' },
          ].map(item => (
            <div key={item.symptom} style={{ padding: '14px', background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#e0522a', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{item.symptom}</div>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.65 }}>{item.cause}</p>
            </div>
          ))}
        </div>
      </section>

      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 14, color: 'var(--text-primary)' }}>
          Validating a sequence you did not write
        </h2>
        <Body>
          When you import someone else's sequence, run the same validation process before relying on it in serious content. Published sequences are validated against specific talent builds and specific content levels, and those conditions may not match yours exactly. A Guardian Druid sequence validated on Elune's Chosen with Soul of the Forest will produce different numbers on a different hero talent path because the spells and their interactions are different.
        </Body>
        <Body>
          The talent string is published with every sequence on LazyGrip for this reason. If your talents do not match, treat the sequence as a starting point to adapt rather than a finished product to import and run.
        </Body>
      </section>

      <div style={{ background: 'var(--bg-primary)', border: '0.5px solid rgba(29,158,117,0.3)', borderRadius: 'var(--radius-lg)', padding: '20px 24px', marginBottom: 32 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>Browse validated sequences</div>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 12 }}>
          Every sequence on LazyGrip includes the content type and key level it was validated at. If a sequence does not have validation data listed, treat it accordingly.
        </p>
        <Link href="/browse" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--accent-text)', background: 'var(--accent-subtle)', border: '0.5px solid rgba(29,158,117,0.2)', borderRadius: 'var(--radius-md)', padding: '7px 14px', textDecoration: 'none', fontWeight: 500 }}>
          Browse sequences <ArrowRight size={13} />
        </Link>
      </div>

      <div style={{ paddingTop: 16, borderTop: '0.5px solid var(--border)' }}>
        <Link href="/guide/from-gse" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14, color: 'var(--text-secondary)', textDecoration: 'none' }}>
          Back: Coming from GSE
        </Link>
      </div>
    </div>
  )
}
