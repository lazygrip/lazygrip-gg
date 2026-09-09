import Link from 'next/link'
import type { Metadata } from 'next'
import GuideHeader from '@/components/guide/GuideHeader'
import GuideSection from '@/components/guide/GuideSection'
import GuideCallout from '@/components/guide/GuideCallout'
import { guideCodeStyle } from '@/components/guide/GuideCode'

export const metadata: Metadata = {
  title: 'Features and Behavior | GRIP-EMS Guide',
  description: 'Reference for the rest of what GRIP-EMS does: Pause, reset conditions, skyriding, context versions and per-loadout keybinds, keybind recovery, Interleave, the plugin API, imports, the display layer, and sharing sequences.',
  alternates: {
    canonical: 'https://lazygrip.net/guide/features-and-behavior',
  },
  openGraph: {
    title: 'Features and Behavior | GRIP-EMS Guide',
    description: 'Reference for the rest of what GRIP-EMS does: Pause, reset conditions, skyriding, context versions and per-loadout keybinds, keybind recovery, Interleave, the plugin API, imports, the display layer, and sharing sequences.',
    url: 'https://lazygrip.net/guide/features-and-behavior',
    siteName: 'LazyGrip.net',
    type: 'website',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'LazyGrip.net — GRIP-EMS sequences for World of Warcraft' }],
  },
}

const code = guideCodeStyle

