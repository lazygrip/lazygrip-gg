import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Settings | GRIP-EMS Guide | LazyGrip.net',
  description: 'The GRIP-EMS settings that actually determine whether your sequences run smoothly. SQW, Key Down Casting, click rate, the Dynamic SQW Optimiser, the Tempo Advisor, and how they all connect.',
}

export default function SettingsPage() {
  return (
    <div style={{ maxWidth: 720 }}>
      <nav style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 24, display: 'flex', gap: 6, alignItems: 'center' }}>
        <Link href="/guide" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>Guide</Link>
        <span>/</span>
        <span style={{ color: 'var(--text-primary)' }}>Settings</span>
      </nav>

      <h1 style={{ fontSize: 32, fontWeight: 700, letterSpacing: '-0.03em', marginBottom: 12 }}>
        Settings
      </h1>
      <p style={{ fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 8 }}>
        A quick note on terminology before anything else. <strong style={{ color: 'var(--text-primary)' }}>ms</strong> means milliseconds. 1000ms is one second. Your <strong style={{ color: 'var(--text-primary)' }}>latency</strong> is your ping, the world-ms number WoW shows you in the network display. It comes up a lot below.
      </p>
      <p style={{ fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 40 }}>
        Installing GRIP-EMS is the easy part. The settings that determine whether your sequences feel smooth or stuttery are spread across three different WoW menus; none of them are set correctly by default, and most guides either skip them entirely or mention them once without explaining what they do. This page covers all of them and explains the why behind each one, because knowing why lets you tune them for your setup instead of just copying someone else's numbers.
      </p>

      <Section title="Key Down Casting">
        <p style={{ marginBottom: 4, fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Settings {'>'} CVar Health {'>'} Macro Sequencing</p>
        <p>This is the WoW setting <code style={code}>ActionButtonUseKeyDown</code>. It controls whether your abilities fire when you <strong style={{ color: 'var(--text-primary)' }}>press</strong> a key or when you <strong style={{ color: 'var(--text-primary)' }}>release</strong> it. GRIP-EMS fires on the press, and it needs this set to on to work correctly. Leave it off, and your sequence either does not advance at all or advances on the wrong event, with an extra 50 to 100ms of dead time on every single press, eating into your rotation.</p>
        <p style={{ marginTop: 12 }}>This is the one setting on this entire page that is not a preference. Everything else is tuning. This one is mandatory.</p>
        <p style={{ marginTop: 12 }}>The Installation page covers how to fix it through the CVar Health tab. If you have not done that yet, start there.</p>
        <Callout>
          Set your CVar Health settings outside of combat. WoW locks some of these while you are in a fight, which is why the Fix buttons grey out mid-pull. Sort it at a target dummy before you queue.
        </Callout>
      </Section>

      <Section title="Spell Queue Window">
        <p style={{ marginBottom: 4, fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Settings {'>'} CVar Health {'>'} Macro Sequencing</p>
        <p>The WoW setting <code style={code}>SpellQueueWindow</code>. This controls how many milliseconds before a GCD ends WoW will accept your next cast input. Blizzard's default is 400ms, which is also the ceiling. WoW calls this Custom Lag Tolerance under Options {'>'} Network. GRIP-EMS surfaces it in CVar Health so you do not have to go hunting for it.</p>
        <p style={{ marginTop: 12 }}>The way it works: say your GCD is 1.5 seconds. With SQW at 400ms, the queue window opens at 1100ms into that GCD. Any press inside that window gets queued. The last press before the GCD ends is the one that fires, replacing anything queued before it.</p>

        <div style={{
          marginTop: 16,
          padding: '14px 16px',
          background: 'var(--bg-primary)',
          border: '0.5px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          fontSize: 13,
          color: 'var(--text-secondary)',
          lineHeight: 1.6,
        }}>
          <strong style={{ color: 'var(--text-primary)' }}>Example:</strong> GCD is 1.5s, SQW is 400ms. Queue window opens at 1100ms. You press at 1200ms and again at 1450ms. The 1450ms press is what fires.
        </div>

        <Callout>
          The trap most people fall into: setting SQW lower than your latency. If your ping is 120ms and you force SQW down to 50ms, your queued press can reach the server too late to register, which means dead GCDs and a rotation that feels like it skips. SQW must always be higher than your latency. If you are unsure, leave the Dynamic SQW Optimiser on and let it handle the math for you.
        </Callout>
      </Section>

      <Section title="Dynamic SQW Optimiser">
        <p style={{ marginBottom: 4, fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Settings {'>'} CVar Health</p>
        <p>This is the setting that does the SQW math for you and keeps it updated as your connection moves around during a session. It continuously monitors your world latency, using a smoothed average sampled every 10 seconds, ignoring one-off spikes that would otherwise throw your numbers off. From that, it sets SQW to your current latency plus a configurable Safety Buffer, kept inside the 50 to 400ms ceiling.</p>
        <p style={{ marginTop: 12 }}>So if your latency is 120ms and your Safety Buffer is 50ms, SQW lands at around 170ms. Your latency jumps to 160ms mid-key, SQW adjusts.</p>

        <div style={{ padding: '12px 14px', background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>Safety Buffer</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>Yours to set between 50 and 200ms. Higher buffer means fewer dropped presses, lower feels snappier. 100ms is a sensible middle ground for most players. If your connection is stable and low-latency, push it lower. If it is inconsistent, go higher.</div>
        </div>

        <p style={{ marginTop: 16 }}>While the Optimiser is running, it has exclusive control over the SQW value. You will see "Managed by SQW Optimiser" in the manual control and the slider locks. If you want to set SQW by hand, turn the Optimiser off first.</p>
        <Callout>
          The SQW Optimiser tunes one thing: the SpellQueueWindow CVar, based on your latency. It does not look at your sequence, your spells, or your click rate. For a recommendation on how fast you should actually be pressing your keybind, that is the Tempo Advisor below, a separate system entirely.
        </Callout>
      </Section>

      <Section title="Click Rate">
        <p style={{ marginBottom: 4, fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Settings {'>'} General</p>
        <p>How fast you are pressing your sequence key, in milliseconds. GRIP-EMS advances one step per keypress and does not cap how fast you press, so this number is really a reference point that also controls the timing of any imported pauses in a sequence. The default is 250ms, and the slider will not go below 100ms.</p>
        <p style={{ marginTop: 12 }}>The reason it floors at 100ms is that nobody is realistically pressing a key faster than ten times a second, and at that speed, you would be running past steps before the spells they contain can land. GRIP-EMS calls 100ms the human and hardware floor.</p>
        <p style={{ marginTop: 12 }}><strong style={{ color: 'var(--text-primary)' }}>Per-Character Click Rate</strong>, under the same menu, is a setting scoped to your current character only and overrides the global value while that character is active. Range is 0 to 1000ms in steps of 10. Set it to 0 to fall back to the shared global value. This is also the only way to go below the 100ms floor if you have an edge case that needs it, down to 10ms. GRIP-EMS will pop a warning on screen when you drop under 100.</p>
        <Callout>
          Pressing faster than your spells can land does not make your rotation faster. The GCD is the real speed limit, around 1.5 seconds for most specs and shorter with haste. If you are pressing at 80ms and your GCD is 1.4 seconds, you are firing roughly 17 keypresses per GCD and advancing the sequence 17 steps before a single spell lands. That is not a faster rotation; it is a broken one. The sweet spot is pressing at roughly your cast pace, and the Tempo Advisor below is the most personalized way to find that number for your character in real time.
        </Callout>
      </Section>

      <Section title="Tempo Advisor">
        <p style={{ marginBottom: 4, fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Settings {'>'} Faster/Slower</p>
        <p>This is a different system from the SQW Optimiser above, and it is worth being precise about the difference because the two get confused constantly in the Discord. The SQW Optimiser tunes a WoW CVar based on your latency. The Tempo Advisor analyses your actual sequence and your actual play to recommend a click rate, in milliseconds between keypresses, that fits how that specific sequence is built and how you actually play it.</p>
        <p style={{ marginTop: 12 }}>It starts from a theoretical estimate the moment you save a sequence: it classifies every spell into one of seven timing categories (off-GCD, on-GCD instant, on-GCD with a cast time, a long cast, a channel, a pause step, or unknown if the spell data is not cached yet), builds a transition graph between your steps, and sums GCD durations and cast times across that graph to estimate the time between presses your sequence actually needs.</p>
        <p style={{ marginTop: 12 }}>That estimate gets more accurate the more you play. After 30 logged samples from the addon's execution tracer, the Advisor blends real combat data into the recommendation at a 70% theoretical, 30% empirical mix, and discards stale samples automatically so an old patch or a respec does not keep skewing the number. Every sequence stores its own recommendation, sample count, and blend ratio, and it persists across sessions rather than resetting every login.</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
          {[
            { label: 'Estimated', desc: 'Confidence level before 30 play samples are collected. The recommendation is theory-only at this point.' },
            { label: 'Calibrated', desc: 'Confidence level once 30 or more samples are in. The recommendation now reflects how you actually play that sequence.' },
          ].map(r => (
            <div key={r.label} style={{ display: 'flex', gap: 14, fontSize: 14, alignItems: 'flex-start' }}>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)', flexShrink: 0, minWidth: 110 }}>{r.label}</span>
              <span style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>{r.desc}</span>
            </div>
          ))}
        </div>

        <p style={{ marginTop: 16 }}>Turn it on and a movable Faster/Slower overlay shows your current click rate against the recommendation, with a delta bar so you can see at a glance how far off you are. There is an optional rolling CPS sparkline if you want to watch your actual clicks per second over the last few presses, and an opt-in audio alert that plays a sound if your rate drifts too far from the recommendation, useful if you are not watching the overlay during a pull.</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 16 }}>
          {[
            { cmd: '/gems fs', desc: 'Show current Tempo Advisor status' },
            { cmd: '/gems fs on', desc: 'Enable the Faster/Slower overlay' },
            { cmd: '/gems fs off', desc: 'Disable the overlay' },
            { cmd: '/gems fs reset', desc: 'Clear stored data for a sequence and start fresh' },
          ].map(item => (
            <div key={item.cmd} style={{ display: 'flex', gap: 16, alignItems: 'baseline', fontSize: 14 }}>
              <code style={{
                fontFamily: 'var(--font-mono)', fontSize: 12,
                color: 'var(--accent)', background: 'var(--accent-subtle)',
                padding: '2px 8px', borderRadius: 'var(--radius-sm)',
                flexShrink: 0, whiteSpace: 'nowrap',
              }}>
                {item.cmd}
              </code>
              <span style={{ color: 'var(--text-secondary)' }}>{item.desc}</span>
            </div>
          ))}
        </div>

        <Callout>
          Run /gems fs reset after a major rework of a sequence, not just a small tweak. The Advisor is learning the timing of that specific step structure, and feeding it 30 samples from the old version before you swap to the new one will skew the recommendation until enough fresh data overwrites it.
        </Callout>
      </Section>

      <Section title="Spell Cache Viewer">
        <p style={{ marginBottom: 4, fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>/gems spellcache</p>
        <p>The cached spell data GRIP-EMS uses for icon resolution, autocomplete, and the Tempo Advisor's spell classification all lives in one place you can inspect directly. Run <code style={code}>/gems spellcache</code>, search by spell name or spell ID, and see exactly what the addon has stored: icon texture, cast time, cooldown, GCD category, and spell school.</p>
        <p style={{ marginTop: 12 }}>This is the tool to reach for when a spell icon is not resolving on your tracker or action bar, or when the Tempo Advisor is classifying a spell as unknown instead of one of its real timing categories. A stale or missing cache entry, usually from a spell getting renamed or reworked in a patch, is the most common cause of both. Search for the spell here first before assuming something is broken in your sequence itself.</p>
        <p style={{ marginTop: 12 }}>The cache populates on login and updates automatically when you change spec or talents. If a spell is genuinely missing rather than just stale, <code style={code}>/gems revalidate</code> forces a fresh re-tag of every sequence with current spell IDs, which usually resolves it.</p>
      </Section>

      <Section title="Outside programs: AHK, iCue, Synapse, and others">
        <p>External programs that send repeated keypresses work fine with GRIP-EMS. A full keypress is a down event followed by an up event. Your program needs to send both. GRIP-EMS fires on the key-down signal specifically, so a program that sends only an up event or a custom hold signal will not trigger the sequence correctly.</p>
        <p style={{ marginTop: 12 }}>For interval settings: one full keypress every 50ms or slower is a sensible floor. Randomizing slightly, say between 50 and 75ms rather than a fixed number, produces cleaner behavior than a perfectly robotic fixed interval. The click rate guidance above applies here, too. Faster is not better past the point where your spells can actually land.</p>
        <p style={{ marginTop: 12 }}>The key-down requirement is the only thing that is not optional. Everything else is tuning.</p>
      </Section>

      <Section title="How these settings connect">
        <p>The outside program sends keypresses at the rate you set. GRIP-EMS turns each keypress into one sequence step. The GCD is the actual ceiling on how fast spells can land, regardless of how fast you press. SQW controls the window in which your next press is queued into that GCD, and the SQW Optimiser ties that window to your real latency so it is always sized correctly for your connection. The Tempo Advisor is the layer above all of that: it watches your specific sequence and your actual play to tell you the click rate that fits both.</p>
        <p style={{ marginTop: 12 }}>Get Key Down Casting right, let the Optimiser handle SQW, and let the Tempo Advisor tell you where to set your click rate once it has enough data on you. Everything else on this page is fine-tuning from there.</p>
      </Section>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 48, paddingTop: 24, borderTop: '0.5px solid var(--border)' }}>
        <Link href="/guide/installation" style={{ fontSize: 14, color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>
          Back: Installation
        </Link>
        <Link href="/guide/how-it-works" style={{ fontSize: 14, color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>
          Next: How it works
        </Link>
      </div>
    </div>
  )
}

const code: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 12,
  background: 'var(--bg-tertiary)',
  padding: '1px 5px',
  borderRadius: 3,
  color: 'var(--accent)',
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 48 }}>
      <h2 style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 16, color: 'var(--text-primary)' }}>
        {title}
      </h2>
      <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
        {children}
      </div>
    </div>
  )
}

function Callout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      marginTop: 12, padding: '12px 14px',
      background: 'rgba(29,158,117,0.07)',
      border: '0.5px solid rgba(29,158,117,0.25)',
      borderLeft: '3px solid var(--accent)',
      borderRadius: 'var(--radius-md)',
      fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6,
    }}>
      {children}
    </div>
  )
}
