import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, ArrowLeft, ExternalLink } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Building Sequences | GRIP-EMS Guide | LazyGrip.net',
  description: 'The decision framework behind GRIP-EMS sequence design, with a real Guardian Druid Mythic+ sequence and a generic DPS example showing how the same thinking applies to any spec.',
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12, background: 'var(--bg-tertiary)', border: '0.5px solid var(--border-strong)', borderRadius: 'var(--radius-sm)', padding: '1px 6px', color: 'var(--accent-text)' }}>
      {children}
    </code>
  )
}

function CodeBlock({ children }: { children: string }) {
  return (
    <pre style={{ fontFamily: 'var(--font-mono)', fontSize: 12, background: 'var(--bg-tertiary)', border: '0.5px solid var(--border-strong)', borderRadius: 'var(--radius-md)', padding: '12px 14px', marginTop: 10, marginBottom: 4, overflowX: 'auto', color: 'var(--text-primary)', lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
      {children}
    </pre>
  )
}

function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '14px 16px', marginTop: 14, marginBottom: 4 }}>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>{children}</div>
    </div>
  )
}

function StepBlock({ number, title, children }: { number: string; title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 24, paddingBottom: 24, borderBottom: '0.5px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent)', background: 'var(--accent-subtle)', border: '0.5px solid rgba(29,158,117,0.2)', borderRadius: 'var(--radius-sm)', padding: '2px 8px' }}>Step {number}</span>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{title}</span>
      </div>
      {children}
    </div>
  )
}

