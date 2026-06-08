import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Building Sequences | GRIP-EMS Guide | LazyGrip.net',
  description: 'A real Guardian Druid Mythic+ sequence dissected step by step, with rules for KeyPress usage, Hunter\'s Mark patterns, and the decisions behind sequence structure.',
}

export default function BuildingSequencesPage() {
  return (
    <div style={{ maxWidth: 720 }}>
      <nav style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 24, display: 'flex', gap: 6, alignItems: 'center' }}>
        <Link href="/guide" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>Guide</Link>
        <span>/</span>
        <span style={{ color: 'var(--text-primary)' }}>Building sequences</span>
      </nav>

      <h1 style={{ fontSize: 32, fontWeight: 700, letterSpacing: '-0.03em', marginBottom: 12 }}>
        Building sequences
      </h1>
      <p style={{ fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 40 }}>
        The best way to understand how to build a GRIP-EMS sequence is to read one that works and understand why it is built the way it is. This section dissects a real Guardian Druid Mythic+ sequence step by step, then covers the patterns and decisions that apply across every spec.
      </p>

      <Section title="The sequence: Elune's Chosen M+ V7.1">
        <MetaTable rows={[
          ['Author', 'Slowdog'],
          ['Spec', 'Guardian Druid'],
          ['Hero talent', "Elune's Chosen"],
          ['Content', 'Mythic+'],
          ['Step function', 'Sequential'],
          ['Reset', 'On combat'],
          ['Steps', '30'],
          ['Validated', '+13 Pit, +13 Darkflame Cleft, +13 Seat of the Triumvirate, +14 Ara-Kara, +14 Skyreach'],
        ]} />

        <div style={{
          marginTop: 16, padding: '12px 14px',
          background: 'var(--bg-primary)', border: '0.5px solid var(--border)',
          borderRadius: 'var(--radius-md)',
        }}>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Talent string</p>
          <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11, wordBreak: 'break-all', color: 'var(--text-secondary)' }}>
            CgGA8cL7tpvige+kkmGM9zUPWDAAAAAAAAAAAgZmZmFzMjZWmZxMmZZZgZzMGNRmZWmZmZmlZmBAAAAAgZmNDYZbmBjZZAM1MLzyMzMAA2wMAWMGGYWssBYmZmNA
          </code>
        </div>

        <p style={{ marginTop: 16 }}>This sequence runs 30 steps in a Sequential loop with resetOnCombat enabled, meaning it fires the opener every pull and loops through the rotation continuously from there. At 150ms intervals on Razer hardware this produces Thrash at roughly 47% of total damage done, Ironfur uptime in the 91 to 97% range, and zero deaths across the validated keys.</p>
        <p style={{ marginTop: 12 }}>Two modifiers run throughout the entire sequence. Shift fires Frenzied Regeneration on demand without breaking the loop. Ctrl fires Ironfur manually when you need it outside the automatic cycling. Every step except the two MOONSPAM steps and steps 15 and 30 carries both modifier lines so they are always available regardless of where you are in the rotation.</p>
      </Section>

      <Section title="Step by step breakdown">
        <p>The sequence has a clear internal structure once you see it: an opener block, then a repeating loop built around Thrash and Mangle with Ironfur cycling at fixed intervals, Lunar Beam weaved at positions 5, 12, 19, and 26, and MOONSPAM at positions 8 and 22 handling Moonfire delivery and Barkskin as a reset gate.</p>

        {[
          {
            num: 1,
            label: 'Opener: target acquisition, auto-attack, Bear Form',
            code: `/targetenemy [noharm][dead]
/startattack
/cast [noform:1, nochanneling] Bear Form; [mod:shift] Frenzied Regeneration; [mod:ctrl] Ironfur`,
            notes: `The opener does three things in one step. /targetenemy [noharm][dead] acquires a target if you do not have one or if your current target is dead, which is essential at the start of a pull when you are tabbing through packs. /startattack gets auto attacks rolling immediately. The Bear Form line shifts you in if you are not already in form, using [noform:1] as the guard so it does not waste a GCD when you are already a bear.\n\nresetOnCombat means this step fires every time you enter a new pull. Steps 2 through 30 are the loop. Step 1 is only ever the opener and not part of the repeating rotation.`,
          },
          {
            num: 2,
            label: 'Thrash',
            code: `/cast [noform:1, nochanneling] Bear Form; [mod:shift] Frenzied Regeneration; [mod:ctrl] Ironfur
/cast [nomod:shift, nomod:ctrl, combat] Thrash`,
            notes: `Thrash fires first because it is the highest priority ability for Guardian damage and healing. It needs to land as early as possible in the pull and needs to refresh frequently throughout the loop. The [combat] guard on every combat spell in the sequence prevents the sequence from attempting Thrash out of combat during a pre-pull buffer and wasting the step. The [nomod:shift, nomod:ctrl] pair on the combat spells is what makes the modifier system work. Without those guards, pressing Shift for Frenzied Regeneration would also attempt to fire Thrash on the same step.`,
          },
          {
            num: 3,
            label: 'Incarnation + Mangle',
            code: `/cast [noform:1, nochanneling] Bear Form; [mod:shift] Frenzied Regeneration; [mod:ctrl] Ironfur
/cast [combat] Incarnation: Guardian of Ursoc
/cast [nomod:shift, nomod:ctrl, combat] Mangle`,
            notes: `Step 3 is the cooldown step. Incarnation fires immediately on the third press of the key, early enough to catch the initial Thrash tick buff and late enough that Bear Form is guaranteed from step 1. Notice that Incarnation uses [combat] only and not [nomod:shift, nomod:ctrl, combat]. This is intentional. Incarnation fires regardless of what modifier you are holding because you never want to accidentally skip it by holding Shift for a Frenzied Regen at the wrong moment. Mangle follows as the filler if Incarnation is on cooldown or already active.`,
          },
          {
            num: '4',
            label: 'Thrash',
            code: `/cast [noform:1, nochanneling] Bear Form; [mod:shift] Frenzied Regeneration; [mod:ctrl] Ironfur
/cast [nomod:shift, nomod:ctrl, combat] Thrash`,
            notes: `Thrash again. The pattern throughout this sequence is Thrash, Mangle, Thrash, Mangle with Ironfur and MOONSPAM interspersed at calculated intervals. Thrash appears 11 times across the 30-step loop, which is what produces the 47% damage done figure in logs.`,
          },
          {
            num: 5,
            label: 'Lunar Beam + Mangle',
            code: `/cast [noform:1, nochanneling] Bear Form; [mod:shift] Frenzied Regeneration; [mod:ctrl] Ironfur
/cast [known:Lunar Beam, combat] Lunar Beam
/cast [nomod:shift, nomod:ctrl, combat] Mangle`,
            notes: `The first Lunar Beam weave. [known:Lunar Beam] is the conditional that makes this build-agnostic. If the talent is not taken, the line silently skips and Mangle fires instead. Lunar Beam appears at steps 5, 12, 19, and 26, which spaces it at roughly every 7 steps through the loop to align with its cooldown.`,
          },
          {
            num: 7,
            label: 'Ironfur (in-sequence)',
            code: `/cast [noform:1, nochanneling] Bear Form; [mod:shift] Frenzied Regeneration; [mod:ctrl] Ironfur
/cast [nomod:shift, nomod:ctrl, combat] Ironfur`,
            notes: `The first in-sequence Ironfur cast. Ironfur appears at steps 7, 14, 21, and 28, every 7 steps, intentionally aligned with its duration so the buff refreshes before it falls off. This is what produces the 91 to 97% uptime in logs. The math only works if the sequence actually reaches these steps at the right pace, which is why hold-on-failure behavior matters so much for tank rotations specifically.`,
          },
          {
            num: 8,
            label: 'MOONSPAM: Moonfire delivery and Barkskin',
            code: `/castsequence [nomod, nochanneling] Moonfire, Barkskin
/cast Ironfur`,
            notes: `This is the most important step in the sequence and the one that confuses people most when they first read it. MOONSPAM is a named external macro referenced by GRIP-EMS, not a regular step. The /castsequence fires Moonfire first, then Barkskin the next time this step is reached at step 22, then resets to Moonfire again. Barkskin's roughly 60 second cooldown means it fires naturally at roughly the right frequency when paired this way without needing any cooldown tracking. The critical design detail is that MOONSPAM cannot be replaced with a direct /cast Moonfire inside the sequence. GRIP-EMS does not advance cleanly off instant-cast steps when called directly. Moonfire would fire at 12 to 14 CPM instead of the intended roughly 1.3 CPM, flooding your rotation with Moonfire casts and collapsing Thrash frequency. The external macro reference is the mechanism that prevents this. The bare /cast Ironfur on the second line fires unconditionally as an extra Ironfur attempt on this step since Ironfur is off-GCD and does not cost a GCD to attempt.\n\nTo use this sequence you need to create the MOONSPAM macro first in WoW's regular macro editor with the castsequence line. Then in GRIP-EMS, click Add at the bottom of the steps list, select Macro from the dropdown, and pick MOONSPAM from the dialog that appears. It will show as [M] MOONSPAM in your sequence list. The name must match exactly.`,
          },
        ].map(step => (
          <StepBlock key={step.num} number={String(step.num)} label={step.label} code={step.code} notes={step.notes} />
        ))}

        <div style={{ padding: '14px 16px', background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>Steps 9 through 30: the loop continues</p>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>Steps 9 through 30 repeat the same pattern established in steps 2 through 8: Thrash and Mangle alternating, Ironfur at steps 14, 21, and 28, Lunar Beam weaved at steps 12, 19, and 26, MOONSPAM at step 22, and a bare Ironfur at steps 15 and 30 without the nomod guards so it fires regardless of modifier state. Step 30 ends the loop and resets to step 2 on the next press.</p>
        </div>
      </Section>

      <Section title="The KeyPress field and what it is for">
        <p>GRIP-EMS has a KeyPress field that fires on every single keypress regardless of where the sequence is in its step list. It is not a step in the rotation. It is a persistent header that runs before every step fires.</p>
        <p style={{ marginTop: 12 }}>Modifier handling belongs here and only here. If you put <code style={inlineCode}>[mod:shift]</code> lines inside individual steps instead of in KeyPress, every step has to carry that conditional which eats into the 255-character step limit and reduces CPM across all abilities. Putting modifiers in KeyPress means a single line handles the modifier for every press and your steps stay clean.</p>
        <p style={{ marginTop: 12 }}>There is a meaningful secondary benefit. When modifiers live in KeyPress, the Rotation Preview panel in the GRIP-EMS editor can display your actual spell names instead of showing only the raw conditional text. If your sequence preview shows <code style={inlineCode}>/cast [mod:shift]</code> instead of the spell name, the modifier is in the steps rather than in KeyPress.</p>
        <Callout>
          Do not put combat spells in KeyPress. Anything in KeyPress fires on every single keypress including before combat, during movement, and any other context where you press the key. Modifiers and channel-stop lines belong there. Rotation spells belong in steps.
        </Callout>
      </Section>

      <Section title="The reset=target castsequence pattern">
        <p>Some abilities should fire once on each new target rather than on a timer or as a rotation step. Hunter's Mark is the canonical example. You want it to apply when you engage a target, reapply when you switch targets, and not spam continuously on every keypress.</p>
        <p style={{ marginTop: 12 }}>The correct pattern for this in GRIP-EMS is a castsequence with a target reset, placed in a step near the top of the loop:</p>

        <CodeBlock>/castsequence [nochanneling,exists] reset=target Hunter's Mark, null</CodeBlock>

        <p style={{ marginTop: 12 }}>This fires Hunter's Mark on the first press after you acquire a target, then advances the castsequence to <code style={inlineCode}>null</code>, which is a no-op. The sequence stays on null for every subsequent press against that target, so Hunter's Mark does not repeat. When you switch targets the castsequence resets to Hunter's Mark and fires again on the first press.</p>
        <p style={{ marginTop: 12 }}>The <code style={inlineCode}>[exists]</code> conditional prevents the line from attempting to fire when you have no target. The <code style={inlineCode}>[nochanneling]</code> prevents it from interrupting a channel. Both guards are necessary for the pattern to work cleanly in M+ where target switching is frequent.</p>
        <p style={{ marginTop: 12 }}>The same pattern works for any ability you want to fire once per target: Faerie Fire, Misdirection to a specific target, any debuff that should land on engage and reapply on target change. Swap Hunter's Mark for the ability name and the behavior is identical.</p>
        <Callout>
          Do not put Hunter's Mark in KeyPress. KeyPress fires on every keypress, so Hunter's Mark would attempt to cast continuously. The reset=target castsequence is the correct approach.
        </Callout>
      </Section>

      <Section title="The decisions that matter">
        <DecisionBlock
          question="Why Sequential and not Priority"
          answer="Priority would always try Thrash first on every keypress, which sounds efficient but produces a different problem. Mangle, Ironfur, and Lunar Beam would only fire when Thrash is on cooldown, which means your Ironfur uptime becomes dependent on Thrash cooldown math rather than the structured cycling the sequence enforces. Sequential gives you predictable step positions and predictable uptime."
        />
        <DecisionBlock
          question="Why [combat] on every spell"
          answer="Without [combat] guards, spam-pressing the key before a pull would advance the sequence through multiple steps before combat starts, meaning you would enter the fight at step 4 or 5 instead of step 1. The opener only fires correctly if the sequence is at step 1 when the first combat spell lands."
        />
        <DecisionBlock
          question="Why Thrash at 11 of 30 steps"
          answer="Thrash is both the primary damage source and the primary self-healing source for Guardian Druid running Soul of the Forest. More Thrash means more healing. The sequence is built around maximizing Thrash frequency while still fitting Ironfur cycling and the mandatory cooldowns. 11 steps out of 30 is the result of that tradeoff after log validation."
        />
        <DecisionBlock
          question="Why Ironfur every 7 steps"
          answer="Ironfur's base duration is 7 seconds and the sequence runs at roughly one step per GCD at 150ms. Placing Ironfur at every 7th step means a new Ironfur cast lands approximately when the previous one expires. This is the mechanism behind the 91 to 97% uptime. If you remove Ironfur steps or change their spacing, uptime drops and it shows immediately in logs."
        />
      </Section>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 48, paddingTop: 24, borderTop: '0.5px solid var(--border)' }}>
        <Link href="/guide/how-it-works" style={{ fontSize: 14, color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>
          ← Back: How it works
        </Link>
        <Link href="/guide/from-gse" style={{ fontSize: 14, color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>
          Next: Coming from GSE →
        </Link>
      </div>
    </div>
  )
}

const inlineCode: React.CSSProperties = {
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

function MetaTable({ rows }: { rows: [string, string][] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '8px 24px', fontSize: 13, marginBottom: 4 }}>
      {rows.map(([label, value]) => (
        <>
          <span key={label + 'l'} style={{ color: 'var(--text-muted)', fontWeight: 500 }}>{label}</span>
          <span key={label + 'v'} style={{ color: 'var(--text-secondary)' }}>{value}</span>
        </>
      ))}
    </div>
  )
}

function StepBlock({ number, label, code, notes }: { number: string; label: string; code: string; notes: string }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 10 }}>
        <div style={{
          width: 24, height: 24, borderRadius: '50%',
          background: 'var(--accent)', color: 'white',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, fontWeight: 700, flexShrink: 0, marginTop: 1,
        }}>
          {number}
        </div>
        <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>{label}</p>
      </div>
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 12,
        background: 'var(--bg-tertiary)', border: '0.5px solid var(--border)',
        borderRadius: 'var(--radius-md)', padding: '12px 14px',
        color: 'var(--text-secondary)', whiteSpace: 'pre', overflowX: 'auto',
        marginBottom: 10, marginLeft: 36,
      }}>
        {code}
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, marginLeft: 36 }}>
        {notes.split('\n\n').map((para, i) => (
          <p key={i} style={{ marginBottom: i < notes.split('\n\n').length - 1 ? 10 : 0 }}>{para}</p>
        ))}
      </div>
    </div>
  )
}

function CodeBlock({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontFamily: 'var(--font-mono)', fontSize: 12,
      background: 'var(--bg-tertiary)', border: '0.5px solid var(--border)',
      borderRadius: 'var(--radius-md)', padding: '12px 14px',
      color: 'var(--accent)', marginTop: 12, overflowX: 'auto',
    }}>
      {children}
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

function DecisionBlock({ question, answer }: { question: string; answer: string }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>{question}</p>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>{answer}</p>
    </div>
  )
}
