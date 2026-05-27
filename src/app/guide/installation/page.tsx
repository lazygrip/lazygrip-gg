import type { Metadata } from 'next'
import Link from 'next/link'
import { CheckCircle, AlertTriangle, ArrowRight, Terminal } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Installation | GRIP-EMS Guide',
  description: 'How to install GRIP-EMS correctly, including the three post-install steps that most guides skip and that cause most new user problems.',
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 16, marginBottom: 28 }}>
      <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--accent)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, flexShrink: 0, marginTop: 2 }}>
        {n}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>{title}</div>
        {children}
      </div>
    </div>
  )
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12, background: 'var(--bg-tertiary)', border: '0.5px solid var(--border-strong)', borderRadius: 'var(--radius-sm)', padding: '1px 6px', color: 'var(--accent-text)' }}>
      {children}
    </code>
  )
}

function CommandBlock({ children }: { children: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg-tertiary)', border: '0.5px solid var(--border-strong)', borderRadius: 'var(--radius-md)', padding: '10px 14px', marginTop: 10, marginBottom: 4 }}>
      <Terminal size={13} style={{ color: 'var(--accent)', flexShrink: 0 }} />
      <code style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-primary)' }}>{children}</code>
    </div>
  )
}

function Warning({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 10, background: 'rgba(224,82,42,0.08)', border: '0.5px solid rgba(224,82,42,0.25)', borderRadius: 'var(--radius-md)', padding: '12px 14px', marginTop: 12, marginBottom: 4 }}>
      <AlertTriangle size={14} style={{ color: '#e0522a', flexShrink: 0, marginTop: 2 }} />
      <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{children}</div>
    </div>
  )
}

function Callout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 10, background: 'var(--accent-subtle)', border: '0.5px solid rgba(29,158,117,0.25)', borderRadius: 'var(--radius-md)', padding: '12px 14px', marginTop: 12, marginBottom: 4 }}>
      <CheckCircle size={14} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 2 }} />
      <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{children}</div>
    </div>
  )
}

