import Link from 'next/link'
import type { Metadata } from 'next'
import GuideHeader from '@/components/guide/GuideHeader'
import GuideSection from '@/components/guide/GuideSection'
import GuideCallout from '@/components/guide/GuideCallout'
import { guideCodeStyle } from '@/components/guide/GuideCode'

export const metadata: Metadata = {
  title: 'How GRIP-EMS Works | GRIP-EMS Guide',
  description: 'The core mental model behind GRIP-EMS: the secure execution environment, how the step engine advances, proc-gated abilities, step functions, and modifiers.',
  alternates: {
    canonical: 'https://lazygrip.net/guide/how-it-works',
  },
  openGraph: {
    title: 'How GRIP-EMS Works | GRIP-EMS Guide',
    description: 'The core mental model behind GRIP-EMS: the secure execution environment, how the step engine advances, proc-gated abilities, step functions, and modifiers.',
    url: 'https://lazygrip.net/guide/how-it-works',
    siteName: 'LazyGrip.net',
    type: 'website',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'LazyGrip.net — GRIP-EMS sequences for World of Warcraft' }],
  },
}

const code = guideCodeStyle

export default function HowItWorksPage() {
  return (
    <div style={{ maxWidth: 720 }}>
      <GuideHeader
        crumbLabel="How it works"
        title="How GRIP-EMS works"
        description="Before you build a sequence, you need the right mental model. Three things in particular will save you hours of confusion: what WoW's secure execution environment actually restricts, how GRIP-EMS advances through steps, and what WoW does with the macro line on a step once the addon hands it over."
      />

      <GuideSection title="The secure execution environment">
        <p>WoW runs addon code that interacts with combat in a restricted sandbox called the secure execution environment. Blizzard built this to prevent addons from automating decisions. Things like casting a spell when health is below 40% or using a cooldown when the boss is casting a specific ability are blocked because they would read arbitrary game state to make combat decisions. Inside a macro or sequence step, a meaningful portion of the Lua API is simply not available.</p>
        <p style={{ marginTop: 12 }}>This catches many new users who come from programming backgrounds and assume they can write logic into their sequences. The most common example is trying to check a resource value like combo points or holy power with <code style={code}>UnitPower("player")</code> or timing logic with <code style={code}>GetTime()</code>. Both of those calls return nil inside a secure handler because they are part of the restricted API. The sequence does not error gracefully, it crashes.</p>
        <p style={{ marginTop: 12 }}>What you can use inside sequence steps is the standard macro conditional system that Blizzard has explicitly allowed: <code style={code}>[combat]</code>, <code style={code}>[mod:shift]</code>, <code style={code}>[known:SpellName]</code>, <code style={code}>[noform:1]</code>, <code style={code}>[nochanneling]</code>, and the rest of the documented macro conditional set. These are not API calls. They are tokens the macro engine parses directly and they are permitted because they do not read arbitrary game state.</p>
        <p style={{ marginTop: 12 }}>GRIP-EMS's Variables system exists partly to work around this limitation. Variables are resolved outside the secure environment before the macro compiles, which means you can use them to make conditional decisions that would be impossible inside a step directly.</p>
        <p style={{ marginTop: 12 }}>Buffs and debuffs are readable through that Variables system, and it is worth knowing exactly what is safe to check and what is not. <code style={code}>HasBuff</code>, <code style={code}>HasDebuff</code>, <code style={code}>SpellReady</code>, and <code style={code}>SpellOnCooldown</code> all hand back clean booleans you can build a variable around. What stays out of reach is anything numeric tied to the secret value system: Holy Power amount, combo point count, how many stacks of a buff you are holding, time remaining on anything. Those come back tagged in a way that throws the moment you compare or do arithmetic on them, and there is no trick around it, the CurveUtil approach some WeakAuras use gets tested against the same tag and fails the same way. If the number you actually want has an aura that only exists at that count, checking for the aura's presence instead of the number underneath it is usually the workaround.</p>
        <p style={{ marginTop: 12 }}>There is a second catch worth knowing before you build around any of this. A variable's value gets baked into your macro text once, at compile time, not read live on every press. Put <code style={code}>UNIT_AURA</code> in a variable's Events field and it re-evaluates when your auras change and queues a recompile, but that recompile writes to a secure button, which makes it combat locked, so it sits in the out-of-combat queue until you actually drop combat. A buff check built this way settles correctly at the start of a pull and then stays frozen for the rest of it. It does not chase a proc that comes and goes mid-fight. That makes Variables genuinely useful for anything that holds steady across a pull, a talent build, your spec, a raid buff, and not useful for gating a step on a short proc window.</p>
      </GuideSection>

      <GuideSection title="How the step engine actually advances">
        <p>GRIP-EMS is a Sequential step engine by default, which means it fires step 1, then step 2, then step 3, advancing one step per keypress and looping back to step 1 after the last step. The advance is unconditional. The engine sets up the step, hands the macro line to WoW, and moves the counter on. Whether the spell went out is not something it checks.</p>

        <p style={{ marginTop: 16 }}>What happens on the press is WoW&apos;s business. If a <code style={code}>/cast</code> names a spell that is on cooldown, the macro engine stops there and the cast lines below it in that same press never run, so the press produces nothing further. A <code style={code}>/castsequence</code> sitting on an entry that is on cooldown does the same thing. This is WoW reading your macro text rather than the sequencer making a decision, and it works identically under any addon that drives a macro. Conditional lines are the exception. A conditional that does not apply is skipped and the line after it still gets its turn.</p>

        <p style={{ marginTop: 16 }}>Both halves matter when you place a defensive. A press that cast nothing is not retried, and the step is spent until the loop comes back around. On a 30 step loop clicked every 150ms that is about 4.5 seconds, long enough for Ironfur to drop while the sequence walks the rest of the loop. Shorten the loop, move the step earlier, or give it a per-step interval.</p>
      </GuideSection>

      <GuideSection title="Proc-gated abilities">
        <p>A step whose line names a spell you cannot cast right now produces nothing on that press, and the step advances anyway. There is no macro conditional that tests a proc. The documented set covers combat, modifiers, form, channeling, whether a spell is in your book and so on, but nothing that reads a buff, so you cannot write a step that fires only while a proc is up.</p>
        <p style={{ marginTop: 12 }}>Where WoW itself swaps the button to the proc version, name the base spell and the swap happens for you. Warrior&apos;s Slam becoming Heroic Strike under Bloodsurge is the old textbook case: <code style={code}>/cast Slam</code> gets you Heroic Strike while the proc is up, because WoW substitutes the override on the action and you never spend a press on a spell you do not have. The trap is writing <code style={code}>/cast Heroic Strike</code> instead, which casts nothing on every press where the proc is down. Adding a second spell after a semicolon does not rescue it either. A clause with no conditional in front of it is always true, so <code style={code}>/cast Heroic Strike; Slam</code> picks Heroic Strike every time and Slam never fires.</p>
        <GuideCallout>
          If the proc version is a genuine override of the base spell, write the base spell. If it is a separate spell with its own availability, accept that some presses on that step do nothing, and keep anything else you need on that same step above the proc line, because a <code style={code}>/cast</code> that fails on cooldown stops the lines under it.
        </GuideCallout>
        <p style={{ marginTop: 12 }}><code style={code}>[known:SpellName]</code> is not a safe substitute for the override rule above when the spell in question is only ever granted by a talent or a buff rather than owned outright. It resolves through two different WoW APIs depending on how the game currently considers the spell available, and those two APIs can disagree about the exact same spell at the exact same moment. A step gated on <code style={code}>[known:SpellName]</code> for something like a temporarily-granted override can read as known by one check and not known by the other, which shows up as the conditional passing in the editor while the step does nothing in practice, or the reverse. Prefer the override rule, base spell name and let WoW substitute, over gating with <code style={code}>[known:]</code> whenever the spell is override-shaped rather than a talent you either have all game or not at all.</p>
        <p style={{ marginTop: 12 }}>One guard worth calling out on its own is <code style={code}>[nochanneling]</code>, which belongs on finisher steps like Rip or Final Verdict. That conditional is what stops the finisher from clipping a channel. Do not add <code style={code}>[combat]</code> on top of it, that causes silent failures.</p>
      </GuideSection>

      <GuideSection title="Step functions">
        <p>GRIP-EMS supports four step functions that control how the engine decides which step fires next. Sequential is the default and the one you will use for most rotations.</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
          {[
            {
              name: 'Sequential',
              tag: 'Default',
              desc: 'Fires step 1, then 2, then 3, loops to 1. One advance per keypress. This is the correct choice for rotations where order matters, including tank defensive cycling, opener sequences, and anything where a spell at step 5 is supposed to come after the spells at steps 1 through 4.',
            },
            {
              name: 'Priority',
              tag: null,
              desc: 'Weights the loop toward the front. The steps are expanded into a longer cycle in which step 1 appears most often, step 2 slightly less often, and the last step once. Advancement is still one entry per keypress. Good for rotations where the early steps should get most of the presses.',
            },
            {
              name: 'Reverse Priority',
              tag: null,
              desc: 'The same weighting inverted, so the last step gets most of the presses and step 1 the fewest. In practice this means the tail of your loop fires far more often than the front of it. Avoid it unless that is genuinely what you want.',
            },
            {
              name: 'Random',
              tag: null,
              desc: 'Fires a random step each press. Useful for very specific situations like randomizing a proc-based spell into different positions to avoid predictable timing. Not useful for structured rotations.',
            },
          ].map(sf => (
            <div key={sf.name} style={{ padding: '14px 16px', background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>{sf.name}</span>
                {sf.tag && (
                  <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--accent)', background: 'var(--accent-subtle)', padding: '2px 6px', borderRadius: 'var(--radius-sm)' }}>
                    {sf.tag}
                  </span>
                )}
              </div>
              <p style={{ fontSize: 'var(--text-base)', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{sf.desc}</p>
            </div>
          ))}
        </div>
        <GuideCallout>
          Priority is not a retry mechanism and it does not check whether a step is actually castable before choosing it, worth being precise about since the name invites the wrong mental model. It is a fixed pre-expansion computed once at compile time: for N steps you get N times (N plus 1) divided by 2 total slots in the cycle, arranged as step 1, then steps 1 and 2, then steps 1 through 3, and so on out to all N. A 4-step sequence compiles to 10 slots, step 1 taking 4 of them, step 2 taking 3, step 3 taking 2, step 4 taking 1. The engine then runs the exact same unconditional advance-on-every-press logic as Sequential over that expanded array. If step 1 is on cooldown, that press still does nothing, and the next press still takes whatever slot comes next in the array regardless of whether it is castable. Real fallthrough, where WoW tries one spell and only moves to a second if the first cannot fire, only exists inside a single step written as stacked <code style={code}>/cast</code> lines. Priority is a weighting tool for press frequency, not that.
        </GuideCallout>
      </GuideSection>

      <GuideSection title="Understanding modifiers">
        <p>Modifiers are the single most common source of confusion for new users, and the confusion is almost always the same one: assuming SHIFT, CTRL, and ALT need their own separate keybinds somewhere. They do not. GRIP-EMS binds exactly one key to a sequence, in the Keybinds tab, and that single key is what you press or hold repeatedly. Modifiers ride on top of that same key rather than needing a bind of their own.</p>
        <p style={{ marginTop: 12 }}>Concretely: if your sequence is bound to the 1 key, you never bind SHIFT+1 or CTRL+1 anywhere. You hold SHIFT while pressing 1, and any step tagged with <code style={code}>[mod:shift]</code> fires instead of your normal rotation for that press. Release SHIFT and the next press goes back to firing the sequence normally. The same applies to CTRL and ALT.</p>

        <GuideCallout>
          If you are looking for a place to bind SHIFT+1 or CTRL+1 specifically, stop looking. There is no such setting because that is not how modifiers work in GRIP-EMS. One keybind per sequence, modifiers layer on top of it.
        </GuideCallout>

        <p style={{ marginTop: 16 }}>The guard pattern that makes this work correctly is <code style={code}>[nomod:shift, nomod:ctrl]</code> on your normal rotation steps. Without it, holding SHIFT for an emergency heal would also attempt to fire whatever spell is on that step, since the step has no way to know you only wanted the modifier action. Every regular rotation step should carry this guard if the sequence uses modifiers anywhere. The worked example on the <Link href="/guide/building-sequences" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>Building sequences</Link> page shows this pattern applied consistently across a real 30-step sequence.</p>

        <p style={{ marginTop: 16 }}>If your keybind fires normally but a modifier does not, work through these in order before assuming something is broken in the sequence itself:</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
          {[
            { label: '1. Check the step itself', desc: 'Open the sequence in the editor and confirm the step you expect actually has the [mod:shift] or [mod:ctrl] conditional written on it. A missing tag on the step is indistinguishable from a firing bug until you look.' },
            { label: '2. Check CVar Health', desc: 'Run /gems settings, go to Cvar Health, and confirm it is green. The same key-down requirement that governs your base keybind governs modifier presses too.' },
            { label: '3. Check your other WoW keybinds', desc: 'As of v2.4.13, GRIP-EMS checks this for you. The keybind panel reads the modifiers your steps and keypress text actually use out of your own sequence rather than assuming, and checks each one against your other WoW bindings, action bars, and other addons. Anything holding a conflicting bind is listed right there in the panel, under the sequence it affects, and also in /gems keys. Before that version, this had to be found by hand: opening the normal WoW keybind menu and searching for anything already bound to SHIFT, CTRL, or ALT combined with your sequence key. If you are on an older version, do that manually. A conflicting bind claimed by something else silently eats the modifier press before GRIP-EMS ever sees it, and it was a confirmed, recurring cause of dead modifiers before the panel started catching it automatically.' },
            { label: '4. Reset all your WoW keybinds', desc: 'If steps 1 through 3 all check out clean and modifiers still are not firing, a full keybind reset in WoW itself (not just GRIP-EMS) has resolved this for other users even when no specific conflicting bind was ever found. It is a blunt fix and you will need to rebind everything afterward, but it works when nothing else does.' },
          ].map(r => (
            <div key={r.label} style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '12px 14px', background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 'var(--text-sm)' }}>{r.label}</span>
              <span style={{ color: 'var(--text-secondary)', lineHeight: 1.6, fontSize: 'var(--text-sm)' }}>{r.desc}</span>
            </div>
          ))}
        </div>

        <p style={{ marginTop: 16 }}>If all four check out and modifiers still are not firing, post in the Discord with your CVar Health status, a screenshot of the step's conditional, and whether you have any other addon that binds modifier keys or touches CVars, so it can be looked at directly rather than retreading the same troubleshooting steps.</p>
        <p style={{ marginTop: 16 }}>One more limit worth knowing since it looks like a modifier bug when it is not: the 255 character cap sits on the combined text, not just the step's own line. Key Press, the step's action line, and Key Release get joined with newlines and the whole thing is measured together, per step. Bust that combined total and the step does not error and does not get dropped either, it falls back to running its own action line alone, with Key Press and Key Release left off for that one step only. Every other step in the sequence keeps them. GRIP-EMS tells you when this happens, a chat line on compile naming how many of your steps actually fit the modifiers, and the editor carries a matching fits-in label, so check for that before assuming a step with dead modifiers is broken. The one case that is a hard save-time error is the step's own action line alone going over 255 with no Key Press involved at all, that fails validation outright and will not save until you shorten it.</p>
      </GuideSection>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 48, paddingTop: 24, borderTop: '0.5px solid var(--border)' }}>
        <Link href="/guide/settings" style={{ fontSize: 'var(--text-sm)', color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>
          Back: Settings
        </Link>
        <Link href="/guide/features-and-behavior" style={{ fontSize: 'var(--text-sm)', color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>
          Next: Features and behavior
        </Link>
      </div>
    </div>
  )
}