export default function BuildingSequencesPage() {
  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1.2, marginBottom: 12, color: 'var(--text-primary)' }}>
          Building sequences
        </h1>
        <p style={{ fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.75, maxWidth: 620 }}>
          This section covers the decision framework behind sequence design first, then applies it to two real examples: a Guardian Druid tank rotation and a generic DPS rotation. The framework is the same regardless of your class. The examples show what the decisions look like in practice when your priorities are different.
        </p>
      </div>

      <section style={{ marginBottom: 44 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 14, color: 'var(--text-primary)' }}>
          The framework: five questions before you build
        </h2>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.75, marginBottom: 16 }}>
          Every structural decision in a sequence — step count, step function, step order, reset conditions — follows from answers to five questions about your spec and your content. Answer these before you open the editor and the sequence design becomes straightforward. Skip them and you end up tweaking by feel until the numbers eventually converge on something that works.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            {
              q: '1. What is your highest priority spell and how often does it need to fire?',
              a: 'This spell drives your step count. If it needs to appear every 3 GCDs to maintain uptime, you need a step slot for it roughly every 3 steps. Check Icy Veins, your spec Discord, or SimCraft for the expected casts per minute and work backwards from there.',
            },
            {
              q: '2. What is the cooldown you cannot miss on pull?',
              a: "This is your opener logic. Cooldowns that need to land in the first few seconds of combat belong near the front of the sequence with a [combat] guard so they don't fire pre-pull. If you have an on-use trinket or a major cooldown with a long recharge, it usually lives at step 2 or 3.",
            },
            {
              q: '3. Which spells can be skipped when unavailable, and which ones cannot?',
              a: 'Spells that are critical for uptime or survival cannot be allowed to skip. Spells that are opportunistic fillers can. The hold-on-failure behavior in GRIP-EMS means critical spells will block the sequence until they land, which is what you want for tank defensives and maintenance buffs. For DPS rotations where skipping is acceptable, Priority step function handles this differently.',
            },
            {
              q: '4. What are your modifier needs?',
              a: 'Modifiers let you fire off-rotation spells without breaking the loop. Shift for an emergency heal or defensive, Ctrl for a manual cooldown override. Every step that carries modifier lines needs [nomod] guards on the main spell and [mod:x] guards on the modifier spell, otherwise pressing Shift to trigger the modifier also attempts the main spell on the same step.',
            },
            {
              q: '5. Does this sequence need to behave differently in different content?',
              a: "GRIP-EMS supports context versions that auto-switch based on what content you're in. If your opener for Mythic+ is different from your raid opener, or if you want a tighter defensive rotation in high keys than in normal content, context versions handle that without needing separate sequences.",
            },
          ].map(item => (
            <div key={item.q} style={{ padding: '14px 16px', background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>{item.q}</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.65 }}>{item.a}</div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ marginBottom: 44 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 6, color: 'var(--text-primary)' }}>
          Worked example: Guardian Druid Mythic+ (tank)
        </h2>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 16 }}>
          This dissects Slowdog&apos;s Elune&apos;s Chosen M+ sequence, which is published on this site and has been validated through plus 13 and plus 14 keys. The point is not to tell you to play Guardian Druid — it is to show what the framework looks like when a spec has strict uptime requirements and the sequence structure has to enforce them.
        </p>

        <div style={{ padding: '14px 16px', background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-md)', marginBottom: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[
              ['Spec', 'Guardian Druid — Elune\'s Chosen'],
              ['Step function', 'Sequential'],
              ['Reset', 'On combat end'],
              ['Steps', '30'],
              ['Validated', '+13 Pit, +13 Darkflame Cleft, +14 Ara-Kara, +14 Skyreach'],
              ['Key metrics', '~47% Thrash damage, 91–97% Ironfur uptime, 0 deaths'],
            ].map(([label, value]) => (
              <div key={label}>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>{label}</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{value}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: '0.5px solid var(--border)' }}>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Talent string</div>
            <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent-text)', wordBreak: 'break-all', lineHeight: 1.6 }}>
              CgGA8cL7tpvige+kkmGM9zUPWDAAAAAAAAAAAgZmZmFzMjZWmZxMmZZZgZzMGNRmZWmZmZmlZmBAAAAAgZmNDYZbmBjZZAM1MLzyMzMAA2wMAWMGGYWssBYmZmNA
            </code>
          </div>
          <div style={{ marginTop: 12 }}>
            <Link href="/browse?class=druid&spec=guardian" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--accent)', textDecoration: 'none' }}>
              View sequence on LazyGrip <ExternalLink size={11} />
            </Link>
          </div>
        </div>

        <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 14 }}>Why Sequential and not Priority</h3>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.75, marginBottom: 16 }}>
          Guardian&apos;s two most important outputs are Thrash damage and Ironfur uptime. Both depend on specific spells firing at specific frequencies — Thrash needs to refresh before it falls off, and Ironfur needs to cast before the previous stack expires. Priority step function would always try Thrash first on every keypress, which sounds efficient but means Ironfur only fires when Thrash is on cooldown. Sequential puts Ironfur at fixed step positions so it fires on schedule regardless of what Thrash is doing.
        </p>

        <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 14 }}>The structural pattern</h3>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.75, marginBottom: 16 }}>
          The sequence has a clear internal structure across 30 steps: an opener block at step 1, then a repeating loop of Thrash and Mangle alternating with Ironfur cycling at steps 7, 14, 21, and 28, Lunar Beam weaved at steps 5, 12, 19, and 26, and two MOONSPAM steps at positions 8 and 22 handling Moonfire delivery through an external castsequence macro. Every step except MOONSPAM carries both modifier lines so Shift fires Frenzied Regeneration and Ctrl fires a manual Ironfur at any point in the rotation.
        </p>

        <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 14 }}>Step breakdown</h3>

        <StepBlock number="1" title="Opener: target acquisition, auto-attack, Bear Form">
          <CodeBlock>{`/targetenemy [noharm][dead]
/startattack
/cast [noform:1, nochanneling] Bear Form; [mod:shift] Frenzied Regeneration; [mod:ctrl] Ironfur`}</CodeBlock>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.65, marginTop: 10 }}>
            Three things happen in one step. The targetenemy line acquires a target if you do not have one or your current target is dead, which is essential at the start of a pull. Startattack gets auto attacks rolling. Bear Form uses [noform:1] as a guard so it only fires when you are not already in form and does not waste a GCD mid-rotation. Because resetOnCombat is enabled, this step fires every pull and steps 2 through 30 are the loop.
          </p>
        </StepBlock>

        <StepBlock number="2" title="Thrash">
          <CodeBlock>{`/cast [noform:1, nochanneling] Bear Form; [mod:shift] Frenzied Regeneration; [mod:ctrl] Ironfur
/cast [nomod:shift, nomod:ctrl, combat] Thrash`}</CodeBlock>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.65, marginTop: 10 }}>
            Thrash fires first because it is the highest priority ability for Guardian damage and healing. The [combat] guard prevents the sequence from attempting Thrash pre-pull during a buffer press. The [nomod:shift, nomod:ctrl] pair on the combat spell is what makes the modifier system work — without those guards, pressing Shift for Frenzied Regeneration would also attempt Thrash on the same press.
          </p>
        </StepBlock>

        <StepBlock number="3" title="Incarnation + Mangle">
          <CodeBlock>{`/cast [noform:1, nochanneling] Bear Form; [mod:shift] Frenzied Regeneration; [mod:ctrl] Ironfur
/cast [combat] Incarnation: Guardian of Ursoc
/cast [nomod:shift, nomod:ctrl, combat] Mangle`}</CodeBlock>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.65, marginTop: 10 }}>
            Incarnation uses [combat] only and not the [nomod] guards. This is intentional — you never want to accidentally skip a major cooldown by holding Shift for a Frenzied Regen at the wrong moment. Incarnation fires regardless of modifier state. Mangle follows as the filler if Incarnation is on cooldown.
          </p>
        </StepBlock>

        <StepBlock number="7, 14, 21, 28" title="Ironfur (in-sequence cycling)">
          <CodeBlock>{`/cast [noform:1, nochanneling] Bear Form; [mod:shift] Frenzied Regeneration; [mod:ctrl] Ironfur
/cast [nomod:shift, nomod:ctrl, combat] Ironfur`}</CodeBlock>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.65, marginTop: 10 }}>
            Ironfur appears every 7 steps intentionally. Ironfur&apos;s base duration is 7 seconds and the sequence runs at roughly one step per GCD. Placing Ironfur at every 7th position means a new cast lands approximately when the previous one expires. This is the mechanical reason the validated sequence produces 91 to 97% uptime. Change the spacing and the uptime drops immediately and shows up in logs.
          </p>
        </StepBlock>

        <StepBlock number="8, 22" title="MOONSPAM: Moonfire delivery and Barkskin">
          <CodeBlock>{`/castsequence [nomod, nochanneling] Moonfire, Barkskin
/cast Ironfur`}</CodeBlock>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.65, marginTop: 10 }}>
            MOONSPAM is a named external macro referenced by GRIP-EMS, not a regular step. The /castsequence fires Moonfire first, then Barkskin the next time this step is reached at position 22, then resets. Barkskin&apos;s roughly 60-second cooldown means it fires naturally at roughly the right frequency paired this way without any cooldown tracking.
          </p>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.65, marginTop: 8 }}>
            MOONSPAM cannot be replaced with a direct /cast Moonfire inside the sequence. GRIP-EMS does not advance cleanly off instant-cast steps called directly, and Moonfire would flood the rotation at 12 to 14 casts per minute instead of the intended ~1.3 CPM, collapsing Thrash frequency. The external macro reference is what gates it. To use this sequence, create the MOONSPAM macro first in WoW&apos;s regular macro editor, then reference it inside GRIP-EMS using the Macro step type.
          </p>
          <InfoBox>
            The bare /cast Ironfur on the second line fires unconditionally as an extra attempt on this step since Ironfur is off-GCD and costs nothing to attempt even when it fails.
          </InfoBox>
        </StepBlock>
      </section>

      <section style={{ marginBottom: 44 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 6, color: 'var(--text-primary)' }}>
          Applying the framework to a DPS spec
        </h2>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.75, marginBottom: 16 }}>
          The Guardian example is structured around strict uptime requirements that demand Sequential step function and precise step positioning. DPS rotations often have different needs. This generic example walks through a Priority-based DPS sequence to show how the same five questions produce a different structural outcome.
        </p>

        <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>Answering the five questions for a DPS spec</h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
          {[
            { q: 'Highest priority spell?', a: 'Your main spender or the proc ability that must never clip. Check your spec Priority section on Icy Veins — whatever sits at the top of that list is step 1.' },
            { q: 'Pull cooldown?', a: 'Your major DPS cooldown goes at step 2 or 3 with a [combat] guard. If your spec has a pre-pull setup ability like a debuff or a buff to apply before the pull, that lives at step 1 without a [combat] guard.' },
            { q: 'Can spells be skipped?', a: 'For most DPS rotations, yes. If your filler fires but your spender is not ready, you want the sequence to try the spender on the next press and not stall waiting for the filler to finish. This is where Priority step function makes sense over Sequential.' },
            { q: 'Modifier needs?', a: 'Shift for a burst cooldown you want on demand without breaking the rotation. Same [nomod] guard rules apply as in the tank example.' },
            { q: 'Context versions?', a: 'Consider a separate AoE version that prioritizes your cleave spells over single target, auto-switching in dungeons. The Context tab handles this without duplicating the whole sequence.' },
          ].map(item => (
            <div key={item.q} style={{ padding: '12px 16px', background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-md)', display: 'grid', gridTemplateColumns: '180px 1fr', gap: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{item.q}</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{item.a}</div>
            </div>
          ))}
        </div>

        <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>Why Priority works differently for DPS</h3>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.75, marginBottom: 12 }}>
          With Priority step function, GRIP-EMS tries step 1 on every keypress and only moves to step 2 if step 1 fails. Step 1 fails when the spell is on cooldown, out of range, or unavailable for some other reason. This means your highest priority spell fires every single time it is available, which is exactly what most DPS priority lists require.
        </p>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.75, marginBottom: 12 }}>
          The tradeoff is that spells later in the sequence fire infrequently. Step 5 only fires when steps 1 through 4 all fail simultaneously, which may be rare depending on your cooldown timings. For this reason, Priority sequences typically have 4 to 6 steps covering the core rotation, rather than the 20 to 30 steps a Sequential tank sequence needs for precise cycling.
        </p>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.75 }}>
          A typical Priority DPS sequence structure looks like: step 1 is your primary spender or highest priority proc, step 2 is your major cooldown, step 3 is your secondary priority ability, steps 4 and 5 are fillers in priority order, and a modifier on every step fires your burst cooldown on demand. If your spec has a proc that should always jump the queue, put it at step 1 and everything else falls behind it.
        </p>

        <InfoBox>
          Not sure whether your spec wants Sequential or Priority? The answer is usually in how your spec Discord describes the rotation. If they say &quot;use X on cooldown and fill with Y and Z,&quot; that is Priority. If they describe a specific cast order with tight timing windows between abilities, that is Sequential.
        </InfoBox>
      </section>

      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 14, color: 'var(--text-primary)' }}>
          General rules that apply to every sequence
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            {
              title: 'Use [combat] guards on every combat spell',
              desc: 'Without [combat] guards, spam-pressing the key before a pull advances the sequence past the opener before combat starts. Step 1 fires correctly only if the sequence is at step 1 when the first spell lands.',
            },
            {
              title: 'Always use [nomod] guards when combining modifiers with main spells',
              desc: 'If step 3 has Mangle as the main spell and Ironfur as the Ctrl modifier, Mangle needs [nomod:ctrl] so pressing Ctrl does not attempt both. Without this, modifier presses have unpredictable effects on the main spell at that step.',
            },
            {
              title: 'Use [known:SpellName] for talent-dependent spells',
              desc: 'If a spell is only available with a specific talent, wrap it in [known:SpellName] so the step silently skips when the talent is not taken. This makes sequences adaptable across different talent builds without breaking.',
            },
            {
              title: 'Name your sequences clearly and include the version',
              desc: 'EC_V7, BDK_M+_V4, FireMage_Raid_V2. When you iterate on a sequence, create a new one rather than editing in place. You want to be able to roll back to a previous version if the new one underperforms in logs.',
            },
            {
              title: 'Run /gems repair after every import and after every patch',
              desc: 'The Repair module checks your sequence across 13 diagnostic categories including stale spells, character limit violations, keybind conflicts, and broken variables. It catches most structural problems before you ever run content and fixes the majority of them in one click.',
            },
          ].map(rule => (
            <div key={rule.title} style={{ padding: '14px 16px', background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>{rule.title}</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.65 }}>{rule.desc}</div>
            </div>
          ))}
        </div>
      </section>

      <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 16, borderTop: '0.5px solid var(--border)' }}>
        <Link href="/guide/how-it-works" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14, color: 'var(--text-tertiary)', textDecoration: 'none' }}>
          <ArrowLeft size={14} /> How it works
        </Link>
        <Link href="/guide/from-gse" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14, color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>
          Next: Coming from GSE <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  )
}