export default function InstallationPage() {
  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1.2, marginBottom: 12, color: 'var(--text-primary)' }}>
          Installation
        </h1>
        <p style={{ fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.75, maxWidth: 600 }}>
          Installing GRIP-EMS takes about two minutes. The part most guides skip is what comes after. There are three in-game settings that have to be configured before anything will work, and none of them are set correctly by default. This page covers all of it.
        </p>
      </div>

      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 20, color: 'var(--text-primary)' }}>
          Step 1: Download and enable
        </h2>

        <Step n={1} title="Download from CurseForge, Wago, or WoWInterface">
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            GRIP-EMS is free on all three platforms. Use whichever addon manager you already have.
          </p>
          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            {[
              { label: 'CurseForge', href: 'https://www.curseforge.com/wow/addons/grip-enhanced-macro-sequencer' },
              { label: 'Wago', href: 'https://addons.wago.io/addons/qGZODqNd' },
              { label: 'WoWInterface', href: 'https://www.wowinterface.com/downloads/info27081' },
            ].map(link => (
              <a key={link.label} href={link.href} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, color: 'var(--accent-text)', background: 'var(--accent-subtle)', border: '0.5px solid rgba(29,158,117,0.2)', borderRadius: 'var(--radius-md)', padding: '5px 12px', textDecoration: 'none', fontWeight: 500 }}>
                {link.label} <ArrowRight size={11} />
              </a>
            ))}
          </div>
        </Step>

        <Step n={2} title="Enable the addon in-game">
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            At the character select screen, click <strong style={{ color: 'var(--text-primary)' }}>AddOns</strong> in the bottom left corner and make sure GRIP-EMS is checked. Log into your character.
          </p>
          <Callout>
            If you do not see GRIP-EMS in the list, your addon manager did not install it correctly. Try a manual download and drop the folder into your <Code>World of Warcraft\_retail_\Interface\AddOns</Code> directory.
          </Callout>
        </Step>
      </section>

      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 8, color: 'var(--text-primary)' }}>
          Step 2: The three settings you must configure
        </h2>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 20 }}>
          This is what most installation guides do not tell you. GRIP-EMS needs three specific WoW client settings to be correct before sequences will fire. None of them are set to the right value by default. If you skip this section and wonder why pressing your keybind does nothing, this is why.
        </p>

        <Step n={1} title="Fix your Cvar Health, the most important step">
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            GRIP-EMS fires through WoW's <strong style={{ color: 'var(--text-primary)' }}>key-down</strong> event system. By default WoW uses key-up, which means your sequence registers the press only when you release the key rather than when you press it. At 150ms intervals this is the difference between a functioning rotation and nothing happening at all.
          </p>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7, marginTop: 10 }}>
            Open the GRIP-EMS settings and navigate to the Cvar Health tab:
          </p>
          <CommandBlock>/gems settings</CommandBlock>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7, marginTop: 10 }}>
            Go to the <strong style={{ color: 'var(--text-primary)' }}>Cvar Health</strong> tab. If the status indicator is not green, click <strong style={{ color: 'var(--text-primary)' }}>Fix</strong>. That sets <Code>ActionButtonUseKeyDown</Code> to enabled.
          </p>
          <Warning>
            This is the single most common reason new users post about keybinds doing nothing. Check this before anything else. It takes thirty seconds and solves the problem roughly half the time.
          </Warning>
        </Step>

        <Step n={2} title="Verify your SpellQueueWindow">
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            The SpellQueueWindow controls how many milliseconds before a GCD ends WoW will accept your next cast. GRIP-EMS recommends a value between 100 and 400ms. Too low and spells clip. Too high and you get false casts queuing through. The Cvar Health tab shows your current value and flags it if it is outside the recommended range.
          </p>
        </Step>

        <Step n={3} title="Set your click rate">
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            GRIP-EMS advances one step per keypress. Your hardware or software needs to send repeated keypresses at a consistent interval. The right value depends on your setup but 150ms is a reliable starting point that works across most hardware and latency combinations. If you are using Razer hardware, set your repeat rate to 150ms in Synapse.
          </p>
          <Callout>
            GRIP-EMS has a built-in Tempo Advisor that analyzes your actual click rate from log data and tells you whether to click faster or slower. Once you have a sequence running and some combat data, use it.
          </Callout>
        </Step>
      </section>

      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 12, color: 'var(--text-primary)' }}>
          What you will not see and why
        </h2>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 12 }}>
          GRIP-EMS does not put a button on your action bar. This trips up almost every new user who comes from GSE, which does create a draggable button that you place on a bar and bind. GRIP-EMS works differently. You bind a key directly to a sequence inside the addon, and the keybind fires the sequence without going through the action bar at all. There is nothing to drag. If you are looking for a button to appear and it is not appearing, that is expected behavior and not a bug.
        </p>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
          To bind a key to a sequence, open the sequence in the GRIP-EMS editor, go to the Keybinds tab, and assign a key there. The bind is stored per-spec, so switching specs gives you a clean slate for a different rotation on the same key.
        </p>
      </section>

      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 12, color: 'var(--text-primary)' }}>
          Quick sanity check
        </h2>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 16 }}>
          Before moving on, confirm these four things are true:
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            'Cvar Health tab shows green with no Fix button visible',
            'You have at least one sequence imported or created',
            'That sequence has a keybind assigned in the Keybinds tab',
            'You are in Bear Form or your spec\'s required form when testing',
          ].map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px', background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
              <CheckCircle size={14} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 2 }} />
              <span style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{item}</span>
            </div>
          ))}
        </div>
      </section>

      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 12, color: 'var(--text-primary)' }}>
          Commands worth knowing
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[
            { cmd: '/gems', desc: 'Opens the GRIP-EMS sequence editor' },
            { cmd: '/gems settings', desc: 'Opens settings including Cvar Health' },
            { cmd: '/gems binds', desc: 'Shows all currently bound sequences for your active spec' },
            { cmd: '/gems debug on', desc: 'Enables debug output to chat, useful when something is not firing' },
            { cmd: '/gems debugwindow', desc: 'Opens the debug window with additional diagnostic information' },
            { cmd: '/gems validate', desc: 'Runs spell validation across all your sequences and reports stale spells' },
            { cmd: '/gems revalidate', desc: 'Forces a full revalidation, useful after a patch or respec' },
          ].map(item => (
            <div key={item.cmd} style={{ display: 'flex', gap: 12, alignItems: 'baseline', padding: '9px 14px', background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
              <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--accent-text)', flexShrink: 0, minWidth: 180 }}>{item.cmd}</code>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{item.desc}</span>
            </div>
          ))}
        </div>
      </section>

      <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 16, borderTop: '0.5px solid var(--border)' }}>
        <Link href="/guide/how-it-works" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14, color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>
          Next: How it works <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  )
}
