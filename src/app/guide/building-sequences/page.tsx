import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Info } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Building Sequences — GRIP-EMS Guide',
  description: 'A real Guardian Druid Mythic+ sequence dissected step by step. The reasoning behind every structural decision in Slowdog\'s Elune M+ V7.1.',
}

function Body({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.75, marginBottom: 12 }}>
      {children}
    </p>
  )
}

function StepBlock({
  n,
  macro,
  title,
  children,
  highlight,
}: {
  n: number
  macro: string
  title: string
  children: React.ReactNode
  highlight?: boolean
}) {
  return (
    <div style={{
      marginBottom: 16,
      border: `0.5px solid ${highlight ? 'rgba(29,158,117,0.35)' : 'var(--border)'}`,
      borderRadius: 'var(--radius-lg)',
      overflow: 'hidden',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 14px',
        background: highlight ? 'var(--accent-subtle)' : 'var(--bg-tertiary)',
        borderBottom: '0.5px solid var(--border)',
      }}>
        <span style={{
          width: 22,
          height: 22,
          borderRadius: '50%',
          background: highlight ? 'var(--accent)' : 'var(--bg-primary)',
          border: `1px solid ${highlight ? 'var(--accent)' : 'var(--border-strong)'}`,
          color: highlight ? 'white' : 'var(--text-muted)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 11,
          fontWeight: 600,
          flexShrink: 0,
        }}>
          {n}
        </span>
        <span style={{ fontSize: 13, fontWeight: 600, color: highlight ? 'var(--accent-text)' : 'var(--text-primary)' }}>
          {title}
        </span>
      </div>
      <div style={{ padding: '12px 14px', background: 'var(--bg-primary)' }}>
        <pre style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          color: 'var(--text-secondary)',
          background: 'var(--bg-tertiary)',
          border: '0.5px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          padding: '10px 12px',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
          lineHeight: 1.6,
          marginBottom: 10,
        }}>
          {macro}
        </pre>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
          {children}
        </div>
      </div>
    </div>
  )
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex',
      gap: 10,
      background: 'rgba(90,141,238,0.08)',
      border: '0.5px solid rgba(90,141,238,0.25)',
      borderRadius: 'var(--radius-md)',
      padding: '12px 14px',
      marginTop: 12,
      marginBottom: 4,
    }}>
      <Info size={14} style={{ color: '#5a8dee', flexShrink: 0, marginTop: 2 }} />
      <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
        {children}
      </div>
    </div>
  )
}

