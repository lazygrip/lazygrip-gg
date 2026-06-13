import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Installation | GRIP-EMS Guide | LazyGrip.net',
  description: 'How to install GRIP-EMS correctly, including the three post-install steps that most guides skip and that cause most new user problems.',
}

export default function InstallationPage() {
  return (
    <div style={{ maxWidth: 720 }}>
      <nav style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 24, display: 'flex', gap: 6, alignItems: 'center' }}>
        <Link href="/guide" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>Guide</Link>
        <span>/</span>
        <span style={{ color: 'var(--text-primary)' }}>Installation</span>
      </nav>

      <h1 style={{ fontSize: 32, fontWeight: 700, letterSpacing: '-0.03em', marginBottom: 12 }}>
        Installation
      </h1>
      <p style={{ fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 40 }}>
        Installing GRIP-EMS takes about two minutes. The part most guides skip is what comes after. There are three in-game settings that have to be configured before anything will work, and none of them are set correctly by default. This page covers all of it.
      </p>

      <Section title="Step 1: Download and enable">
        <Step number={1} label="Download from CurseForge, Wago, or WoWInterface">
          <p>GRIP-EMS is free on all three platforms. Use whichever addon manager you already have.</p>
          <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
            {[
              { label: 'CurseForge', href: 'https://www.curseforge.com/wow/addons/grip-enhanced-macro-sequencer' },
              { label: 'Wago', href: 'https://addons.wago.io/addons/qGZODqNd' },
              { label: 'WoWInterface', href: 'https://www.wowinterface.com/downloads/info27081' },
            ].map(link => (
              <a key={link.label} href={link.href} target="_blank" rel="noopener noreferrer" style={{
                fontSize: 13, fontWeight: 500, color: 'var(--accent)',
                border: '0.5px solid var(--accent)', borderRadius: 'var(--radius-md)',
                padding: '6px 14px', textDecoration: 'none',
                background: 'var(--accent-subtle)',
              }}>
                {link.label}
              </a>
            ))}
          </div>
        </Step>

        <Step number={2} label="Enable the addon in-game">
          <p>At the character select screen, click <strong>AddOns</strong> in the bottom left corner and make sure GRIP-EMS is checked. Log into your character.</p>
          <p style={{ marginTop: 8 }}>If you do not see GRIP-EMS in the list, your addon manager did not install it correctly. Try a manual download and drop the folder into your <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>World of Warcraft\_retail_\Interface\AddOns</code> directory.</p>
        </Step>
      </Section>

      <Section title="Step 2: The three settings you must configure">
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 20 }}>
          This is what most installation guides do not tell you. GRIP-EMS needs three specific WoW client settings to be correct before sequences will fire. None of them are set to the right value by default. If you skip this section and wonder why pressing your keybind does nothing, this is why.
        </p>

        <Step number={1} label="Fix your Cvar Health, the most important step">
          <p>GRIP-EMS fires through WoW's <strong>key-down</strong> event system. By default WoW uses key-up, which means your sequence registers the press only when you release the key rather than when you press it. At 150ms intervals this is the difference between a functioning rotation and nothing happening at all.</p>
          <p style={{ marginTop: 8 }}>Open the GRIP-EMS settings and navigate to the Cvar Health tab:</p>
          <Code>/gems settings</Code>
          <p style={{ marginTop: 8 }}>Go to the <strong>Cvar Health</strong> tab. If the status indicator is not green, click <strong>Fix</strong>. That sets <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>ActionButtonUseKeyDown</code> to enabled.</p>
          <Callout>This is the single most common reason new users post about keybinds doing nothing. Check this before anything else. It takes thirty seconds and solves the problem roughly half the time.</Callout>
        </Step>

        <Step number={2} label="Verify your SpellQueueWindow">
          <p>The SpellQueueWindow controls how many milliseconds before a GCD ends WoW will accept your next cast input. The Cvar Health tab shows your current value and flags it if it looks off. The default of 400ms is fine to leave alone for now. The full explanation of what SQW does, why it matters, and how to tune it for your connection is on the <Link href="/guide/settings" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>Settings</Link> page.</p>
        </Step>

        <Step number={3} label="Set your click rate">
          <p>GRIP-EMS advances one step per keypress. Your hardware or software needs to send repeated keypresses at a consistent interval. The right value depends on your setup but 150ms is a reliable starting point that works across most hardware and latency combinations. If you are using Razer hardware, set your repeat rate to 150ms in Synapse.</p>
          <p style={{ marginTop: 8 }}>GRIP-EMS has a built-in Tempo Advisor that analyzes your actual click rate from log data and tells you whether to click faster or slower. Once you have a sequence running and some combat data, use it.</p>
        </Step>
      </Section>

      <Section title="What you will not see and why">
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
          GRIP-EMS does not put a button on your action bar. This trips up almost every new user who comes from GSE, which does create a draggable button that you place on a bar and bind. GRIP-EMS works differently. You bind a key directly to a sequence inside the addon, and the keybind fires the sequence without going through the action bar at all. There is nothing to drag. If you are looking for a button to appear and it is not appearing, that is expected behavior and not a bug.
        </p>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7, marginTop: 12 }}>
          To bind a key to a sequence, open the sequence in the GRIP-EMS editor, go to the Keybinds tab, and assign a key there. The bind is stored per-spec, so switching specs gives you a clean slate for a different rotation on the same key.
        </p>
      </Section>

      <Section title="Quick sanity check">
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 16 }}>Before moving on, confirm these four things are true:</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            'Cvar Health tab shows green with no Fix button visible',
            'You have at least one sequence imported or created',
            'That sequence has a keybind assigned in the Keybinds tab',
            'You are in Bear Form or your spec\'s required form when testing',
          ].map((item, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 14, color: 'var(--text-secondary)' }}>
              <span style={{ color: 'var(--accent)', fontWeight: 700, flexShrink: 0 }}>✓</span>
              <span>{item}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Troubleshooting common problems">
        <TroubleshootItem
          problem="Keybind is set but nothing fires"
          solution="Run /gems settings and go to the Cvar Health tab. If the Fix button is visible, click it. This solves the majority of new-user keybind problems. If everything shows green and the sequence still does not fire, check that you have a target selected and that the sequence has a keybind assigned in the Keybinds tab inside the editor, not just in WoW's default keybind menu."
        />
        <TroubleshootItem
          problem="Sequence fires once then stops"
          solution="GRIP-EMS requires continuous repeated keypresses, not a single press and hold. Your hardware or software needs to be configured to send repeated keypress events. At 150ms that is roughly 6 to 7 presses per second. A single press fires one step and stops."
        />
        <TroubleshootItem
          problem="Sequence shows greyed out after a /reload in arena or M+"
          solution="This was a known bug where the addon waited on a match flag that never cleared mid-fight, leaving sequences inactive until the match ended. It is fixed in v2.1.17. If you are hitting this, update GRIP-EMS through your addon manager. Clicking a greyed-out sequence row in the editor also re-activates it on the spot in v2.1.17 and later."
        />
        <TroubleshootItem
          problem="Sequence key stops working randomly while grinding, mount and dismount fixes it"
          solution="This was a bug where the game skipped its own bar-change signal after messy dismounts, leaving a stale keybind eating keypresses. A watchdog fix was added in v2.1.16 that checks actual mount and vehicle state rather than trusting the bar-change signal. Update to v2.1.16 or later. You can run /gems debug to watch the watchdog catch a stale bind in real time."
        />
        <TroubleshootItem
          problem="Sequence key dies after skyriding or leaving a vehicle"
          solution="Fixed in v2.1.14. The keybind suspend-and-restore now runs inside the secure engine and survives skyriding, vehicle exits, and possession. Update GRIP-EMS if you are on an older version. As of v2.1.16 you can also press your sequence key while skyriding over an attackable target and it will dismount and fire step 1 in a single press."
        />
        <TroubleshootItem
          problem="Lua error spam about tainted table iteration in arena or BG"
          solution="This is typically caused by another addon tainting the environment before GRIP-EMS runs, not a GRIP-EMS bug itself. A common culprit is PvPCallouts. Try disabling other addons one at a time with BugSack and BugGrabber installed to identify the source. If the error text says execution tainted by GRIP-EMS specifically, file a bug report in the Discord with the full error and your addon list."
        />
      </Section>

      <Section title="Commands worth knowing">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            { cmd: '/gems', desc: 'Opens the GRIP-EMS sequence editor' },
            { cmd: '/gems settings', desc: 'Opens settings including Cvar Health' },
            { cmd: '/gems binds', desc: 'Shows all currently bound sequences for your active spec' },
            { cmd: '/gems debug on', desc: 'Enables debug output to chat, useful when something is not firing' },
            { cmd: '/gems debugwindow', desc: 'Opens the debug window with additional diagnostic information' },
            { cmd: '/gems validate', desc: 'Runs spell validation across all your sequences and reports stale spells' },
            { cmd: '/gems revalidate', desc: 'Forces a full revalidation, useful after a patch or respec' },
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
      </Section>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 48, paddingTop: 24, borderTop: '0.5px solid var(--border)' }}>
        <Link href="/guide/settings" style={{
          fontSize: 14, color: 'var(--accent)', textDecoration: 'none', fontWeight: 500,
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          Next: Settings →
        </Link>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 48 }}>
      <h2 style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 20, color: 'var(--text-primary)' }}>
        {title}
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {children}
      </div>
    </div>
  )
}

function Step({ number, label, children }: { number: number; label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
      <div style={{
        width: 28, height: 28, borderRadius: '50%',
        background: 'var(--accent)', color: 'white',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 13, fontWeight: 700, flexShrink: 0, marginTop: 2,
      }}>
        {number}
      </div>
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: 15, fontWeight: 600, marginBottom: 8, color: 'var(--text-primary)' }}>{label}</p>
        <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
          {children}
        </div>
      </div>
    </div>
  )
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontFamily: 'var(--font-mono)', fontSize: 13,
      background: 'var(--bg-tertiary)', border: '0.5px solid var(--border)',
      borderRadius: 'var(--radius-md)', padding: '10px 14px',
      color: 'var(--accent)', marginTop: 8,
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

function TroubleshootItem({ problem, solution }: { problem: string; solution: string }) {
  return (
    <div style={{
      padding: '16px',
      background: 'var(--bg-primary)',
      border: '0.5px solid var(--border)',
      borderRadius: 'var(--radius-md)',
    }}>
      <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>{problem}</p>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>{solution}</p>
    </div>
  )
}
