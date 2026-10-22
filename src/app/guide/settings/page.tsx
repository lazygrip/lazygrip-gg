import Link from 'next/link'
import type { Metadata } from 'next'
import GuideHeader from '@/components/guide/GuideHeader'
import GuideSection from '@/components/guide/GuideSection'
import GuideCallout from '@/components/guide/GuideCallout'
import GuideImage from '@/components/guide/GuideImage'
import { guideCodeStyle } from '@/components/guide/GuideCode'

export const metadata: Metadata = {
  title: 'Settings | GRIP-EMS Guide',
  description: 'The GRIP-EMS settings that actually determine whether your sequences run smoothly. SQW, Key Down Casting, Hold While Channeling, click rate, Auto-adjust, the Dynamic SQW Optimiser, the Tempo Advisor, and how they all connect.',
  alternates: {
    canonical: 'https://lazygrip.net/guide/settings',
  },
  openGraph: {
    title: 'Settings | GRIP-EMS Guide',
    description: 'The GRIP-EMS settings that actually determine whether your sequences run smoothly. SQW, Key Down Casting, Hold While Channeling, click rate, Auto-adjust, the Dynamic SQW Optimiser, the Tempo Advisor, and how they all connect.',
    url: 'https://lazygrip.net/guide/settings',
    siteName: 'LazyGrip.net',
    type: 'website',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'LazyGrip.net — GRIP-EMS sequences for World of Warcraft' }],
  },
}

const code = guideCodeStyle

