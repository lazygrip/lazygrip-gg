import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, ExternalLink } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Validating Your Work | GRIP-EMS Guide | LazyGrip.net',
  description: 'How to know your GRIP-EMS sequence is actually working. The Repair module as a first-pass diagnostic, and Warcraft Logs CSV exports as the proof standard for any spec.',
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12, background: 'var(--bg-tertiary)', border: '0.5px solid var(--border-strong)', borderRadius: 'var(--radius-sm)', padding: '1px 6px', color: 'var(--accent-text)' }}>
      {children}
    </code>
  )
}

function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '14px 16px', marginTop: 14, marginBottom: 4 }}>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>{children}</div>
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
        <p style={{ fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.75, maxWidth: 620 }}>
          Gut feel is not validation. Dummy parsing is not validation. A sequence that feels smooth in the training area can still have structural problems that only appear under real pressure. This section covers how to actually verify your sequence is working — starting with the tools built into GRIP-EMS and ending with Warcraft Logs, which is the only standard that tells you the full picture.
        </p>
      </div>

      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 14, color: 'var(--text-primary)' }}>
          Start with the Repair module
        </h2>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.75, marginBottom: 12 }}>
          Before you run any content, run the Repair module. It is the fastest way to catch structural problems that would otherwise waste a key or a raid attempt finding out.
        </p>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.75, marginBottom: 12 }}>
          GRIP-EMS scans your sequence across 13 diagnostic categories: empty steps, oversized steps that exceed WoW&apos;s 255-character limit, stale or renamed spells, duplicate steps, missing variables, broken reset conditions, keybind conflicts, missing metadata, and more. Each issue gets flagged in the editor with a colored health score badge and most can be fixed in a single click.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
          {[
            { cmd: '/gems repair <name>', desc: 'Scan and repair a single sequence by name' },
            { cmd: '/gems repairall', desc: 'Scan every sequence you own in one pass' },
            { cmd: '/gems validate', desc: 'Check all sequences specifically for stale or renamed spells' },
            { cmd: '/gems revalidate', desc: 'Force a full spell revalidation — run this after a patch' },
          ].map(item => (
            <div key={item.cmd} style={{ display: 'flex', gap: 12, alignItems: 'baseline', padding: '9px 14px', background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
              <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--accent-text)', flexShrink: 0, minWidth: 200 }}>{item.cmd}</code>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{item.desc}</span>
            </div>
          ))}
        </div>

        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.75 }}>
          A clean repair pass with a green health score badge means the sequence is structurally sound. It does not mean the step ordering and timing are optimal for your spec — that is what logs are for. Run repair first, then run content, then check logs.
        </p>
        <InfoBox>
          Run /gems repairall after every game patch that touches your spec. Blizzard renames and reshuffles spells with some patches and sequences that were working silently stop working because a spell name no longer resolves. The Repair module catches these and fixes most of them automatically.
        </InfoBox>
      </section>

      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 14, color: 'var(--text-primary)' }}>
          Why logs are the proof standard
        </h2>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.75, marginBottom: 12 }}>
          When you are iterating on a sequence, you are making decisions about step order, step frequency, and timing. Your gut tells you the sequence felt good, but your gut does not know whether your primary maintenance buff was up for 94% of the fight or 71%. Logs do.
        </p>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.75, marginBottom: 12 }}>
          The specific problem with tank and buffer validation is that the consequences of a bad sequence are sometimes invisible in the moment. A sequence with poor defensive uptime does not feel dramatically different on a plus 10 where you are significantly overgearing the content. It shows up on a plus 13 when the healer goes dry covering gaps. Logs let you find those gaps before the key tells you about them the hard way.
        </p>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.75 }}>
          Target dummies have none of the variables that real content introduces: movement, interrupts, crowd control, latency spikes, or the reaction time that interrupts your keypress rhythm. A sequence that looks perfect on a dummy degrades in live content in ways that are only visible in logs. This is exactly the scenario where hold-on-failure behavior matters most and where the gap between a well-structured sequence and a poorly-structured one becomes measurable.
        </p>
      </section>

      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 14, color: 'var(--text-primary)' }}>
          The validation framework for any spec
        </h2>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.75, marginBottom: 16 }}>
          The process is the same regardless of what class you play. The targets you are looking for differ, but the method does not.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
          {[
            {
              step: '1',
              title: 'Identify your two or three most important spells',
              desc: "Before you run anything, know what you are measuring. For a tank this is your primary defensive buff and your main damage ability. For a DPS spec it is your highest priority spell and your major cooldown. Check Icy Veins or your spec Discord for the expected casts per minute of each. These are your targets.",
            },
            {
              step: '2',
              title: 'Enable Advanced Combat Logging before the run',
              desc: "In-game, type /combatlog or go to System > Network and enable Advanced Combat Logging. This must be on before you enter the instance. If you forget, the log will not contain the data you need for cast analysis.",
            },
            {
              step: '3',
              title: 'Run at least two sessions at relevant difficulty',
              desc: "Run the content at the difficulty level you are building the sequence for. A plus 10 gives you different data than a plus 13 because mob damage, movement requirements, and latency pressure are different. Two runs at the same difficulty lets you see whether your numbers are consistent or varying, which tells you whether the sequence is stable.",
            },
            {
              step: '4',
              title: 'Upload to Warcraft Logs and pull your cast data',
              desc: "Upload your combat log at warcraftlogs.com, navigate to your report, click on your character to filter to your casts, and go to the Casts tab. Export the CSV. This gives you spell name, cast count, and cast time for every ability you used.",
            },
            {
              step: '5',
              title: 'Compare against your targets',
              desc: "Filter the CSV by each of your key spells. Divide cast count by fight duration in minutes to get casts per minute. Compare against your Icy Veins or SimCraft targets. If you are within 15% of the expected number, the sequence is in the right range. If a spell is more than 20% below target, there is a structural problem. If a spell drops to zero casts entirely, something is blocking it and it needs immediate attention.",
            },
            {
              step: '6',
              title: 'Adjust and rerun',
              desc: "When you find a number that is out of range, trace it back to the sequence structure. A maintenance buff with low uptime usually means the step spacing is wrong or the spell is being blocked by a failed step ahead of it. A major cooldown firing late usually means resetOnCombat is disabled or something is advancing the sequence pre-pull. Make one structural change at a time and rerun before making another — changing multiple things at once makes it impossible to know which change fixed the problem.",
            },
          ].map(item => (
            <div key={item.step} style={{ display: 'flex', gap: 16, padding: '14px 16px', background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--accent)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, flexShrink: 0 }}>
                {item.step}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>{item.title}</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.65 }}>{item.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 14, color: 'var(--text-primary)' }}>
          Worked example: Guardian Druid target metrics
        </h2>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.75, marginBottom: 16 }}>
          This is what the validation framework looks like applied to the Elune&apos;s Chosen Guardian Druid sequence published on this site. These numbers come from five validated keys at plus 13 and plus 14 difficulty. They are not targets you need to hit on your spec — they are an example of what the framework produces when it is applied correctly to a specific build.
        </p>

        <div style={{ background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden', marginBottom: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: 1, background: 'var(--border)' }}>
            {['Metric', 'Target', 'What it tells you'].map(h => (
              <div key={h} style={{ padding: '10px 14px', background: 'var(--bg-secondary)', fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</div>
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--border)' }}>
            {[
              ['Thrash % of total damage', '~47%', 'Primary damage and healing source. Below 40% means step spacing is off or Thrash is failing too often.'],
              ['Ironfur uptime', '91 to 97%', 'Anything below 85% on a single-target fight is a structural problem. Check the step spacing at positions 7, 14, 21, and 28.'],
              ['Moonfire CPM', '~1.3 CPM', 'Above 3 CPM means MOONSPAM is misconfigured or replaced with a direct /cast Moonfire. The castsequence gate exists specifically to hold this number.'],
              ['Incarnation timing', '3rd keypress', 'Should fire on the third press of every pull. Firing later means something is advancing the sequence before combat starts.'],
              ['Mangle presence', 'Regular throughout', 'If Mangle disappears from the log entirely, a misconfigured conditional is blocking it.'],
            ].map(([metric, target, note], i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: 1, background: 'var(--border)' }}>
                <div style={{ padding: '10px 14px', background: 'var(--bg-primary)', fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>{metric}</div>
                <div style={{ padding: '10px 14px', background: 'var(--accent-subtle)', fontSize: 13, color: 'var(--accent)' }}>{target}</div>
                <div style={{ padding: '10px 14px', background: 'var(--bg-primary)', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{note}</div>
              </div>
            ))}
          </div>
        </div>

        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.75 }}>
          To build the equivalent table for your spec, take your two or three highest value spells from the Icy Veins priority list, find their expected CPM or uptime percentage from SimCraft or your spec Discord, and use those as your targets. The diagnostic logic is the same — if a spell is significantly below target, trace it back to the step structure.
        </p>
      </section>

      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 14, color: 'var(--text-primary)' }}>
          What bad numbers tell you
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            {
              signal: 'A high-priority spell has significantly lower CPM than expected',
              cause: 'Step spacing is wrong, or the spell is getting held too long by failed steps ahead of it. Count how many times that spell appears in your step loop and compare to total steps. If it appears at the right frequency in the sequence but not in logs, something earlier in the loop is stalling.',
            },
            {
              signal: 'A maintenance buff shows below 80% uptime',
              cause: 'Steps for that buff are too far apart in the loop, or [combat] guards are incorrectly blocking it. Check that the buff step does not carry a [combat] conditional that prevents it from firing when you need it, and verify the spacing matches the buff duration.',
            },
            {
              signal: 'Your major cooldown is firing late or not on pull',
              cause: 'resetOnCombat is disabled so the sequence starts mid-loop, or the sequence is advancing pre-pull due to missing [combat] guards on early steps. Check both.',
            },
            {
              signal: 'Numbers look fine on a dummy but fall apart in keys',
              cause: 'Dummies have no movement, interrupts, or latency spikes. A sequence that cannot handle brief holds on failed steps looks clean on a dummy and degrades in live content. This is exactly the scenario where the hold-on-failure behavior matters most and where the dummy gives you a false positive.',
            },
            {
              signal: 'A spell drops to zero casts entirely',
              cause: 'A conditional is misconfigured and blocking the spell completely. Check for typos in the spell name, a [known:] conditional for a talent you do not have, or a modifier guard that is preventing the spell from firing under any conditions.',
            },
            {
              signal: 'The editor shows an orange warning on a spell that is actually working',
              cause: 'Some abilities change names mid-combat based on talents or procs — Raptor Strike becomes Raptor Swipe, Slam upgrades to Heroic Strike via Bloodsurge, hero talent overrides replace the base spell name. GRIP-EMS flags these because the stored name no longer matches what is in your spellbook, but the spell still fires correctly. Run /gems repair to confirm the sequence is structurally sound. If repair comes back clean and the spell is casting in logs, the warning is cosmetic and safe to ignore. GRIP-EMS v2.1.10 resolved most of these for known override cases.',
            },
          ].map(item => (
            <div key={item.signal} style={{ padding: '14px 16px', background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>{item.signal}</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.65 }}>{item.cause}</div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 14, color: 'var(--text-primary)' }}>
          Validating a sequence you did not write
        </h2>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.75, marginBottom: 12 }}>
          When you import someone else&apos;s sequence, run the same validation process before relying on it in serious content. Published sequences are validated against specific talent builds and specific content levels, and those conditions may not match yours exactly. A sequence validated on one hero talent path with one set of tier bonuses will produce different numbers on a different configuration because the spells and their interactions are different.
        </p>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.75 }}>
          Every sequence on LazyGrip includes the talent string it was validated with. If your talents do not match, the sequence is worth importing as a structural reference but treat it as a starting point rather than a finished product. Two runs at your target difficulty with log analysis takes about thirty minutes and tells you everything you need to know about whether it needs tuning for your setup.
        </p>
        <InfoBox>
          The validation workflow used for every sequence published on LazyGrip is: run the content, export the Warcraft Logs CSV, check the key metrics, adjust one thing if a metric is out of range, rerun. No sequence gets published before at least two validated runs at relevant difficulty.
        </InfoBox>
      </section>

      <div style={{ padding: '14px 18px', background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Ready to find a validated sequence to start from?</span>
        <Link href="/browse" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>
          Browse sequences <ExternalLink size={12} />
        </Link>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-start', paddingTop: 16, borderTop: '0.5px solid var(--border)' }}>
        <Link href="/guide/from-gse" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14, color: 'var(--text-tertiary)', textDecoration: 'none' }}>
          <ArrowLeft size={14} /> Coming from GSE
        </Link>
      </div>
    </div>
  )
}
