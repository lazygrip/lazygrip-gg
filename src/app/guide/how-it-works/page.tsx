import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, ArrowLeft } from 'lucide-react'

export const metadata: Metadata = {
  title: 'How GRIP-EMS Works | GRIP-EMS Guide | LazyGrip.net',
  description: 'The mental model behind GRIP-EMS: the secure execution environment, step functions, reset conditions, and how the engine actually advances through your rotation.',
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

function CompareRow({ label, grip, gse }: { label: string; grip: string; gse: string }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1 }}>
      <div style={{ padding: '10px 14px', background: 'var(--bg-primary)', fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>{label}</div>
      <div style={{ padding: '10px 14px', background: 'var(--accent-subtle)', fontSize: 13, color: 'var(--text-secondary)' }}>{grip}</div>
      <div style={{ padding: '10px 14px', background: 'var(--bg-primary)', fontSize: 13, color: 'var(--text-secondary)' }}>{gse}</div>
    </div>
  )
}

export default function HowItWorksPage() {
  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1.2, marginBottom: 12, color: 'var(--text-primary)' }}>
          How GRIP-EMS works
        </h1>
        <p style={{ fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.75, maxWidth: 620 }}>
          Before you build a sequence, you need the right mental model. Two things in particular will save you hours of confusion: understanding what WoW restricts inside macros and why, and understanding exactly how GRIP-EMS decides which step fires next. Getting either of these wrong is what produces sequences that look correct in the editor but behave strangely in actual content.
        </p>
      </div>

      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 14, color: 'var(--text-primary)' }}>
          The secure execution environment
        </h2>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.75, marginBottom: 12 }}>
          WoW runs addon code that touches combat inside a restricted sandbox called the secure execution environment. Blizzard built this specifically to prevent addons from making combat decisions automatically. Reading your current health, checking a boss cast timer, counting combo points, tracking resource levels, all of that is blocked inside a macro step because it would allow the addon to decide when to cast something rather than you deciding when to press a button.
        </p>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.75, marginBottom: 12 }}>
          This catches people who come from programming backgrounds and assume they can write conditional logic into sequences. The most common attempt is something like checking a resource value with <Code>UnitPower(&quot;player&quot;)</Code> or tracking time with <Code>GetTime()</Code>. Both of those return nil inside a secure handler because they are part of the restricted API. The sequence does not fail gracefully when this happens, it crashes silently and the step does nothing.
        </p>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.75, marginBottom: 12 }}>
          What you can use inside sequence steps is WoW&apos;s standard macro conditional system: <Code>[combat]</Code>, <Code>[mod:shift]</Code>, <Code>[known:SpellName]</Code>, <Code>[noform:1]</Code>, <Code>[nochanneling]</Code>, and the rest of the documented macro conditional set. These are not API calls. They are tokens the macro engine parses directly, and they are permitted because they do not read arbitrary game state at the Lua level.
        </p>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.75 }}>
          The IF action node system in GRIP-EMS works within this same constraint. When you build an IF node with a True and False branch, the addon compiles it down to a standard WoW conditional line like <Code>/cast [mod:shift] Bestial Wrath; Cobra Shot</Code>. You are not writing real branching logic, you are building a visual interface for generating valid WoW macro conditional syntax. The result is the same thing WoW has always allowed, just assembled in a more structured way.
        </p>
        <InfoBox>
          GRIP-EMS&apos;s Variables system exists partly to work around the secure execution limitation. Variables are resolved outside the secure environment before the macro compiles, which means you can use them to make conditional decisions that would be impossible inside a step directly. The Variables tab in the editor is where you set these up.
        </InfoBox>
      </section>

      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 14, color: 'var(--text-primary)' }}>
          How the step engine advances
        </h2>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.75, marginBottom: 12 }}>
          GRIP-EMS uses Sequential step function by default, meaning it fires step 1, then step 2, then step 3, and loops back to step 1 after the last step. One advance per keypress. The part that matters for how you design sequences is what happens when a step fails to cast.
        </p>

        <div style={{ marginBottom: 16, background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1, background: 'var(--border)' }}>
            <div style={{ padding: '10px 14px', background: 'var(--bg-secondary)', fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}></div>
            <div style={{ padding: '10px 14px', background: 'var(--bg-secondary)', fontSize: 12, fontWeight: 600, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>GRIP-EMS</div>
            <div style={{ padding: '10px 14px', background: 'var(--bg-secondary)', fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>GSE</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--border)' }}>
            <CompareRow label="Failed cast" grip="Holds on the current step until the cast succeeds" gse="Skips the step and advances to the next one" />
            <CompareRow label="Effect on rotation" grip="Step positions stay meaningful and predictable" gse="Skipped steps push later steps forward each loop" />
            <CompareRow label="Best for" grip="Tank rotations, buff uptime, cooldown timing" gse="DPS rotations where skipping a failed step is acceptable" />
          </div>
        </div>

        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.75, marginBottom: 12 }}>
          For DPS sequences at normal or heroic difficulty, the difference between hold and skip is minor. A skipped Fireball because you were moving costs you one cast and the rotation recovers quickly. For tank sequences in Mythic+ it compounds differently. If Ironfur fails because the GCD has not cleared and the sequence skips ahead, that Ironfur step does not appear again until the next full loop. At 30 steps and 150ms per step that is roughly 4.5 seconds without Ironfur attempting. When three Ironfur steps in a row skip on a hard pull, your uptime collapses for that window and it shows up in your logs.
        </p>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.75 }}>
          Hold behavior means the sequence waits for the cast to land before moving on. Your step positions stay meaningful and your uptime numbers stay consistent pull to pull, which is what makes log-based validation reliable. If the sequence advanced unpredictably, comparing two runs would tell you very little.
        </p>
      </section>

      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 14, color: 'var(--text-primary)' }}>
          The four step functions
        </h2>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.75, marginBottom: 16 }}>
          The step function controls how the engine decides which step fires next on each keypress. Most sequences use Sequential. The others exist for specific situations.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            {
              name: 'Sequential',
              tag: 'Default',
              desc: 'Fires step 1, then 2, then 3, then loops to 1. One advance per keypress. Use this for any rotation where order matters, including tank defensive cycling, opener sequences, anything where a spell at step 8 is supposed to follow the spells at steps 1 through 7. This is the right choice for the majority of sequences.',
            },
            {
              name: 'Priority',
              tag: null,
              desc: 'On every keypress, starts from step 1 and fires the first step that succeeds. Steps that are on cooldown, out of range, or otherwise unavailable get skipped and the engine tries the next one. Good for DPS rotations where you always want your highest priority spell to fire when available, regardless of what fired last press.',
            },
            {
              name: 'Reverse Priority',
              tag: null,
              desc: 'Same as Priority but starting from the last step and working backwards. In practice your lowest-priority step fires most of the time because it is the easiest to satisfy and gets checked last in the forward direction. Avoid for finisher steps in resource-based rotations, because finishers almost never get a turn because something earlier keeps succeeding.',
            },
            {
              name: 'Random',
              tag: null,
              desc: 'Fires a random step each press. Useful for very specific situations like randomizing proc timing to avoid predictable patterns. Not useful for structured rotations.',
            },
          ].map(fn => (
            <div key={fn.name} style={{ padding: '14px 16px', background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{fn.name}</span>
                {fn.tag && <span style={{ fontSize: 11, color: 'var(--accent)', background: 'var(--accent-subtle)', border: '0.5px solid rgba(29,158,117,0.2)', borderRadius: 99, padding: '1px 8px' }}>{fn.tag}</span>}
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.65, margin: 0 }}>{fn.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 14, color: 'var(--text-primary)' }}>
          Reset conditions
        </h2>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.75, marginBottom: 16 }}>
          Reset conditions send the sequence back to step 1. They can be combined, and the right combination depends on what your sequence is designed to do.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            { name: 'Reset on combat end', desc: 'Resets to step 1 when you leave combat. Most sequences should have this enabled so your opener fires correctly at the start of each pull rather than picking up mid-loop from the previous fight.' },
            { name: 'Reset on target change', desc: 'Resets when your target changes. Useful for sequences with a target-specific opener you want to replay on each new enemy, common in AoE dungeon situations.' },
            { name: 'Reset on spec change', desc: 'Resets when you switch specs. Usually unnecessary if your sequences are spec-specific to begin with, but useful as a safety net.' },
            { name: 'Reset on gear swap', desc: 'Resets when you change equipment. Relevant if you use gear sets that shift your stat priorities mid-session.' },
            { name: 'Timer reset', desc: 'Resets after a set number of seconds without a keypress. Good as a fallback for sequences that get stuck mid-rotation during an interruption, crowd control, or a movement phase.' },
          ].map(r => (
            <div key={r.name} style={{ display: 'flex', gap: 14, padding: '12px 16px', background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>{r.name}</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{r.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 14, color: 'var(--text-primary)' }}>
          Pausing a sequence mid-rotation
        </h2>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.75, marginBottom: 12 }}>
          The correct way to pause a running sequence without losing your step position is Hold to Freeze. Hold your sequence keybind down and the sequence freezes on the current step, then resumes from exactly that step the moment you release. You stay in the same position in the loop and nothing resets.
        </p>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.75, marginBottom: 12 }}>
          The common mistake is trying to use <Code>[nomod]</Code> guards to suppress firing during movement or crowd control phases. This does not work reliably because nomod checks fire on every press and the interaction with the secure engine means the guard sometimes passes when it should not, advancing the step position anyway. Hold to Freeze is the intended solution and it is the one that actually works consistently.
        </p>
        <InfoBox>
          Hold to Freeze was added in v2.1.8. If you built a workaround using nomod guards before that version, remove it and use Hold to Freeze instead.
        </InfoBox>
      </section>

      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 14, color: 'var(--text-primary)' }}>
          Variables and tilde references
        </h2>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.75, marginBottom: 12 }}>
          Variables in GRIP-EMS are text substitutions, not macro conditionals. When you reference a variable with a tilde like <Code>~MyVar~</Code> inside a step, GRIP-EMS replaces that token with the variable&apos;s current value before the macro compiles. The result is a static string that WoW executes, not dynamic logic that evaluates at runtime.
        </p>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.75, marginBottom: 12 }}>
          This matters because it changes what variables can and cannot do. You can use a variable to store a spell name, a modifier string, or a conditional fragment and have it substituted into multiple steps at once, which is useful for sequences where the same conditional appears in several places and you want to change it in one spot. What you cannot do is use a variable to hold a value that changes mid-combat, because the substitution happens at compile time, not on each keypress.
        </p>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.75 }}>
          Variables are resolved outside the secure execution environment, which is why they can contain things that would be blocked inside a step directly. The substitution happens before the macro enters the sandbox, so the compiled output only contains valid macro syntax by the time WoW sees it.
        </p>
      </section>

      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 14, color: 'var(--text-primary)' }}>
          The Tempo Advisor
        </h2>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.75, marginBottom: 12 }}>
          Clicking too fast wastes keypresses on steps that are not ready yet. Clicking too slow leaves GCDs empty. The right click rate is different for every sequence because it depends on the specific spells, their cast times, and your latency.
        </p>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.75, marginBottom: 12 }}>
          The Tempo Advisor solves this. It analyzes every spell in your sequence, classifies each one by timing category, reads your current latency and SpellQueueWindow, and calculates the optimal click interval. It starts with a theoretical estimate immediately and blends in your actual combat data after 30 play samples. Enable it with <Code>/gems fs on</Code> and a movable overlay appears showing whether to click faster or slower, your current clicks per second, and the confidence level of the recommendation.
        </p>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.75 }}>
          Recommendations are stored per sequence, per spec, and per character. Your Beast Mastery Hunter rotation gets a different recommendation than your Guardian Druid rotation, and both are stored separately. Once a sequence reaches 30 samples the confidence switches from Estimated to Calibrated and the recommendation becomes more accurate over time as you play.
        </p>
      </section>

      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 14, color: 'var(--text-primary)' }}>
          The visual editor versus what actually executes
        </h2>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.75, marginBottom: 12 }}>
          This causes real confusion in the Discord regularly. GRIP-EMS has two separate things: the visual preview of your sequence in the editor, and the compiled macro output that WoW actually executes when you press your keybind. They are not identical.
        </p>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.75, marginBottom: 12 }}>
          The visual layer renders steps it can match against known spells in its database. Steps it cannot match, including certain raw macro lines, some conditional constructs, spells from a different spec, do not display in the preview. But they still exist in the compiled output and WoW executes them correctly. A step that is invisible in the editor is not a broken step.
        </p>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.75 }}>
          If you see fewer steps in the preview than you built, switch to the <strong style={{ color: 'var(--text-primary)' }}>Macros tab</strong> in the editor. That shows the final compiled macro text for each step exactly as WoW will see it. If a step shows there with correct syntax, it is working regardless of whether the visual layer renders it.
        </p>
      </section>

      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 14, color: 'var(--text-primary)' }}>
          Per-step Disable
        </h2>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.75, marginBottom: 12 }}>
          Any step in a sequence can be disabled at runtime without deleting it. Right-click the step in the editor and select Disable. The step stays in your sequence structure and remains visible in the editor so you know it is there, but GRIP-EMS skips it during execution as if it does not exist. Re-enable it the same way.
        </p>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.75, marginBottom: 12 }}>
          This is useful for testing step contributions without permanently removing them, and for building sequences that can be trimmed for different situations without maintaining separate versions. Disable a cooldown step for a dungeon where you want manual control, re-enable it for raid.
        </p>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.75 }}>
          Disabling an entire sequence goes further: it drops off the tracker and clears its ghost from your action bar immediately. It does not just stop executing, it disappears from the UI entirely until you re-enable it.
        </p>
      </section>

      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 14, color: 'var(--text-primary)' }}>
          Keybind behavior during skyriding and vehicles
        </h2>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.75, marginBottom: 12 }}>
          Before v2.1.14, mounting a dragonriding mount, entering a vehicle, or getting possessed would kill your bound sequence key. You would land, press your keybind, get nothing, and have to go back into the editor to rebind it. This happened because GRIP-EMS suspended the keybind during those states and the restore did not always complete correctly.
        </p>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.75 }}>
          As of v2.1.14 the suspend-and-restore logic runs inside the secure engine as a proper attribute driver rather than a Lua heartbeat, so the keybind survives the transition in both directions and fires correctly the moment you land or exit the vehicle. If your key stopped working after skyriding on an older version, update to v2.1.14 and the problem is gone.
        </p>
      </section>

      <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 16, borderTop: '0.5px solid var(--border)' }}>
        <Link href="/guide/installation" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14, color: 'var(--text-tertiary)', textDecoration: 'none' }}>
          <ArrowLeft size={14} /> Installation
        </Link>
        <Link href="/guide/building-sequences" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14, color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>
          Next: Building sequences <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  )
}
