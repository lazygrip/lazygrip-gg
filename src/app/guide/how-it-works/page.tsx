import Link from 'next/link'
import type { Metadata } from 'next'
import GuideHeader from '@/components/guide/GuideHeader'
import GuideSection from '@/components/guide/GuideSection'
import GuideCallout from '@/components/guide/GuideCallout'
import { guideCodeStyle } from '@/components/guide/GuideCode'

export const metadata: Metadata = {
  title: 'How GRIP-EMS Works | GRIP-EMS Guide',
  description: 'The mental model behind GRIP-EMS: the secure execution environment, what you can and cannot do inside a sequence, and how the step engine actually behaves.',
  alternates: {
    canonical: 'https://lazygrip.net/guide/how-it-works',
  },
  openGraph: {
    title: 'How GRIP-EMS Works | GRIP-EMS Guide',
    description: 'The mental model behind GRIP-EMS: the secure execution environment, what you can and cannot do inside a sequence, and how the step engine actually behaves.',
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
            { label: '3. Check your other WoW keybinds', desc: 'Open your normal WoW keybind menu, not GRIP-EMS, and search for anything already bound to SHIFT, CTRL, or ALT combined with your sequence key elsewhere in your bindings, action bars, or another addon. A conflicting bind claimed by something else silently eats the modifier press before GRIP-EMS ever sees it. This is a confirmed, recurring cause: several users have fixed dead modifiers entirely by clearing out unrelated modifier-key bindings that had nothing to do with GRIP-EMS on the surface.' },
            { label: '4. Reset all your WoW keybinds', desc: 'If steps 1 through 3 all check out clean and modifiers still are not firing, a full keybind reset in WoW itself (not just GRIP-EMS) has resolved this for other users even when no specific conflicting bind was ever found. It is a blunt fix and you will need to rebind everything afterward, but it works when nothing else does.' },
          ].map(r => (
            <div key={r.label} style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '12px 14px', background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 'var(--text-sm)' }}>{r.label}</span>
              <span style={{ color: 'var(--text-secondary)', lineHeight: 1.6, fontSize: 'var(--text-sm)' }}>{r.desc}</span>
            </div>
          ))}
        </div>

        <p style={{ marginTop: 16 }}>If all four check out and modifiers still are not firing, post in the Discord with your CVar Health status, a screenshot of the step's conditional, and whether you have any other addon that binds modifier keys or touches CVars, so it can be looked at directly rather than retreading the same troubleshooting steps.</p>
      </GuideSection>

      <GuideSection title="The Pause step">
        <p>GRIP-EMS includes a dedicated Pause step that holds the sequence without attempting a cast. It has three variants and they behave differently depending on what you need.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
          {[
            { label: 'Clicks', desc: 'Holds for a set number of keypresses before advancing. Good for spacing out high-cost abilities that need a fixed number of GCDs between them.' },
            { label: 'Milliseconds', desc: 'Holds for a set duration regardless of keypresses. Useful when you need a hard time gate between steps rather than an action count.' },
            { label: 'GCD', desc: 'Holds for one or more global cooldown cycles. The safest option for finisher spacing since it adapts to your actual GCD rather than a hardcoded time value.' },
          ].map(r => (
            <div key={r.label} style={{ display: 'flex', gap: 14, fontSize: 'var(--text-sm)', alignItems: 'flex-start' }}>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)', flexShrink: 0, minWidth: 120 }}>{r.label}</span>
              <span style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>{r.desc}</span>
            </div>
          ))}
        </div>
        <p style={{ marginTop: 12 }}>The Pause step is most commonly needed for specs with strict GCD relationships between abilities, for example preventing Steady Shot from firing too close to a proc window in Marksmanship Hunter. If you find a spell clipping something it should not, a one-GCD pause before that step is usually the fix to try first.</p>
        <p style={{ marginTop: 12 }}>As of v2.4.0, GRIP-EMS also has a dedicated Hold While Channeling setting, covered on the <Link href="/guide/settings" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>Settings</Link> page, which stops a mid-channel press from burning a step at all. It solves a related but different problem than the Pause step: Pause deliberately holds position for a set count or duration you choose, while Hold While Channeling reacts to an active channel and holds only for as long as that channel runs.</p>
      </GuideSection>

      <GuideSection title="Reset conditions">
        <p>Reset conditions send the sequence back to step 1. GRIP-EMS supports five of them and they can be combined.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
          {[
            { label: 'Reset on combat', desc: 'Resets to step 1 when you leave combat. Most tank and DPS sequences should have this enabled so your opener fires at the start of each pull.' },
            { label: 'Reset on target', desc: 'Resets when your target changes. Useful for sequences with a target-specific opener that you want to replay on each new target.' },
            { label: 'Reset on spec', desc: 'Resets when you change spec. Usually unnecessary if your sequences are spec-specific.' },
            { label: 'Reset on gear', desc: 'Resets on gear swap. Relevant if you use gear sets that change your stat priorities mid-session.' },
            { label: 'Timer reset', desc: 'Resets after a set number of seconds without a keypress. Useful as a fallback to catch sequences that got stuck mid-rotation during an interruption.' },
          ].map(r => (
            <div key={r.label} style={{ display: 'flex', gap: 14, fontSize: 'var(--text-sm)', alignItems: 'flex-start' }}>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)', flexShrink: 0, minWidth: 140 }}>{r.label}</span>
              <span style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>{r.desc}</span>
            </div>
          ))}
        </div>
        <GuideCallout>
          Reset on target currently only takes effect out of combat. Switching targets mid-pull in Mythic+ will not reset the sequence to step 1 the way it will between pulls; the reset applies the next time you are out of combat and pick up a new target. If you were relying on a mid-combat target-change reset to replay a target-specific opener, it is not firing the way the setting name implies. Confirmed directly from the addon author; treat this as current behavior rather than an edge case, and design around Reset on combat for anything you need to trigger reliably inside a pull.
        </GuideCallout>
      </GuideSection>

      <GuideSection title="Skyriding and mount behavior">
        <p>Pressing your sequence keybind while skyriding behaves differently depending on whether you have a valid target.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16, marginBottom: 16 }}>
          {[
            { label: 'Valid target below you', desc: 'One press dismounts and fires step 1 in the same action. No separate dismount required.' },
            { label: 'No valid target', desc: 'The press falls through to your skyriding action bar as if GRIP-EMS is not active. Your normal skyriding controls are unaffected.' },
          ].map(r => (
            <div key={r.label} style={{ display: 'flex', gap: 14, fontSize: 'var(--text-sm)', alignItems: 'flex-start' }}>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)', flexShrink: 0, minWidth: 180 }}>{r.label}</span>
              <span style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>{r.desc}</span>
            </div>
          ))}
        </div>
        <p>This requires Auto Dismount in Flight to be enabled in your WoW settings. Druids also need Auto Unshift enabled to exit skyriding Travel Form mid-air with the same single press.</p>
        <p style={{ marginTop: 12 }}>Getting dazed off a skyriding mount mid-pull used to leave your sequence keys dead until you dropped combat. That is fixed. The swap to your ground action bar now happens the moment you land, combat-safe, so your keys are ready the instant you hit the ground.</p>
        <p style={{ marginTop: 12 }}>There was a separate bug on first takeoff of a session where ground binds stayed live mid-air or vehicle keys never woke up at all. That is also fixed. The out-of-combat watchdog now heals the swap at takeoff and restores it on landing, so the first flight of every session behaves the same as every other.</p>
      </GuideSection>

      <GuideSection title="Context switching and multi-version sequences">
        <p>A single sequence in GRIP-EMS can hold more than one version, and the addon picks which one is live based on what content you are in. GRIP-EMS recognizes dozens of distinct context types across raid difficulty, dungeon difficulty, Mythic+ key ranges, delve tiers, rated PvP, and more, and it checks on zone change, difficulty change, and group roster update. If you have built a separate version of a sequence for, say, Mythic+ versus raid, walking into a dungeon swaps you to that version automatically with no manual intervention.</p>
        <p style={{ marginTop: 12 }}>This used to have a real failure mode. Swapping versions by zoning into a dungeon or arena could drop a sequence's loop and branch grouping, and it would stay broken until you ran a manual <code style={code}>/reload</code>. That is fixed. The self-heal that rebuilds loop and branch structure now runs on the context switch itself, not just on a reload, so grouping survives the swap the moment it happens.</p>
        <p style={{ marginTop: 12 }}>If you want to override the automatic pick, you can pin a specific version as the live one regardless of what your current content or talents would otherwise select. The pin holds until you clear it, and the version list shows a badge next to whichever version is actually firing. Useful if you are deliberately running an off-spec version of a sequence, or testing a version before letting it take over automatically for its intended content.</p>
      </GuideSection>

      <GuideSection title="Keybind recovery">
        <p>GRIP-EMS includes automatic keybind monitoring. If your sequence keybinds go missing after a login, a loadout swap, or a deleted loadout eating its own binds, the addon detects it and tells you. Running <code style={code}>/gems binds restore</code> puts your last working set back immediately.</p>
        <p style={{ marginTop: 12 }}>The addon snapshots your binds on every clean load, so recovery is reliable even across sessions. If you see a warning about missing binds, run the restore command before assuming something is broken in your sequence.</p>
        <GuideCallout>
          If your keys ever stop responding and you are not in a vehicle, a pet battle, or a cutscene, run <code style={code}>/gems binds restore</code> first. It takes two seconds and covers the most common cause of unexplained dead keys.
        </GuideCallout>
      </GuideSection>

      <GuideSection title="Per-step Disable and the sequence tracker">
        <p>Individual steps can be disabled inside the editor without deleting them. A disabled step is skipped entirely by the engine, which means you can comment out a step for testing purposes without losing the macro text. Re-enable it and the engine picks it up again on the next keypress.</p>
        <p style={{ marginTop: 12 }}>Disabled sequences are hidden from the tracker overlay and from your action bar. A sequence that is toggled off does not occupy a visible tracker slot, which keeps the display clean when you have multiple sequences loaded but only some of them active.</p>
      </GuideSection>

      <GuideSection title="Interleave / Weave">
        <p>Interleave lets you set an interval on any action so it fires every N steps automatically, without you having to manually place it throughout your sequence. Set an action's interval to 5, for example, and the compiler weaves that action into your rotation every fifth step, on top of whatever else is already there.</p>
        <p style={{ marginTop: 12 }}>This is the right tool for maintenance buffs, trinket procs, or cooldowns you want firing on a regular cadence without disrupting your main rotation flow. Rather than manually inserting the same spell at steps 5, 10, 15, and 20, you set one interleave interval and the compiler places it for you at every one of those points, correctly, even if you later add or remove steps elsewhere in the sequence.</p>
        <p style={{ marginTop: 12 }}>The interval range is 2 to 50 steps. Interleave also works inside Loop blocks, and the editor marks any interleaved row with an <code style={code}>[IL:N]</code> indicator so you can see at a glance which steps are woven in versus part of your authored rotation.</p>
        <GuideCallout>
          If your interval is larger than the block it lives in, the action never gets a chance to fire and compiles to nothing. GRIP-EMS now warns you when this happens, names the action, tells you the block's actual step count, and suggests an interval or Repeat count that would make it fit. If a trinket or buff you set up on interleave never seems to go off, check for this warning first before assuming the trinket itself is broken.
        </GuideCallout>
      </GuideSection>

      <GuideSection title="Plugin support">
        <p>GRIP-EMS exposes a public plugin API so other addons can extend it without touching its source. Everything goes through one frozen entry point, <code style={code}>GRIPEMS.API</code>, and it is owner-scoped and isolated per plugin, so a bug in someone else's plugin breaks their plugin, not your sequences. Anything a plugin adds is owned by its plugin id and reverts cleanly the moment that plugin is disabled, no leftovers in your settings or your sequences.</p>
        <p style={{ marginTop: 12 }}>This is the kind of thing you will only ever notice if you run an addon that uses it. If a plugin adds a new export format, it shows up alongside the built-in one in the export window's format picker. If a plugin adds settings, they appear inside its own panel rather than scattered through GRIP-EMS's existing menus. None of this changes default behavior for anyone who is not running a plugin.</p>
        <p style={{ marginTop: 12 }}>As of v2.3.0, the API extends to action bars specifically. A plugin can put one of your sequences directly on an action button, reading per-step spell data, creating and picking up that sequence's macro, and registering its own <code style={code}>/gems</code> subcommand to go with it. Same rule applies: nothing changes unless you are running a plugin.</p>
        <p style={{ marginTop: 12 }}>If you build addons and want to extend GRIP-EMS yourself, the full API reference, including the security model and every method by access tier, lives at <a href="https://jesperlive.github.io/GRIP-EMS-PluginAPI/" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>jesperlive.github.io/GRIP-EMS-PluginAPI</a>. That documentation is the authoritative source for plugin development, this guide is written for sequence builders rather than addon authors.</p>
      </GuideSection>

      <GuideSection title="Importing sequences and macro name collisions">
        <p>Every sequence import can carry a named WoW macro alongside it, the way the MOONSPAM pattern on the <Link href="/guide/building-sequences" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>Building sequences</Link> page depends on. As of v2.4.3, GRIP-EMS checks whether it created a macro before it touches it during an import. If an incoming macro shares a name with one already in your <code style={code}>/macro</code> list that GRIP-EMS did not create itself, your macro is left alone and you get a chat line naming which one was skipped, rather than having its body silently replaced.</p>
        <p style={{ marginTop: 12 }}>Before v2.4.3, a name clash on the macro side was not handled the way sequence name clashes already were, and an import could overwrite a same-named macro you wrote yourself with no prompt and no undo. If you hit a skipped macro on import, rename either the incoming macro or your existing one and import again; the sequence itself still imports normally, only the colliding macro is held back.</p>
        <GuideCallout>
          One rough edge as of v2.4.3: if you import while in combat, the import summary is written before the skip logic finishes running, so the reported count can read one macro high until combat ends and the actual chat line naming the skipped macro appears.
        </GuideCallout>
      </GuideSection>

      <GuideSection title="The visual display layer versus what actually executes">
        <p>This is worth knowing because it causes real confusion in the Discord regularly. GRIP-EMS has two separate things: the visual preview of your sequence in the editor, and the compiled macro output that actually runs when you press your keybind. They are not the same thing.</p>
        <p style={{ marginTop: 12 }}>The visual layer renders steps it can match against known spells in its database. Steps it cannot match, including certain raw macro lines, some conditional constructs, and hero talent override spells under specific conditions, do not show in the preview. But they still exist in the compiled output and WoW's macro engine executes them correctly. A step that is invisible in the editor is not a broken step.</p>
        <p style={{ marginTop: 12 }}>This passthrough behavior is intentional and is how GRIP-EMS supports custom macro syntax that the addon's parser does not explicitly recognize. If you see fewer steps in the preview than you built and your sequence is otherwise working, this is almost certainly why.</p>
      </GuideSection>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 48, paddingTop: 24, borderTop: '0.5px solid var(--border)' }}>
        <Link href="/guide/settings" style={{ fontSize: 'var(--text-sm)', color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>
          Back: Settings
        </Link>
        <Link href="/guide/building-sequences" style={{ fontSize: 'var(--text-sm)', color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>
          Next: Building sequences
        </Link>
      </div>
    </div>
  )
}