export default function FeaturesAndBehaviorPage() {
  return (
    <div style={{ maxWidth: 720 }}>
      <GuideHeader
        crumbLabel="Features and behavior"
        title="Features and behavior"
        description="Once the mental model from How it works has clicked, this is the reference for everything else GRIP-EMS does: Pause, reset conditions, skyriding, context versions and per-loadout keybinds, keybind recovery, Interleave, the plugin API, imports, the display layer, and sharing sequences. Come back to any one of these when you actually need it rather than reading it all at once."
      />

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
        <p style={{ marginTop: 12 }}>As of v2.4.0, GRIP-EMS also has a dedicated Hold While Channeling setting, covered in full on the <Link href="/guide/settings" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>Settings</Link> page, which stops a mid-channel press from burning a step at all. It solves a related but different problem than the Pause step: Pause deliberately holds position for a set count or duration you choose, while Hold While Channeling reacts to an active channel and holds only for as long as that channel runs. Through v2.4.13 the setting only showed up for characters with an actual empowered spell in their spellbook, in practice meaning Evoker, even though the underlying hold has always worked on any channel. That was a UI gating bug, fixed in v2.4.14, so it is now the first thing to reach for on any channeled spell, not just an Evoker-specific tool.</p>
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
        <p style={{ marginTop: 12 }}>There is a second, separate way to make one key do different things depending on your setup, and it solves a different problem than context versions do. Per-loadout keybinds, found in Settings under General, lets a single keybind attach to whichever talent loadout was active when you set it, off by default and per character. Turn it on and any bind you make from then on belongs to that loadout specifically; binds you made before stay in place as the fallback for any loadout that does not have its own. The slash form is <code style={code}>/gems bind &lt;sequence&gt; &lt;key&gt; --loadout &lt;name or id&gt;</code>.</p>
        <p style={{ marginTop: 12 }}>The distinction that matters: context versions switch on where you are, zone, difficulty, key range, and so on. Per-loadout keybinds switch on which talent build you currently have equipped, regardless of zone. If your split is by content, a pet version for open world against a no-pet version for Mythic+, context versions is the tool, one sequence with two versions and the right context boxes ticked on each. If your split is by loadout instead, two full builds you swap between with the in-game loadout picker, per-loadout keybinds is the one that actually tracks it, since context versions has nothing loadout-aware in the picker today. If you use both loadouts in the same content, context cannot tell them apart and per-loadout keybinds is the only route that works.</p>
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
        <p style={{ marginTop: 12 }}>The real interval range is 1 to 50 steps. An interval of 1 weaves a copy in after every base step; 2, which is also the value a new interleave starts at when you first add one, is the most common source of people thinking 2 is the floor. It is only the default, not the minimum.</p>
        <p style={{ marginTop: 12 }}>Interleave does not require a Loop block. It works fine sitting at the top level of a sequence, and it works inside a Loop too, but the interval counts against a different population of steps depending on where it lives. At the top level it spaces against every compiled base step in the whole sequence. Inside a Loop, it spaces against that loop&apos;s own steps after its Repeat count has been unrolled, and only that loop&apos;s steps. The same interval number produces different real-world spacing depending on which of those two scopes it is sitting in, which is worth checking if an interleaved action seems to fire more or less often than you expected.</p>
        <p style={{ marginTop: 12 }}>There is a hard budget of 200 interleave copies across a sequence. Past that, later interleaves quietly get fewer copies inserted than you asked for rather than erroring, and it is easy to hit once a Repeat count on a loop duplicates the underlying list. If an interleaved action seems to be firing less often than its interval implies on a sequence with several other interleaves already running, that budget is worth checking before anything else.</p>
        <p style={{ marginTop: 12 }}>The editor marks any interleaved row with an <code style={code}>[IL:N]</code> indicator so you can see at a glance which steps are woven in versus part of your authored rotation.</p>
        <GuideCallout>
          If your interval is larger than the block it lives in, the action never gets a chance to fire and compiles to nothing. GRIP-EMS now warns you when this happens, names the action, tells you the block's actual step count, and suggests an interval or Repeat count that would make it fit. If a trinket or buff you set up on interleave never seems to go off, check for this warning first before assuming the trinket itself is broken.
        </GuideCallout>
      </GuideSection>

      <GuideSection title="Plugin support">
        <p>GRIP-EMS exposes a public plugin API so other addons can extend it without touching its source. Everything goes through one frozen entry point, <code style={code}>GRIPEMS.API</code>, and it is owner-scoped and isolated per plugin, so a bug in someone else's plugin breaks their plugin, not your sequences. Anything a plugin adds is owned by its plugin id and reverts cleanly the moment that plugin is disabled, no leftovers in your settings or your sequences.</p>
        <p style={{ marginTop: 12 }}>This is the kind of thing you will only ever notice if you run an addon that uses it. If a plugin adds a new export format, it shows up alongside the built-in one in the export window's format picker. If a plugin adds settings, they appear inside its own panel rather than scattered through GRIP-EMS's existing menus. None of this changes default behavior for anyone who is not running a plugin.</p>
        <p style={{ marginTop: 12 }}>As of v2.3.0, the API extends to action bars specifically. A plugin can put one of your sequences directly on an action button, reading per-step spell data, creating and picking up that sequence's macro, and registering its own <code style={code}>/gems</code> subcommand to go with it. Same rule applies: nothing changes unless you are running a plugin.</p>
        <p style={{ marginTop: 12 }}>If you build addons and want to extend GRIP-EMS yourself, the full API reference, including the security model and every method by access tier, lives at <a href="https://jesperlive.github.io/GRIP-EMS-PluginAPI/" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>jesperlive.github.io/GRIP-EMS-PluginAPI</a>. That documentation is the authoritative source for plugin development, this guide is written for sequence builders rather than addon authors, but the rest of this section covers enough to get a first plugin off the ground.</p>
        <p style={{ marginTop: 16 }}>If you want to build something that ships your own sequences, or hooks into GRIP-EMS more deeply than a settings panel can, the plugin API is the place to start, and it is a smaller lift than it looks. The docs site has a Getting started page and a working example under <code style={code}>examples/MyFirstPlugin</code> in the repo, and the <a href="https://github.com/JesperLive/GRIP-EMS-PluginAPI/wiki" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>wiki</a> carries additional detail. A plugin is just its own addon that declares GRIP-EMS as a dependency in its <code style={code}>.toc</code> (<code style={code}>## Dependencies: GRIP-EMS</code> makes WoW load EMS first and refuse to load you without it) and calls into <code style={code}>GRIPEMS.API</code> from <code style={code}>PLAYER_LOGIN</code> rather than at file scope.</p>
        <p style={{ marginTop: 12 }}>Shipping a set of your own sequences is close to the smallest thing you can build with it. Check <code style={code}>RequireVersion</code>, then call <code style={code}>API:RegisterSequences</code> with a plugin name, a version string, an ordered list of sequence names, and a table keyed by those names. GRIP-EMS namespaces whatever you register under your plugin's own name, and a user's own sequence with the same name always wins on a clash, so a plugin cannot silently overwrite someone's personal work. Build each sequence inside GRIP-EMS itself and export it rather than hand typing the table, the exported shape is what <code style={code}>RegisterSequences</code> expects.</p>
        <p style={{ marginTop: 16 }}><code style={code}>RegisterSequences</code> covers shipping fixed sequences, but a plugin that builds sequences on the fly, generating a rotation from a log or a stat weight rather than shipping a hand-authored one, needs to know the action tree: the five node shapes GRIP-EMS actually compiles a sequence's steps from underneath the editor's UI.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
          {[
            { label: 'action', desc: <>One compiled step: <code style={code}>{'{type="action", macro="/cast [combat] Kill Command", interval=N}'}</code>. <code style={code}>interval</code> is optional, 1 to 50, and weaves a copy of that action in every N steps, the same mechanism the editor&apos;s Interleave setting drives.</> },
            { label: 'loop', desc: <>Runs its children N times, 1 to 50, with its own step function: <code style={code}>{'{type="loop", children={...}, ["repeat"]=N, stepFunction="Sequential"}'}</code>. Lets a Sequential opener and a Priority body live in one sequence.</> },
            { label: 'if', desc: <>Branches on a macro conditional: <code style={code}>{'{type="if", variable="[combat]", children={{true branch}, {false branch}}}'}</code>. <code style={code}>variable</code> compiles down to <code style={code}>[cond]</code> on the resulting macro line, it is not a live runtime check.</> },
            { label: 'pause', desc: <>Emits N empty steps, a deliberate dead press for holding a GCD open: <code style={code}>{'{type="pause", clicks=N}'}</code>. Anything below 1 clamps up to 1, there is no zero-click pause.</> },
            { label: 'embed', desc: <>Inlines another of the user&apos;s own EMS sequences by name at that point in the tree: <code style={code}>{'{type="embed", sequence="Name"}'}</code>. It reads that target sequence&apos;s already-compiled steps directly.</> },
          ].map(r => (
            <div key={r.label} style={{ display: 'flex', gap: 14, fontSize: 'var(--text-sm)', alignItems: 'flex-start' }}>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)', flexShrink: 0, minWidth: 70, fontFamily: 'monospace' }}>{r.label}</span>
              <span style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>{r.desc}</span>
            </div>
          ))}
        </div>
        <p style={{ marginTop: 16 }}>A few of these are worth building defensively around rather than finding out about them from a bug report. An <code style={code}>if</code> node with an empty or unparseable conditional compiles to nothing, silently, no error shown to the user. Semicolon fallback syntax inside the conditional box is rejected outright, so validate whatever gets typed in there before it saves. A condition also only gets injected into commands the macro engine actually recognizes as conditional-capable; anything outside that set passes the line through unchanged and the condition is quietly dropped. An <code style={code}>embed</code> pointing at a sequence name that does not exist compiles to nothing just as silently, and since it reads the target&apos;s already-compiled steps rather than compiling them itself, embedding a sequence that has never actually been activated in EMS can also come back empty. Nesting is capped at 10 levels deep, on top of the 1 to 50 caps already mentioned on <code style={code}>loop</code> and <code style={code}>pause</code>.</p>
        <p style={{ marginTop: 12 }}>One field on a version is easy to get backwards: <code style={code}>repeatCount</code>. A value of <code style={code}>nil</code>, <code style={code}>0</code>, or <code style={code}>1</code> all mean no wrap at all, the sequence just cycles the normal way. Only 2 or higher does anything, and what it does is wrap the entire compiled action list in a synthetic Sequential loop and inline that many copies at compile time, capped at 50. The part that actually catches people: the version&apos;s own step function applies at runtime, over the already-duplicated list, not over your original one. <code style={code}>repeatCount</code> 3 combined with Priority runs the Priority expansion over the tripled list, so a 10-action sequence can balloon to 465 compiled slots rather than the number you would expect from Priority alone. Leave <code style={code}>repeatCount</code> at 0 unless the step function is Sequential.</p>
        <p style={{ marginTop: 12 }}>Two read calls are worth knowing if your plugin needs to inspect a sequence rather than just register one. <code style={code}>API:GetAuthoredSteps(name)</code> hands back the steps in the order you actually wrote them, loops unrolled and branches flattened, with no interleave copies. <code style={code}>API:GetSequenceSteps(name)</code> hands back the real execution order after the step function has expanded it, Priority triangle and all. Comparing the two lengths is a fast way to see whether a step function expansion or an interleave setting produced the count you expected. <code style={code}>GetAuthoredSteps</code> is newer than the current API version number suggests, so feature-detect it with <code style={code}>if API.GetAuthoredSteps then</code> rather than gating on <code style={code}>RequireVersion</code> alone.</p>
        <GuideCallout>
          If you are building with an AI assistant, paste the AI context pack from the docs site into the conversation before asking for any code. Without it, a model will confidently invent API methods that do not exist, and you will spend real time debugging code that was never going to load. The docs site has a short guide on this exact failure mode with prompts you can copy. The rule worth keeping: if a method the AI wrote is not listed on that context pack page, it does not exist.
        </GuideCallout>
        <p style={{ marginTop: 12 }}>The API keeps its own changelog, separate from the main GRIP-EMS changelog, tracking only what moved on the plugin surface itself. Worth a bookmark if you are maintaining a plugin, since a release can add a capability without bumping the API version number when the addition is purely additive, which means a presence check is sometimes the only reliable way to detect something new.</p>
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
        <p style={{ marginTop: 12 }}>What gets written to disk when you save is a related but separate question from what gets displayed, and it has its own history worth knowing. Through v2.4.8, a step could get its stored spell swapped out from under you by whatever the game was calling that spell at the exact moment you hit save, rather than the spell you actually own. Blood DK running San&apos;layn was the worst case of it, Heart Strike silently stored as Vampiric Strike while the buff happened to be up, and Ravage on Druid of the Claw had the same problem. Fixed in v2.4.9: EMS now stores the spell you actually own on both save and load, and any step that got corrupted this way before the fix corrects itself automatically on your next login. A second, differently-shaped version of the same category of bug affected talent-driven overrides specifically, where editing one version of a sequence could re-derive and overwrite the spell names stored in sibling versions you had not touched. v2.4.13 closed one of the three mechanisms behind that; v2.4.14 closed the remaining two. If you are on anything earlier than v2.4.14, treat any override or proc-swapped spell in a saved sequence as worth a manual check after an update, rather than assuming it survived untouched.</p>
      </GuideSection>

      <GuideSection title="Sharing sequences and authorship">
        <p>As of v2.4.8, GRIP-EMS actively protects authorship on anything you did not write yourself. Send a sequence to someone, answer a request for one, or run <code style={code}>/gems export</code> on it, and if you are not the original author, EMS names who is and waits for you to confirm before it goes out. That check follows the content itself rather than a copy count, so a copy of a copy still traces back to whoever actually wrote it. Your own work is completely unaffected by this, no prompt on anything you wrote, however many times you send it or however many copies exist.</p>
        <p style={{ marginTop: 12 }}>Two related fixes landed in the same release. Marking a sequence do-not-share used to fall off quietly the moment you duplicated it, saved it, renamed it, or retyped its Raw tab contents, and every sharing route would then treat the copy as shareable even though the original was not. The mark now survives all of that, and every sharing route refuses the copy exactly like it refuses the original. Separately, opening someone else&apos;s sequence and hitting Save, or duplicating one, used to silently re-stamp it with your name as the author. Both of those are gone; what EMS asks about now follows the actual content, not whichever account most recently touched the save button.</p>
      </GuideSection>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 48, paddingTop: 24, borderTop: '0.5px solid var(--border)' }}>
        <Link href="/guide/how-it-works" style={{ fontSize: 'var(--text-sm)', color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>
          Back: How it works
        </Link>
        <Link href="/guide/building-sequences" style={{ fontSize: 'var(--text-sm)', color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>
          Next: Building sequences
        </Link>
      </div>
    </div>
  )
}
