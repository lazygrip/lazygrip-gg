import Link from 'next/link'
import type { Metadata } from 'next'
import GuideHeader from '@/components/guide/GuideHeader'
import GuideSection from '@/components/guide/GuideSection'
import GuideCallout from '@/components/guide/GuideCallout'
import { guideCodeStyle } from '@/components/guide/GuideCode'

export const metadata: Metadata = {
  title: 'Settings | GRIP-EMS Guide',
  description: 'The GRIP-EMS settings that actually determine whether your sequences run smoothly. SQW, Key Down Casting, Hold While Channeling, click rate, the Dynamic SQW Optimiser, the Tempo Advisor, and how they all connect.',
  alternates: {
    canonical: 'https://lazygrip.net/guide/settings',
  },
  openGraph: {
    title: 'Settings | GRIP-EMS Guide',
    description: 'The GRIP-EMS settings that actually determine whether your sequences run smoothly. SQW, Key Down Casting, Hold While Channeling, click rate, the Dynamic SQW Optimiser, the Tempo Advisor, and how they all connect.',
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
            <p>
              Installing GRIP-EMS is the easy part. The settings that determine whether your sequences feel smooth or stuttery are spread across three different WoW menus; none of them are set correctly by default, and most guides either skip them entirely or mention them once without explaining what they do. This page covers all of them and explains the why behind each one, because knowing why lets you tune them for your setup instead of just copying someone else's numbers.
            </p>
          </>
        }
      />

      <GuideSection title="Key Down Casting">
        <p style={{ marginBottom: 4, fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Automatic as of v2.3.14</p>
        <p>This is the WoW setting <code style={code}>ActionButtonUseKeyDown</code>. It controls whether your abilities fire when you <strong style={{ color: 'var(--text-primary)' }}>press</strong> a key or when you <strong style={{ color: 'var(--text-primary)' }}>release</strong> it. GRIP-EMS fires on the press, and it needs this set to on to work correctly. Leave it off, and your sequence either does not advance at all or advances on the wrong event, with an extra 50 to 100ms of dead time on every single press, eating into your rotation.</p>
        <p style={{ marginTop: 12 }}>As of GRIP-EMS v2.3.14, this is no longer a preference or a manual step. The addon forces it on itself every time you log in, whether or not you have ever opened the settings. It has been removed from the CVar Health tab entirely since it is required for the engine to run, not something you weigh up. Run <code style={code}>/gems status</code> any time to confirm the live value.</p>
        <GuideCallout>
          On a version older than 2.3.14, you will still need to fix this yourself. Run /gems settings, go to the CVar Health tab, and click Fix if the row is not green. Do it outside of combat; WoW locks some CVars while you are in a fight, which is why the Fix buttons grey out mid-pull. The Installation page covers this in more detail for older versions.
        </GuideCallout>
      </GuideSection>

      <GuideSection title="Hold While Channeling">
        <p style={{ marginBottom: 4, fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Added in v2.4.0 · Set per sequence version</p>
        <p>This setting decides what happens when your keypress lands in the middle of a channel. Without it, a press mid-channel casts nothing and still burns a step, which is the same dead-step problem covered elsewhere on this page, just triggered by a channel instead of a cooldown. With Hold cursor on, a press landing mid-channel casts nothing and leaves the step counter where it was, so the channel finishes and the next real press picks up from the same step instead of one further along.</p>
        <p style={{ marginTop: 12 }}>There is a third option, Hold + release at max, that ends an empowered spell the moment it reaches maximum rank. This one only shows up if your spellbook actually has an empowered spell in it, which in practice means Evoker.</p>
        <GuideCallout>
          Known issue: on at least one tester's client, Hold + release at max ends the empower at the first rank instead of maximum, every press, with nothing on screen to say so. It has not reproduced for the addon author and is still being chased as of v2.4.3. If your empowered casts are ending early, set that version back to Hold cursor until this is resolved.
        </GuideCallout>
        <p style={{ marginTop: 12 }}>If you are sequencing a charged or empowered spell like Fire Breath or Upheaval, this setting works alongside the guard-step and separate-key approaches on the <Link href="/guide/building-sequences" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>Building sequences</Link> page rather than replacing them. Hold While Channeling stops a mid-channel press from wasting a step; it does not by itself fix the automated-cancel hitch that page covers.</p>
      </GuideSection>

      <GuideSection title="Spell Queue Window">
        <p style={{ marginBottom: 4, fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Settings {'>'} CVar Health {'>'} Macro Sequencing</p>
        <p>The WoW setting <code style={code}>SpellQueueWindow</code>. This controls how many milliseconds before a GCD ends WoW will accept your next cast input. Blizzard's default is 400ms, which is also the ceiling. WoW calls this Custom Lag Tolerance under Options {'>'} Network. GRIP-EMS surfaces it in CVar Health so you do not have to go hunting for it.</p>
        <p style={{ marginTop: 12 }}>The way it works: say your GCD is 1.5 seconds. With SQW at 400ms, the queue window opens at 1100ms into that GCD. Any press inside that window gets queued. The last press before the GCD ends is the one that fires, replacing anything queued before it.</p>

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
          The trap most people fall into: setting SQW lower than your latency. If your ping is 120ms and you force SQW down to 50ms, your queued press can reach the server too late to register, which means dead GCDs and a rotation that feels like it skips. SQW must always be higher than your latency. If you are unsure, leave the Dynamic SQW Optimiser on and let it handle the math for you.
        </GuideCallout>
      </GuideSection>

      <GuideSection title="Dynamic SQW Optimiser">
        <p style={{ marginBottom: 4, fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Settings {'>'} CVar Health</p>
        <p>This is the setting that does the SQW math for you and keeps it updated as your connection moves around during a session. It continuously monitors your world latency, using a smoothed average sampled every 10 seconds, ignoring one-off spikes that would otherwise throw your numbers off. From that, it sets SQW to your current latency plus a configurable Safety Buffer, kept inside the 50 to 400ms ceiling.</p>
        <p style={{ marginTop: 12 }}>So if your latency is 120ms and your Safety Buffer is 50ms, SQW lands at around 170ms. Your latency jumps to 160ms mid-key, SQW adjusts.</p>

        <div style={{ padding: '12px 14px', background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: 16 }}>
          <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>Safety Buffer</div>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.6 }}>Yours to set between 50 and 200ms. Higher buffer means fewer dropped presses, lower feels snappier. 100ms is a sensible middle ground for most players. If your connection is stable and low-latency, push it lower. If it is inconsistent, go higher.</div>
        </div>

        <p style={{ marginTop: 16 }}>While the Optimiser is running, it has exclusive control over the SQW value. You will see "Managed by SQW Optimiser" in the manual control and the slider locks. If you want to set SQW by hand, turn the Optimiser off first.</p>
        <GuideCallout>
          The SQW Optimiser tunes one thing: the SpellQueueWindow CVar, based on your latency. It does not look at your sequence, your spells, or your click rate. For a recommendation on how fast you should actually be pressing your keybind, that is the Tempo Advisor below, a separate system entirely.
        </GuideCallout>
      </GuideSection>

      <GuideSection title="Finding your way around CVar Health">
        <p style={{ marginBottom: 4, fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Settings {'>'} CVar Health</p>
        <p>As of v2.3.13, the CVar Health dashboard covers 255 game variables across 14 sections, up from 212 in earlier versions. New sections cover Combat Audio, nameplate content toggles, accessibility motion and vision settings, raid graphics mirrors, and dragonriding comfort options, alongside the SQW and Key Down Casting settings this page already covers in detail.</p>
        <p style={{ marginTop: 12 }}>With that many CVars, finding a specific one by scrolling is no longer realistic, so the tab got a few navigation aids. A search box lets you type part of a CVar's name and jump straight to it. A show-only-issues filter hides every row that is already correctly set, so you see just what needs attention. Section headers are colour-coded, meaning a section containing a misconfigured row shows red before you even expand it, so you know where to look without opening every section in turn.</p>
        <p style={{ marginTop: 12 }}>Numeric CVars, fifty of them, are sliders rather than typed fields, and on/off CVars are tickboxes. The graphics dropdowns pull their tier names directly from the game client, so options like shadow quality, SSAO, and liquid detail match the wording in WoW's own System menu instead of using GRIP-EMS's own labels. maxFPS now goes up to 144.</p>
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
        <p>How fast you are pressing your sequence key, in milliseconds. GRIP-EMS advances one step per keypress and does not cap how fast you press, so this number is really a reference point that also controls the timing of any imported pauses in a sequence. The default is 250ms, and the slider will not go below 100ms.</p>
        <p style={{ marginTop: 12 }}>The reason it floors at 100ms is that nobody is realistically pressing a key faster than ten times a second, and at that speed, you would be running past steps before the spells they contain can land. GRIP-EMS calls 100ms the human and hardware floor.</p>
        <p style={{ marginTop: 12 }}><strong style={{ color: 'var(--text-primary)' }}>Per-Character Click Rate</strong>, under the same menu, is a setting scoped to your current character only and overrides the global value while that character is active. Range is 0 to 1000ms in steps of 10. Set it to 0 to fall back to the shared global value. This is also the only way to go below the 100ms floor if you have an edge case that needs it, down to 10ms. GRIP-EMS will pop a warning on screen when you drop under 100.</p>
        <GuideCallout>
          Pressing faster than your spells can land does not make your rotation faster. The GCD is the real speed limit, around 1.5 seconds for most specs and shorter with haste. If you are pressing at 80ms and your GCD is 1.4 seconds, you are firing roughly 17 keypresses per GCD and advancing the sequence 17 steps before a single spell lands. That is not a faster rotation; it is a broken one. The sweet spot is pressing at roughly your cast pace, and the Tempo Advisor below is the most personalized way to find that number for your character in real time.
        </GuideCallout>
      </GuideSection>

      <GuideSection title="Keybind Conflicts">
        <p style={{ marginBottom: 4, fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Added in v2.4.0 · /gems keys or the Keybind tab</p>
        <p>Run <code style={code}>/gems keys</code>, or click Check Conflicts on the Keybind tab, and GRIP-EMS checks every key your sequences use, plus vehicle and pet battle slots, against your saved bindings: what the keypress actually reaches, cast-redirect modifiers, and click bindings. Where it can identify the addon behind a conflicting binding, it names it directly, and it clears two known kinds of conflict for you automatically.</p>
        <p style={{ marginTop: 12 }}>This is the tool for the recurring question of why a key works on one character and does nothing on another. Different characters can carry different addon-set or click bindings on the same physical key, and this check surfaces that instead of leaving you to hunt through every addon's keybind panel by hand.</p>
        <GuideCallout>
          If a fix does not stick, run <code style={code}>/gems keys</code> again and use Undo, which backs out the last change if something else grabbed the key in the meantime.
        </GuideCallout>
      </GuideSection>

      <GuideSection title="Tempo Advisor">
        <p style={{ marginBottom: 4, fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Settings {'>'} Faster/Slower</p>
        <p>This is a different system from the SQW Optimiser above, and it is worth being precise about the difference because the two get confused constantly in the Discord. The SQW Optimiser tunes a WoW CVar based on your latency. The Tempo Advisor analyses your actual sequence and your actual play to recommend a click rate, in milliseconds between keypresses, that fits how that specific sequence is built and how you actually play it.</p>
        <p style={{ marginTop: 12 }}>It starts from a theoretical estimate the moment you save a sequence: it classifies every spell into one of seven timing categories (off-GCD, on-GCD instant, on-GCD with a cast time, a long cast, a channel, a pause step, or unknown if the spell data is not cached yet), builds a transition graph between your steps, and sums GCD durations and cast times across that graph to estimate the time between presses your sequence actually needs.</p>
        <p style={{ marginTop: 12 }}>That estimate gets more accurate the more you play. After 30 logged samples from the addon's execution tracer, the Advisor blends real combat data into the recommendation at a 70% theoretical, 30% empirical mix, and discards stale samples automatically so an old patch or a respec does not keep skewing the number. Every sequence stores its own recommendation, sample count, and blend ratio, and it persists across sessions rather than resetting every login.</p>

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

        <p style={{ marginTop: 16 }}>Turn it on and a movable Faster/Slower overlay shows your current click rate against the recommendation, with a delta bar so you can see at a glance how far off you are. There is an optional rolling CPS sparkline if you want to watch your actual clicks per second over the last few presses, and an opt-in audio alert that plays a sound if your rate drifts too far from the recommendation, useful if you are not watching the overlay during a pull.</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 16 }}>
          {[
            { cmd: '/gems fs', desc: 'Show current Tempo Advisor status' },
            { cmd: '/gems fs on', desc: 'Enable the Faster/Slower overlay' },
            { cmd: '/gems fs off', desc: 'Disable the overlay' },
            { cmd: '/gems fs reset', desc: 'Clear stored data for a sequence and start fresh' },
          ].map(item => (
            <div key={item.cmd} style={{ display: 'flex', gap: 16, alignItems: 'baseline', fontSize: 'var(--text-sm)' }}>
              <code style={{
                fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)',
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

        <GuideCallout>
          Run /gems fs reset after a major rework of a sequence, not just a small tweak. The Advisor is learning the timing of that specific step structure, and feeding it 30 samples from the old version before you swap to the new one will skew the recommendation until enough fresh data overwrites it.
        </GuideCallout>
      </GuideSection>

      <GuideSection title="Spell Cache Viewer">
        <p style={{ marginBottom: 4, fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>/gems spellcache</p>
        <p>The cached spell data GRIP-EMS uses for icon resolution, autocomplete, and the Tempo Advisor's spell classification all lives in one place you can inspect directly. Run <code style={code}>/gems spellcache</code>, search by spell name or spell ID, and see exactly what the addon has stored: icon texture, cast time, cooldown, GCD category, and spell school.</p>
        <p style={{ marginTop: 12 }}>This is the tool to reach for when a spell icon is not resolving on your tracker or action bar, or when the Tempo Advisor is classifying a spell as unknown instead of one of its real timing categories. A stale or missing cache entry, usually from a spell getting renamed or reworked in a patch, is the most common cause of both. Search for the spell here first before assuming something is broken in your sequence itself.</p>
        <p style={{ marginTop: 12 }}>The cache populates on login and updates automatically when you change spec or talents. If a spell is genuinely missing rather than just stale, <code style={code}>/gems revalidate</code> forces a fresh re-tag of every sequence with current spell IDs, which usually resolves it.</p>
      </GuideSection>

      <GuideSection title="Outside programs: AHK, iCue, Synapse, and others">
        <p>External programs that send repeated keypresses work fine with GRIP-EMS. A full keypress is a down event followed by an up event. Your program needs to send both. GRIP-EMS fires on the key-down signal specifically, so a program that sends only an up event or a custom hold signal will not trigger the sequence correctly.</p>
        <p style={{ marginTop: 12 }}>For interval settings: one full keypress every 50ms or slower is a sensible floor. Randomizing slightly, say between 50 and 75ms rather than a fixed number, produces cleaner behavior than a perfectly robotic fixed interval. The click rate guidance above applies here, too. Faster is not better past the point where your spells can actually land.</p>
        <p style={{ marginTop: 12 }}>The key-down requirement is the only thing that is not optional. Everything else is tuning.</p>
      </GuideSection>

      <GuideSection title="How these settings connect">
        <p>The outside program sends keypresses at the rate you set. GRIP-EMS turns each keypress into one sequence step. The GCD is the actual ceiling on how fast spells can land, regardless of how fast you press. SQW controls the window in which your next press is queued into that GCD, and the SQW Optimiser ties that window to your real latency so it is always sized correctly for your connection. The Tempo Advisor is the layer above all of that: it watches your specific sequence and your actual play to tell you the click rate that fits both.</p>
        <p style={{ marginTop: 12 }}>Key Down Casting takes care of itself as of v2.3.14, so let the Optimiser handle SQW, and let the Tempo Advisor tell you where to set your click rate once it has enough data on you. Everything else on this page is fine-tuning from there.</p>
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
