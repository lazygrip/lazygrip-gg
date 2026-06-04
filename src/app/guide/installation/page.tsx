import type { Metadata } from 'next'
import Link from 'next/link'
import { CheckCircle, AlertTriangle, ArrowRight, ArrowLeft, Terminal } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Installation | GRIP-EMS Guide | LazyGrip.net',
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
        <p style={{ fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.75, maxWidth: 620 }}>
          Installing GRIP-EMS takes about two minutes. The part most guides skip is what comes after. There are three in-game settings that have to be configured before sequences will fire, and none of them are set correctly by default. This page covers all of it.
        </p>
      </div>

      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 20, color: 'var(--text-primary)' }}>
          Download and enable
        </h2>

        <Step n={1} title="Download from CurseForge, Wago, or WoWInterface">
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            GRIP-EMS is free on all three platforms. Use whichever addon manager you already have. Retail only, because the addon depends on APIs that do not exist in Classic or Anniversary builds.
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
            If you do not see GRIP-EMS in the list, your addon manager did not install it correctly. Download the latest release manually and drop the folder into <Code>World of Warcraft\_retail_\Interface\AddOns</Code>, then reload WoW.
          </Callout>
        </Step>
      </section>

      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 8, color: 'var(--text-primary)' }}>
          The three settings you must configure
        </h2>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 20 }}>
          This is what most installation guides skip entirely. GRIP-EMS needs three specific WoW client settings before sequences will fire, and none of them are correct by default. If you set a keybind, press it, and nothing happens, this section is why. Go through all three before you assume something else is broken.
        </p>

        <Step n={1} title="Fix your Cvar Health, do this first, every time">
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            GRIP-EMS fires through WoW&apos;s <strong style={{ color: 'var(--text-primary)' }}>key-down</strong> event system. WoW defaults to key-up, meaning a keypress registers when you release the key rather than when you press it. The difference is invisible when you test manually but completely breaks automated repeat firing at any useful interval.
          </p>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7, marginTop: 10 }}>
            Open GRIP-EMS and go to settings:
          </p>
          <CommandBlock>/gems settings</CommandBlock>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7, marginTop: 10 }}>
            Click the <strong style={{ color: 'var(--text-primary)' }}>Cvar Health</strong> tab. If anything shows as not green, click <strong style={{ color: 'var(--text-primary)' }}>Fix</strong>. That sets <Code>ActionButtonUseKeyDown</Code> to enabled and takes about thirty seconds.
          </p>
          <Warning>
            This is the single most common reason new users report that keybinds do nothing. It comes up constantly in the Discord and in every support thread. Check this before anything else, every time you install or reinstall.
          </Warning>
        </Step>

        <Step n={2} title="Verify your SpellQueueWindow">
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            The SpellQueueWindow controls how many milliseconds before the end of a GCD WoW will accept your next cast. Too low and spells clip into each other and fail. Too high and false casts queue through and fire at the wrong time. GRIP-EMS recommends a value between 100 and 400ms. The Cvar Health tab shows your current value and flags it if it falls outside that range.
          </p>
          <Callout>
            If you enable the SQW Optimizer in settings, GRIP-EMS will manage this value automatically based on your real-time latency. For most players that is the better option than setting a static number.
          </Callout>
        </Step>

        <Step n={3} title="Set your click rate">
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            GRIP-EMS advances one step per keypress, so your hardware needs to send repeated keypresses at a consistent interval. The right number depends on your setup and your spec, but 150ms is a reliable starting point for most hardware and latency combinations. If you use Razer hardware, set your repeat rate to 150ms in Synapse. If you use Logitech, set it in G Hub.
          </p>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7, marginTop: 10 }}>
            On macOS, AHK is not available. The community has used Hammerspoon and Keyboard Maestro as alternatives, though both can have issues with key repeat when WASD movement keys are held simultaneously. If you experience your character moving unexpectedly while the sequence runs, the repeat tool is likely sending the wrong key when movement input overlaps. Hammerspoon scripts built with AI assistance are a known workaround but require careful configuration. The Tempo Advisor in GRIP-EMS helps you dial in the correct interval once you have a repeat method working.
          </p>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7, marginTop: 10 }}>
            Once you have a sequence running and some combat data, use the built-in Tempo Advisor. It analyzes your actual click rate and tells you whether to speed up or slow down based on your specific sequence and connection. Enable it with <Code>/gems fs on</Code> and it shows a live overlay while you play.
          </p>
        </Step>
      </section>

      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 12, color: 'var(--text-primary)' }}>
          There is no action bar button
        </h2>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 12 }}>
          This trips up almost every new user coming from GSE. GSE creates a draggable button you place on your action bar and bind to a key. GRIP-EMS does not work that way. You assign a keybind directly inside the addon, and the sequence fires through that bind without touching your action bar. There is nothing to drag. If you are looking for a button to appear and it is not appearing, that is expected and not a bug.
        </p>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
          To bind a key to a sequence, open the sequence in the editor, go to the <strong style={{ color: 'var(--text-primary)' }}>Keybinds</strong> tab, and press the key you want. The bind is stored per-spec, so switching specs automatically switches to the binds you set for that spec. Running <Code>/gems binds</Code> at any time shows you what is currently bound for your active spec.
        </p>
      </section>

      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 12, color: 'var(--text-primary)' }}>
          Before you move on
        </h2>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 16 }}>
          Confirm all four of these are true before testing your first sequence:
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            'Cvar Health tab shows green with no Fix button visible',
            'You have at least one sequence imported or created',
            'That sequence has a keybind assigned in the Keybinds tab',
            'You are in the correct form or stance for your spec when testing. Guardian Druids need Bear Form, Warriors need the right stance, and so on',
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
            { cmd: '/gems', desc: 'Opens the sequence editor' },
            { cmd: '/gems settings', desc: 'Opens settings including Cvar Health and the SQW Optimizer' },
            { cmd: '/gems binds', desc: 'Shows all currently bound sequences for your active spec' },
            { cmd: '/gems fs on', desc: 'Enables the Tempo Advisor overlay for click rate guidance' },
            { cmd: '/gems repair <name>', desc: 'Scans a sequence for problems and offers one-click fixes' },
            { cmd: '/gems repairall', desc: 'Runs the repair scan across every sequence you own' },
            { cmd: '/gems debug on', desc: 'Enables debug output to chat when you need to diagnose a firing problem' },
            { cmd: '/gems debugwindow', desc: 'Opens a scrollback debug window so output does not flood your chat' },
            { cmd: '/gems validate', desc: 'Checks all sequences for stale or renamed spells' },
            { cmd: '/gems revalidate', desc: 'Forces a full revalidation, run this after a patch or a talent change' },
          ].map(item => (
            <div key={item.cmd} style={{ display: 'flex', gap: 12, alignItems: 'baseline', padding: '9px 14px', background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
              <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--accent-text)', flexShrink: 0, minWidth: 200 }}>{item.cmd}</code>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{item.desc}</span>
            </div>
          ))}
        </div>
      </section>

      <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 16, borderTop: '0.5px solid var(--border)' }}>
        <Link href="/guide" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14, color: 'var(--text-tertiary)', textDecoration: 'none' }}>
          <ArrowLeft size={14} /> Overview
        </Link>
        <Link href="/guide/how-it-works" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14, color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>
          Next: How it works <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  )
}