export default function BuildingSequencesPage() {
  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{
          fontSize: 28,
          fontWeight: 600,
          letterSpacing: '-0.03em',
          lineHeight: 1.2,
          marginBottom: 12,
          color: 'var(--text-primary)',
        }}>
          Building sequences
        </h1>
        <p style={{ fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.75, maxWidth: 600 }}>
          The best way to understand how to build a GRIP-EMS sequence is to read one that works and understand why it's built the way it is. This section dissects a real Guardian Druid Mythic+ sequence step by step — not what the spells do, but why the structure is what it is and what breaks if you change it.
        </p>
      </div>

      {/* The sequence */}
      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 8, color: 'var(--text-primary)' }}>
          The sequence: Elune's Chosen M+ V7.1
        </h2>

        <div style={{
          background: 'var(--bg-primary)',
          border: '0.5px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: '16px 20px',
          marginBottom: 20,
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, marginBottom: 12 }}>
            {[
              { label: 'Author', value: 'Slowdog (Sux — Blackwing Lair)' },
              { label: 'Spec', value: 'Guardian Druid' },
              { label: 'Hero talent', value: "Elune's Chosen" },
              { label: 'Content', value: 'Mythic+' },
              { label: 'Step function', value: 'Sequential' },
              { label: 'Reset', value: 'On combat' },
              { label: 'Steps', value: '30' },
              { label: 'Validated', value: '+13 Pit, +13 Darkflame Cleft, +13 Seat of the Triumvirate, +14 Ara-Kara, +14 Skyreach' },
            ].map(stat => (
              <div key={stat.label}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>{stat.label}</div>
                <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>{stat.value}</div>
              </div>
            ))}
          </div>
          <div style={{ paddingTop: 12, borderTop: '0.5px solid var(--border)' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Talent string</div>
            <code style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              color: 'var(--text-secondary)',
              wordBreak: 'break-all',
              lineHeight: 1.5,
              display: 'block',
            }}>
              CgGA8cL7tpvige+kkmGM9zUPWDAAAAAAAAAAAgZmZmFzMjZWmZxMmZZZgZzMGNRmZWmZmZmlZmBAAAAAgZmNDYZbmBjZZAM1MLzyMzMAA2wMAWMGGYWssBYmZmNA
            </code>
          </div>
        </div>

        <Body>
          This sequence runs 30 steps in a Sequential loop with resetOnCombat enabled, meaning it fires the opener every pull and loops through the rotation continuously from there. At 150ms intervals on Razer hardware this produces Thrash at roughly 47% of total damage done, Ironfur uptime in the 91–97% range, and zero deaths across the validated keys. Those numbers are the target, not the starting point — they're what the structure produces when it's working correctly.
        </Body>
        <Body>
          Two modifiers run throughout the entire sequence. Shift fires Frenzied Regeneration on demand without breaking the loop. Ctrl fires Ironfur manually when you need it outside the automatic cycling. Every step except the two MOONSPAM steps and step 15/30 carries both modifier lines so they're always available regardless of where you are in the rotation.
        </Body>
      </section>

      {/* Step by step */}
      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 8, color: 'var(--text-primary)' }}>
          Step-by-step breakdown
        </h2>
        <Body>
          The sequence has a clear internal structure once you see it: an opener block, then a repeating loop built around Thrash and Mangle with Ironfur cycling at fixed intervals, Lunar Beam weaved at positions 5/12/19/26, and MOONSPAM at positions 8/22 handling Moonfire delivery and Barkskin as a reset gate.
        </Body>

        <StepBlock
          n={1}
          title="Opener — target acquisition, auto-attack, Bear Form"
          highlight
          macro={`/targetenemy [noharm][dead]
/startattack
/cast [noform:1, nochanneling] Bear Form; [mod:shift] Frenzied Regeneration; [mod:ctrl] Ironfur`}
        >
          The opener does three things in one step. <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11, background: 'var(--bg-tertiary)', borderRadius: 3, padding: '0 4px' }}>/targetenemy [noharm][dead]</code> acquires a target if you don't have one or if your current target is dead — essential at the start of a pull when you're tabbing through packs. <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11, background: 'var(--bg-tertiary)', borderRadius: 3, padding: '0 4px' }}>/startattack</code> gets auto-attacks rolling immediately. The Bear Form line shifts you in if you're not already in form, using <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11, background: 'var(--bg-tertiary)', borderRadius: 3, padding: '0 4px' }}>[noform:1]</code> as the guard so it doesn't waste a GCD when you're already a bear.

          <Note>
            resetOnCombat means this step fires every time you enter a new pull. Steps 2 through 30 are the loop — step 1 is only ever the opener, not part of the repeating rotation.
          </Note>
        </StepBlock>

        <StepBlock
          n={2}
          title="Thrash"
          macro={`/cast [noform:1, nochanneling] Bear Form; [mod:shift] Frenzied Regeneration; [mod:ctrl] Ironfur
/cast [nomod:shift, nomod:ctrl, combat] Thrash`}
        >
          Thrash fires first because it's the highest-priority ability for Guardian damage and healing. It needs to land as early as possible in the pull and needs to refresh frequently throughout the loop. <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11, background: 'var(--bg-tertiary)', borderRadius: 3, padding: '0 4px' }}>[combat]</code> guards every combat spell in the sequence — without it, the sequence would attempt Thrash out of combat during a pre-pull buffer and either fail or waste the step.

          The <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11, background: 'var(--bg-tertiary)', borderRadius: 3, padding: '0 4px' }}>[nomod:shift, nomod:ctrl]</code> pair on the combat spells is what makes the modifier system work. Without those guards, pressing Shift for Frenzied Regeneration would also attempt to fire Thrash on the same step, which isn't what you want.
        </StepBlock>

        <StepBlock
          n={3}
          title="Incarnation + Mangle"
          highlight
          macro={`/cast [noform:1, nochanneling] Bear Form; [mod:shift] Frenzied Regeneration; [mod:ctrl] Ironfur
/cast [combat] Incarnation: Guardian of Ursoc
/cast [nomod:shift, nomod:ctrl, combat] Mangle`}
        >
          Step 3 is the cooldown step. Incarnation fires immediately on the third press of the key — early enough to catch the initial Thrash tick buff and late enough that Bear Form is guaranteed from step 1. Notice that Incarnation uses <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11, background: 'var(--bg-tertiary)', borderRadius: 3, padding: '0 4px' }}>[combat]</code> only, not <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11, background: 'var(--bg-tertiary)', borderRadius: 3, padding: '0 4px' }}>[nomod:shift, nomod:ctrl, combat]</code>. This is intentional — Incarnation fires regardless of what modifier you're holding, because you never want to accidentally skip it by holding Shift for a Frenzied Regen at the wrong moment.

          Mangle follows on the same step as the combo filler if Incarnation is on cooldown or already active.
        </StepBlock>

        <StepBlock
          n={4}
          title="Thrash"
          macro={`/cast [noform:1, nochanneling] Bear Form; [mod:shift] Frenzied Regeneration; [mod:ctrl] Ironfur
/cast [nomod:shift, nomod:ctrl, combat] Thrash`}
        >
          Thrash again. The pattern throughout this sequence is Thrash, Mangle, Thrash, Mangle with Ironfur and MOONSPAM interspersed at calculated intervals. Thrash appears 11 times across the 30-step loop, which is what produces the 47% damage done figure in logs.
        </StepBlock>

        <StepBlock
          n={5}
          title="Lunar Beam + Mangle"
          macro={`/cast [noform:1, nochanneling] Bear Form; [mod:shift] Frenzied Regeneration; [mod:ctrl] Ironfur
/cast [known:Lunar Beam, combat] Lunar Beam
/cast [nomod:shift, nomod:ctrl, combat] Mangle`}
        >
          The first Lunar Beam weave. <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11, background: 'var(--bg-tertiary)', borderRadius: 3, padding: '0 4px' }}>[known:Lunar Beam]</code> is the conditional that makes this build-agnostic — if the talent isn't taken, the line silently skips and Mangle fires instead. Lunar Beam appears at steps 5, 12, 19, and 26, which spaces it at roughly every 7 steps through the loop to align with its cooldown.
        </StepBlock>

        <StepBlock n={6} title="Thrash" macro={`/cast [noform:1, nochanneling] Bear Form; [mod:shift] Frenzied Regeneration; [mod:ctrl] Ironfur\n/cast [nomod:shift, nomod:ctrl, combat] Thrash`}>
          Thrash.
        </StepBlock>

        <StepBlock
          n={7}
          title="Ironfur (in-sequence)"
          macro={`/cast [noform:1, nochanneling] Bear Form; [mod:shift] Frenzied Regeneration; [mod:ctrl] Ironfur
/cast [nomod:shift, nomod:ctrl, combat] Ironfur`}
        >
          The first in-sequence Ironfur cast. Ironfur appears at steps 7, 14, 21, and 28 — every 7 steps, intentionally aligned with its duration so the buff refreshes before it falls off. This is what produces the 91–97% uptime in logs. The math only works if the sequence actually reaches these steps at the right pace, which is why hold-on-failure behavior matters so much for tank rotations specifically.
        </StepBlock>

        <StepBlock
          n={8}
          title="MOONSPAM — Moonfire delivery and Barkskin"
          highlight
          macro={`/castsequence [nomod, nochanneling] Moonfire, Barkskin
/cast Ironfur`}
        >
          This is the most important step in the sequence and the one that confuses people most when they first read it. MOONSPAM is a named external macro referenced by GRIP-EMS, not a regular step — notice the <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11, background: 'var(--bg-tertiary)', borderRadius: 3, padding: '0 4px' }}>macroref</code> subtype in the raw sequence data.

          The <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11, background: 'var(--bg-tertiary)', borderRadius: 3, padding: '0 4px' }}>/castsequence</code> fires Moonfire first, then Barkskin next time this step is reached (step 22), then resets to Moonfire again. Barkskin's ~60 second cooldown means it fires naturally at roughly the right frequency when paired this way without needing any cooldown tracking.

          The critical design detail is that MOONSPAM cannot be replaced with a direct <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11, background: 'var(--bg-tertiary)', borderRadius: 3, padding: '0 4px' }}>/cast Moonfire</code> inside the sequence. GRIP-EMS does not advance cleanly off instant-cast steps when called directly — Moonfire would fire at 12–14 CPM instead of the intended roughly 1.3 CPM, flooding your rotation with Moonfire casts and collapsing Thrash frequency. The external macro reference is the mechanism that prevents this.

          The bare <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11, background: 'var(--bg-tertiary)', borderRadius: 3, padding: '0 4px' }}>/cast Ironfur</code> on the second line fires unconditionally as an extra Ironfur attempt on this step, since Ironfur is off-GCD and doesn't cost a GCD to attempt.

          <Note>
            To use this sequence you need to create a separate macro named exactly <strong>MOONSPAM</strong> in WoW's regular macro editor with the castsequence line. GRIP-EMS calls it with <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11, background: 'var(--bg-tertiary)', borderRadius: 3, padding: '0 4px' }}>/click MOONSPAM</code> internally. The name must match exactly.
          </Note>
        </StepBlock>

        <div style={{
          padding: '14px 16px',
          background: 'var(--bg-primary)',
          border: '0.5px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          marginBottom: 16,
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
            Steps 9–30: the loop continues
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            Steps 9 through 30 repeat the same pattern established in steps 2–8: Thrash and Mangle alternating, Ironfur at steps 14, 21, and 28, Lunar Beam weaved at steps 12, 19, and 26, MOONSPAM at step 22, and a bare Ironfur at steps 15 and 30 without the nomod guards so it fires regardless of modifier state. Step 30 ends the loop and resets to step 2 on the next press.
          </p>
        </div>
      </section>

      {/* Key structural decisions */}
      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 14, color: 'var(--text-primary)' }}>
          The decisions that matter
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[
            {
              title: 'Why Sequential and not Priority',
              body: 'Priority would always try Thrash first on every keypress, which sounds efficient but produces a different problem — Mangle, Ironfur, and Lunar Beam would only fire when Thrash is on cooldown, which means your Ironfur uptime becomes dependent on Thrash cooldown math rather than the structured cycling the sequence enforces. Sequential gives you predictable step positions and predictable uptime.',
            },
            {
              title: 'Why [combat] on every spell',
              body: 'Without [combat] guards, spam-pressing the key before a pull would advance the sequence through multiple steps before combat starts, meaning you\'d enter the fight at step 4 or 5 instead of step 1. The opener only fires correctly if the sequence is at step 1 when the first combat spell lands. [combat] prevents pre-pull advancement.',
            },
            {
              title: "Why Thrash at 11 of 30 steps",
              body: 'Thrash is both the primary damage source and the primary self-healing source for Guardian Druid running Soul of the Forest. More Thrash means more healing. The sequence is built around maximizing Thrash frequency while still fitting Ironfur cycling and the mandatory cooldowns. 11 steps out of 30 is the result of that tradeoff after log validation.',
            },
            {
              title: 'Why Ironfur every 7 steps',
              body: "Ironfur's base duration is 7 seconds and the sequence runs at roughly one step per GCD at 150ms. Placing Ironfur at every 7th step means a new Ironfur cast lands approximately when the previous one expires. This is the mechanism behind the 91-97% uptime. If you remove Ironfur steps or change their spacing, uptime drops and it shows immediately in logs.",
            },
          ].map(d => (
            <div key={d.title} style={{
              padding: '16px',
              background: 'var(--bg-primary)',
              border: '0.5px solid var(--border)',
              borderRadius: 'var(--radius-md)',
            }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>{d.title}</div>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>{d.body}</p>
            </div>
          ))}
        </div>
      </section>

      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        paddingTop: 16,
        borderTop: '0.5px solid var(--border)',
      }}>
        <Link href="/guide/how-it-works" style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 14,
          color: 'var(--text-secondary)',
          textDecoration: 'none',
        }}>
          ← How it works
        </Link>
        <Link href="/guide/from-gse" style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 14,
          color: 'var(--accent)',
          textDecoration: 'none',
          fontWeight: 500,
        }}>
          Next: Coming from GSE <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  )
}