export default function SettingsPage() {
  return (
    <div style={{ maxWidth: 720 }}>
      <GuideHeader
        crumbLabel="Settings"
        title="Settings"
        description={
          <>
            <p style={{ marginBottom: 8 }}>
              A quick note on terminology before anything else. <strong style={{ color: 'var(--text-primary)' }}>ms</strong> means milliseconds. 1000ms is one second. Your <strong style={{ color: 'var(--text-primary)' }}>latency</strong> is your ping, the world-ms number WoW shows you in the network display. It comes up a lot below.
            </p>
            <p style={{ marginBottom: 8 }}>
              The one idea everything else on this page hangs on is that GRIP-EMS runs exactly one step of your sequence for every real keypress it receives, and it never ignores a press, so if you press faster than your spells can actually land you run past steps before they fire, which is why the pace of your presses and the window WoW gives you to queue the next spell matter far more than they look like they should.
            </p>
            <p>
              Installing GRIP-EMS is the easy part. The settings that determine whether your sequences feel smooth or stuttery are spread across three different WoW menus; only one of them is handled for you, the rest are left at defaults that were never tuned for your connection or your sequence, and most guides either skip them entirely or mention them once without explaining what they do. This page covers all of them and explains the why behind each one, because knowing why lets you tune them for your setup instead of just copying someone else&apos;s numbers.
            </p>
          </>
        }
      />

      <GuideSection title="Key Down Casting">
        <p style={{ marginBottom: 4, fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Automatic as of v2.3.14</p>
        <p>This is the WoW setting <code style={code}>ActionButtonUseKeyDown</code>. It controls whether your abilities fire when you <strong style={{ color: 'var(--text-primary)' }}>press</strong> a key or when you <strong style={{ color: 'var(--text-primary)' }}>release</strong> it. GRIP-EMS fires on the press, and it needs this set to on to work correctly. Leave it off, and your sequence either does not advance at all or advances on the wrong event, with an extra 50 to 100ms of dead time on every single press, eating into your rotation.</p>
        <p style={{ marginTop: 12 }}>It is also the one setting on this page that is not a preference. Everything else here is tuning, and this one is mandatory, because the press is what advances the sequence to the next step. As of GRIP-EMS v2.3.14 you do not have to do anything about it: every time you log in, while you are out of combat, the addon checks the value and sets it to 1 if it is anything else, whether or not you have ever opened the settings and whether or not Auto-Fix CVars on Login is turned on. On the current releases, v2.3.14 through v2.4.21, it has no row in the CVar Health tab at all, since a setting the engine cannot run without is not a recommendation you weigh up. Run <code style={code}>/gems status</code> any time to read the live value.</p>
        <GuideCallout>
          On a version older than 2.3.14, you will still need to fix this yourself. Run /gems settings, go to the CVar Health tab, and click Fix if the row is not green. Do it outside of combat; WoW locks some CVars while you are in a fight, which is why the Fix buttons grey out mid-pull. The Installation page covers this in more detail for older versions.
        </GuideCallout>
        <GuideCallout>
          That check happens at login and nowhere else. If something flips the setting mid-session, another addon or a change in WoW&apos;s own options for example, you will not get it back until you log in or /reload, so if a sequence goes dead right after you were fiddling with settings, check /gems status before you blame the sequence. And if you ever see a Key Down Casting row in CVar Health, on an older build or on a newer one that shows it, it should read 1, and the Fix button on that row is the quickest repair.
        </GuideCallout>
        <p style={{ marginTop: 12 }}>While you are in that part of CVar Health, Hold to Cast (<code style={code}>ActionButtonUseKeyHeldSpell</code>) is the neighbour worth knowing about. It should stay off, which is the recommended value, because turning it on enables a press-and-hold cast path that retries on errors in a way some macros do not expect, and the default of off works for almost everyone.</p>
      </GuideSection>

      <GuideSection title="Hold While Channeling">
        <p style={{ marginBottom: 4, fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Added in v2.4.0 · Works on any channel as of v2.4.14 · Set per sequence version</p>
        <p>This setting decides what happens when your keypress lands in the middle of a channel. Without it, a press mid-channel casts nothing and still burns a step, which is the same dead-step problem covered elsewhere on this page, just triggered by a channel instead of a cooldown. With Hold cursor on, a press landing mid-channel casts nothing and leaves the step counter where it was, so the channel finishes and the next real press picks up from the same step instead of one further along.</p>
        <p style={{ marginTop: 12 }}>There is a third option, Hold + release at max, that ends an empowered spell the moment it reaches maximum rank rather than wasting time sitting at max charge while you keep pressing.</p>
        <GuideCallout>
          Through v2.4.13, the entire Hold While Channeling control only appeared in the dropdown if your spellbook contained an actual empowered spell, in practice meaning Evoker, even though the underlying hold mechanism has always worked correctly on any channeled spell for any class. That gating was a UI bug, not a design decision, and it is fixed in v2.4.14: the setting now shows for everyone. If you play a spec with a channel and no empowered spell, such as Shadow Priest&apos;s Mind Flay or Void Torrent, you now have this option where you did not before.
        </GuideCallout>
        <p style={{ marginTop: 12 }}>This matters beyond convenience. As of the v2.4.14 release, using Hold While Channeling properly is the addon author&apos;s own stated replacement for hand-writing <code style={code}>[channeling]</code> and <code style={code}>[nochanneling]</code> guards into your step conditionals: fewer characters spent on conditionals per step, and more consistent behavior than chaining bracket logic by hand. It does not remove the need for <code style={code}>[combat]</code>, which still matters for the reasons covered on the <Link href="/guide/how-it-works" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>How it works</Link> page.</p>
        <p style={{ marginTop: 12 }}>If you are sequencing a charged or empowered spell like Fire Breath or Upheaval, Hold While Channeling, and specifically Hold + release at max, is now the first thing to reach for rather than the guard-step or separate-key workarounds on the <Link href="/guide/building-sequences" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>Building sequences</Link> page. Those workarounds predate this fix and existed specifically to route around the automated-cancel hitch that Hold + release at max is built to solve directly. Try the setting first; fall back to the guard-step or separate-key approach only if it does not behave the way you need for your spec.</p>
      </GuideSection>

      <GuideSection title="Spell Queue Window">
        <p style={{ marginBottom: 4, fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Settings {'>'} CVar Health {'>'} Macro Sequencing</p>
        <p>The WoW setting <code style={code}>SpellQueueWindow</code>. This controls how many milliseconds before a GCD ends WoW will accept your next cast input. Blizzard's default is 400ms, which is also the ceiling. You can also set it by hand with the /console SpellQueueWindow command, which takes 0 to 400. GRIP-EMS surfaces it in CVar Health so you do not have to go hunting for it.</p>
        <p style={{ marginTop: 12 }}>The way it works: say your GCD is 1.5 seconds. With SQW at 400ms, the queue window opens at 1100ms into that GCD. Any press inside that window gets queued. The last press before the GCD ends is the one that fires, replacing anything queued before it, and anything you press before the window opens is ignored.</p>

        <div style={{
          marginTop: 16,
          padding: '14px 16px',
          background: 'var(--bg-primary)',
          border: '0.5px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          fontSize: 'var(--text-sm)',
          color: 'var(--text-secondary)',
          lineHeight: 1.6,
        }}>
          <strong style={{ color: 'var(--text-primary)' }}>Example:</strong> GCD is 1.5s, SQW is 400ms. Queue window opens at 1100ms. You press at 1200ms and again at 1450ms. The 1450ms press is what fires.
        </div>

        <GuideCallout>
          The trap most people fall into: setting SQW lower than your latency. If your ping is 120ms and you force SQW down to 50ms, your queued press can reach the server too late to register, which means dead GCDs and a rotation that feels like it skips. SQW must always be higher than your latency. If you are unsure, turn the Dynamic SQW Optimiser on (it is off by default) and let it handle the math for you.
        </GuideCallout>
      </GuideSection>

      <GuideSection title="Dynamic SQW Optimiser">
        <p style={{ marginBottom: 4, fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Settings {'>'} CVar Health</p>
        <p>This is the setting that does the SQW math for you and keeps it updated as your connection moves around during a session. It is off by default, so nothing described in this section happens until you tick Dynamic SQW Optimiser in CVar Health (or type <code style={code}>/gems sqw on</code>). Once it is on, it continuously monitors your world latency, using a smoothed average sampled every 10 seconds, ignoring one-off spikes that would otherwise throw your numbers off. From that, it sets SQW to your current latency plus a configurable Safety Buffer, kept inside the 50 to 400ms ceiling, and it only touches the CVar when the new number differs from the current one by 15ms or more, so it settles instead of flickering.</p>
        <p style={{ marginTop: 12 }}>So if your latency is 120ms and your Safety Buffer is 50ms, SQW lands at around 170ms. Your latency jumps to 160ms mid-key, SQW adjusts.</p>

        <div style={{ padding: '12px 14px', background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: 16 }}>
          <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>Safety Buffer</div>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.6 }}>Yours to set between 50 and 200ms, and the default is 100ms, which is a sensible middle ground for most players. Higher buffer means fewer dropped presses, lower feels snappier. If your connection is stable and low-latency, push it lower. If it is inconsistent, go higher.</div>
        </div>

        <p style={{ marginTop: 16 }}>While the Optimiser is running, it has exclusive control over the SQW value. You will see "Managed by SQW Optimiser" in the manual control and the slider locks. If you want to set SQW by hand, turn the Optimiser off first. The health score treats a managed SQW as handled, so it will not cost you points while the Optimiser is running.</p>
        <p style={{ marginTop: 12 }}>With the Optimiser on, the panel also shows a <strong style={{ color: 'var(--text-primary)' }}>Recommended click rate</strong> under the Safety Buffer slider, worked out from your live GCD, the SQW it just set, and your latency, as GCD minus SQW plus latency, with a floor of 100ms. If your GCD is 1500ms, your SQW is 170ms and your latency is 120ms, that comes to 1450ms, which is the pace of one press per GCD. A line underneath compares it with your own setting, something like &quot;Your setting: 10ms (1440ms faster than the recommendation)&quot;, coloured green when you are within 50ms of it, yellow within 100ms, and red beyond that. Treat it as a guide and not a rule, and know that it is the same number for every sequence you own, because it knows nothing about your sequence; the per-sequence version of the idea is the Tempo Advisor further down.</p>
        <GuideImage
          src="/guide/sqw-optimiser.png"
          alt="The Dynamic SQW Optimiser panel showing the Safety Buffer slider and managed SQW value"
          caption="The Optimiser managing SQW automatically. The slider locks and shows &quot;Managed by SQW Optimiser&quot; while it's running."
        />
        <GuideCallout>
          The SQW Optimiser tunes one thing: the SpellQueueWindow CVar, based on your latency. It does not look at your sequence or your spells, and it never changes your click rate; the Recommended click rate it shows is information only. For a number that fits the sequence you are actually playing, that is the Tempo Advisor below, a separate system entirely.
        </GuideCallout>
      </GuideSection>

      <GuideSection title="Finding your way around CVar Health">
        <p style={{ marginBottom: 4, fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Settings {'>'} CVar Health</p>
        <p>The CVar Health dashboard grew to 255 game variables across 14 sections in v2.3.13, up from 212 before that, and on v2.4.21 it covers 284 across the same 14 sections. The exact count is printed at the top of the tab, so go by that and not by any number written here. The newer sections cover Combat Audio, nameplate content toggles, accessibility motion and vision settings, raid graphics mirrors, and dragonriding comfort options, alongside the SQW setting this page already covers in detail.</p>
        <p style={{ marginTop: 12 }}>With that many CVars, finding a specific one by scrolling is no longer realistic, so the tab got a few navigation aids. A search box lets you type part of a CVar's name and jump straight to it. A show-only-issues filter hides every row that is already correctly set, so you see just what needs attention. Section headers are colour-coded, meaning a section containing a misconfigured row shows red before you even expand it, so you know where to look without opening every section in turn.</p>
        <p style={{ marginTop: 12 }}>Numeric CVars, more than fifty of them, are sliders rather than typed fields, and on/off CVars are tickboxes. The graphics dropdowns pull their tier names directly from the game client, so options like shadow quality, SSAO, and liquid detail match the wording in WoW&apos;s own System menu instead of using GRIP-EMS&apos;s own labels. maxFPS goes up to 300.</p>
        <p style={{ marginTop: 12 }}>Up at the top of the tab you get a CVar Health score out of 100, with a Why this score list underneath that names the settings costing you points and how much each one weighs, and the colours mean what you would hope: green is optimal, yellow is suboptimal, red is critical, and grey is informational. Fix All Critical repairs the red rows (it skips anything you have pinned, and it skips SQW while the Optimiser is running), and it also marks those rows as opted in for Auto-Fix CVars on Login, which is off until you turn it on and, once it is on, only touches the rows you have opted in. Reset All to Blizzard Defaults does exactly what it says. A row you pin with Pin My Choice is yours: EMS will not change it. If WoW or another addon moves a CVar between sessions, a banner reads something like &quot;1 CVars changed since last session&quot; and names the likely cause, a game patch reset, another addon or the UI, an auto-fix, or a profile swap, so you can see who touched what instead of guessing. Set all of this out of combat, since WoW locks some of these CVars mid-fight and the Fix buttons grey out until you leave it.</p>
        <GuideCallout>
          None of this changes what any individual CVar does or how you should set it, including SQW and Key Down Casting above. It only changes how you find and adjust them. If you learned the old dashboard layout before v2.3.13, the values and recommendations on this page still apply; only the search, filtering, and slider presentation are new.
        </GuideCallout>
      </GuideSection>

      <GuideSection title="The Delve CVar profile">
        <p style={{ marginBottom: 4, fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Automatic as of v2.3.12</p>
        <p>GRIP-EMS ships with built-in CVar profiles that swap automatically based on the content you are in, and as of v2.3.12 Delves get their own dedicated profile rather than running on the same baseline as general open-world content. Before this, a Delve run used your General graphics profile even though the addon already knew you were inside a Delve, which meant nameplate range and soft-targeting were tuned for the wrong context.</p>
        <p style={{ marginTop: 12 }}>The built-in Delve profile turns on enemy minion nameplates, extends nameplate range to 41 yards, and widens the soft-target arc, all automatically the moment you enter a Delve, at any tier, with no setup required on your part.</p>
        <GuideCallout>
          If you had already mapped your own custom profile onto Delves before v2.3.12, your mapping still takes priority. The rule is that a manual mapping on a tier key always beats the built-in default. If you want the new built-in behavior instead of your old custom mapping, go to the Profile Map Editor and remap the DelvesLow and DelvesHigh tier keys back to the built-in profile.
        </GuideCallout>
      </GuideSection>

      <GuideSection title="Click Rate">
        <p style={{ marginBottom: 4, fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Settings {'>'} General</p>
        <p>How fast you are pressing your sequence key, in milliseconds. GRIP-EMS advances one step per keypress and does not cap how fast you press, so this number is really a reference point that also controls the timing of any imported pauses in a sequence. This is the global value, shared by every character you play, the default is 250ms, and the slider runs from 100 to 1000ms in steps of 10, so it will not go below 100ms.</p>
        <p style={{ marginTop: 12 }}>The reason it floors at 100ms is that nobody is realistically pressing a key faster than ten times a second, and at that speed, you would be running past steps before the spells they contain can land. GRIP-EMS calls 100ms the human and hardware floor.</p>
        <p style={{ marginTop: 12 }}><strong style={{ color: 'var(--text-primary)' }}>Per-Character Click Rate</strong>, under the same menu, is a setting scoped to your current character only and overrides the global value while that character is active, unless Auto-adjust below is supplying a number for the sequence you are running. You set it on each character separately. Range is 0 to 1000ms in steps of 10. Set it to 0 to fall back to the shared global value. This is also the only way to go below the 100ms floor if you have an edge case that needs it, down to 10ms. GRIP-EMS will pop a warning on screen when you drop under 100.</p>
        <GuideCallout>
          Pressing faster than your spells can land does not make your rotation faster. The GCD is the real speed limit, around 1.5 seconds for most specs and shorter with haste. If you are pressing at 80ms and your GCD is 1.4 seconds, you are firing roughly 17 keypresses per GCD and advancing the sequence 17 steps before a single spell lands. That is not a faster rotation; it is a broken one. The Tempo Advisor below is the addon&apos;s own read on what pace fits the sequence you are playing.
        </GuideCallout>
      </GuideSection>

      <GuideSection title="Auto-adjust click rate per sequence">
        <p style={{ marginBottom: 4, fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Settings {'>'} Faster, Slower</p>
        <p>This is a checkbox, it is on by default, and it quietly overrules the number you typed in. With it on, GRIP-EMS uses the Tempo Advisor&apos;s recommendation for the sequence you are pressing in place of your Click Rate and your Per-Character Click Rate for as long as that sequence is the active one, and you can tell it is happening because the Click Rate slider&apos;s label changes to something like &quot;Auto: 1350ms&quot; followed by the sequence name. The order of who wins is Auto-adjust first, then your Per-Character Click Rate, then the global Click Rate, and Auto-adjust only gets a say once the Advisor actually has a recommendation for that sequence.</p>
        <p style={{ marginTop: 12 }}>Turn it off if you would rather your manual number always win, which is the fix for anyone who set a Per-Character Click Rate on purpose and wondered why it never seemed to do anything. Because EMS does not rate limit your presses, none of this changes how fast you actually press; it changes the reference number EMS uses for the Faster, Slower recommendation and for the timing of imported pauses.</p>
      </GuideSection>

      <GuideSection title="Keybind Conflicts">
        <p style={{ marginBottom: 4, fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Added in v2.4.0 · /gems keys or the Keybind tab</p>
        <p>Run <code style={code}>/gems keys</code>, or click Check Conflicts on the Keybind tab, and GRIP-EMS checks every key your sequences use, plus vehicle and pet battle slots, against your saved bindings: what the keypress actually reaches, cast-redirect modifiers, and click bindings. Where it can identify the addon behind a conflicting binding, it names it directly, and it clears two known kinds of conflict for you automatically.</p>
        <p style={{ marginTop: 12 }}>This is the tool for the recurring question of why a key works on one character and does nothing on another. Different characters can carry different addon-set or click bindings on the same physical key, and this check surfaces that instead of leaving you to hunt through every addon's keybind panel by hand.</p>
        <p style={{ marginTop: 12 }}>Three things changed in v2.4.21. The panel now reads branches written with a modified-click action, such as <code style={code}>[mod:SELFCAST]</code>, and it checks the key each modifier variant is bound to, where before a key taken by something else could still show as clear. It also tells you, under that sequence&apos;s key, when a branch can never run, which is what happens to <code style={code}>[mod:SELFCAST]</code> when Self Cast is set to None in the game&apos;s options. And with Per-loadout keybinds on, it checks the keys saved to your active talent loadout, the same ones the game binds, and follows a switch of loadout or spec while it is open.</p>
        <p style={{ marginTop: 12 }}>The Fix button changed too, and this one is worth reading before you press it. Clearing a cast redirect means setting Self Cast, Focus Cast or Mouseover Cast to None, and that stops every branch that checks the same setting in any of your sequences. With account-wide key bindings the setting is shared, so it stops those branches on your other characters that use account-wide bindings as well. Fix All no longer touches those rows, and a row&apos;s own Fix names the setting and the sequences that use it and asks before it changes anything.</p>
        <GuideImage
          src="/guide/keybind-conflicts.png"
          alt="The keybind conflict checker listing a key and what owns it"
          caption="Check Conflicts run against a sequence's key. It names whatever else has claimed the bind, including the modifier combinations."
        />
        <GuideCallout>
          If a fix does not stick, run <code style={code}>/gems keys</code> again and use Undo, which backs out the last change if something else grabbed the key in the meantime.
        </GuideCallout>
      </GuideSection>

      <GuideSection title="Tempo Advisor">
        <p style={{ marginBottom: 4, fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Settings {'>'} Faster, Slower</p>
        <p>This is a different system from the SQW Optimiser above, and it is worth being precise about the difference because the two get confused constantly in the Discord. The SQW Optimiser tunes a WoW CVar based on your latency. The Tempo Advisor analyses your actual sequence and your actual play to recommend a click rate, in milliseconds between keypresses, that fits how that specific sequence is built and how you actually play it.</p>
        <p style={{ marginTop: 12 }}>It starts from a theoretical estimate the moment you save a sequence: it classifies every spell into one of seven timing categories (off-GCD, on-GCD instant, on-GCD with a cast time, a long cast, a channel, a pause step, or unknown if the spell data is not cached yet), builds a transition graph between your steps, and sums GCD durations and cast times across that graph to estimate the time between presses your sequence actually needs.</p>
        <p style={{ marginTop: 12 }}>That estimate gets more accurate the more you play. After 30 logged samples from the addon&apos;s execution tracer, the Advisor blends real combat data into the recommendation at a 70% theoretical, 30% empirical mix. It only counts samples taken while you are actually pressing and casting, and it falls back to the theoretical number whenever that live data has gone stale, such as when you stop playing the sequence for a bit. Which of your spells count as off the GCD is stamped with the game build and cleared automatically after a patch, because Blizzard moves spells on and off the GCD between patches and an old classification would skew the number. Every sequence stores its own recommendation, sample count, and blend ratio, and it persists across sessions rather than resetting every login, and it also reads your live SQW and latency in that math, so the Optimiser&apos;s value feeds straight into it when the Optimiser is on.</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
          {[
            { label: 'Estimated', desc: 'Confidence level before 30 play samples are collected. The recommendation is theory-only at this point.' },
            { label: 'Calibrated', desc: 'Confidence level once 30 or more samples are in. The recommendation now reflects how you actually play that sequence.' },
          ].map(r => (
            <div key={r.label} style={{ display: 'flex', gap: 14, fontSize: 'var(--text-sm)', alignItems: 'flex-start' }}>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)', flexShrink: 0, minWidth: 110 }}>{r.label}</span>
              <span style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>{r.desc}</span>
            </div>
          ))}
        </div>

        <p style={{ marginTop: 16 }}>The Faster, Slower page has five checkboxes. Auto-adjust click rate per sequence is covered just above. Show click rate overlay puts up a movable overlay that shows your current click rate against the recommendation, with a delta bar so you can see at a glance how far off you are. Show CPS sparkline adds a rolling line of your actual clicks per second over the last few presses. Enable mismatch alerts is off by default, and once you turn it on it warns you when your pace drifts too far from the recommendation, with a visual cue and a sound by default, which is useful if you are not watching the overlay during a pull. The fifth, Enable Hold Mode, lets the Advisor manage Hold to Cast and is off by default.</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 16 }}>
          {[
            { cmd: '/gems fs', desc: 'Show the Tempo Advisor readout for your current sequence' },
            { cmd: '/gems fs <sequence name>', desc: 'Show the readout for a specific sequence' },
            { cmd: '/gems fs overlay', desc: 'Show or hide the Faster, Slower overlay' },
            { cmd: '/gems fs lock', desc: 'Lock or unlock the overlay so it cannot be dragged' },
            { cmd: '/gems fs alert', desc: 'Turn mismatch alerts on or off' },
            { cmd: '/gems fs reset', desc: 'Clear the off-GCD classifications EMS has learned and re-run the analysis on your loaded sequences' },
          ].map(item => (
            <div key={item.cmd} style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px', alignItems: 'baseline', fontSize: 'var(--text-sm)' }}>
              <code style={{
                fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)',
                color: 'var(--accent)', background: 'var(--accent-subtle)',
                padding: '2px 8px', borderRadius: 'var(--radius-sm)',
                flexShrink: 0, maxWidth: '100%', overflowWrap: 'anywhere',
              }}>
                {item.cmd}
              </code>
              <span style={{ color: 'var(--text-secondary)' }}>{item.desc}</span>
            </div>
          ))}
        </div>

        <GuideImage
          src="/guide/tempo-advisor.png"
          alt="Tempo Advisor chat output recommending a click rate for the current sequence"
          caption="A Tempo Advisor readout in chat, showing the recommended click rate for the sequence actually being played."
        />
        <GuideCallout>
          Editing a sequence does not wipe what the Advisor has already stored for it, and /gems fs reset will not clear those samples either, since it only clears the learned off-GCD classifications. So after a major rework of a sequence, give the new version a good number of real pulls before you trust a Calibrated number, because some of what it is calibrated on came from the old step structure.
        </GuideCallout>
      </GuideSection>

      <GuideSection title="Spell Cache Viewer">
        <p style={{ marginBottom: 4, fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>/gems spellcache</p>
        <p>The cached spell data GRIP-EMS uses for icon resolution, autocomplete, and the Tempo Advisor's spell classification all lives in one place you can inspect directly. Run <code style={code}>/gems spellcache</code>, search by spell name or spell ID, and see exactly what the addon has resolved it to: the icon and the spell ID behind that name.</p>
        <GuideImage
          src="/guide/spell-cache-viewer.png"
          alt="The Spell Cache Viewer listing spell names, icons, and spell IDs"
          caption="The Spell Cache Viewer. It's a lookup of name-to-icon-and-ID, not a tooltip — there's no cast time, cooldown, or spell school breakdown here."
        />
        <p style={{ marginTop: 12 }}>This is the tool to reach for when a spell icon is not resolving on your tracker or action bar, or when the Tempo Advisor is classifying a spell as unknown instead of one of its real timing categories. A stale or missing cache entry, usually from a spell getting renamed or reworked in a patch, is the most common cause of both. Search for the spell here first before assuming something is broken in your sequence itself.</p>
        <p style={{ marginTop: 12 }}>The cache populates on login and updates automatically when you change spec or talents. If a spell is genuinely missing rather than just stale, <code style={code}>/gems revalidate</code> forces a fresh re-tag of every sequence with current spell IDs, which usually resolves it.</p>
      </GuideSection>

      <GuideSection title="How these settings connect">
        <p>You press the key and GRIP-EMS turns each keypress into one sequence step. The GCD is the actual ceiling on how fast spells can land, regardless of how fast you press. SQW controls the window in which your next press is queued into that GCD, and the SQW Optimiser, once you turn it on, ties that window to your real latency so it is always sized correctly for your connection. The Tempo Advisor is the layer above all of that: it watches your specific sequence and your actual play to tell you the click rate that fits both.</p>
        <p style={{ marginTop: 12 }}>Key Down Casting takes care of itself as of v2.3.14. SQW is yours to either leave at WoW&apos;s 400ms or hand to the Dynamic SQW Optimiser, which stays off until you switch it on. And with Auto-adjust click rate per sequence on, which it is by default, the Tempo Advisor&apos;s number is already being used for the sequence you are pressing without you touching a slider. Everything else on this page is fine-tuning from there.</p>
      </GuideSection>

      <GuideSection title="It is mostly preference">
        <p>Everything on this page except Key Down Casting is optional and down to taste. A sequence that runs perfectly for the person who built it can run badly for you without anyone having done anything wrong, because click rate and SQW are only part of the picture: movement, buffs and debuffs, the fight or scenario you are in, and your gear and stats all change how a sequence feels. There is no one size fits all setting and no one size fits all sequence, so tweak it, test it, and keep what works for you.</p>
      </GuideSection>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 48, paddingTop: 24, borderTop: '0.5px solid var(--border)' }}>
        <Link href="/guide/installation" style={{ fontSize: 'var(--text-sm)', color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>
          Back: Installation
        </Link>
        <Link href="/guide/how-it-works" style={{ fontSize: 'var(--text-sm)', color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>
          Next: How it works
        </Link>
      </div>
    </div>
  )
}
