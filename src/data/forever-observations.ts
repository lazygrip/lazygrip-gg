// What has actually been observed about GRIP-EMS on WoW: Forever, one entry per claim, each with the
// date it was last confirmed and who it came from. The /forever page renders this list as is, and
// the WoW: Forever guide page carries the same facts in prose. Add an entry when something is
// observed, change its date when it is observed again, and never write one down from how retail
// behaves: the Forever client declares the Classic-style interface number while running the
// retail codebase, so retail results do not carry over.

export type ForeverObservationStatus = 'confirmed' | 'reported' | 'unsettled' | 'untested'

export type ForeverObservation = {
  id: string
  // Last date this was confirmed or reported, ISO format.
  date: string
  status: ForeverObservationStatus
  text: string
  source: string
}

export const FOREVER_OBSERVATIONS: ForeverObservation[] = [
  {
    id: 'loads-on-beta',
    date: '2026-09-18',
    status: 'confirmed',
    text: 'GRIP-EMS loaded on the Forever beta without any changes. Forever declares interface 16001, the same number GRIP-EMS already lists for Classic Era, so the addon passed the interface check exactly as it shipped at the time.',
    source: 'Sataana, who had it running in-game on the beta client',
  },
  {
    id: 'classed-as-mainline',
    date: '2026-09-18',
    status: 'confirmed',
    text: 'Forever is classed internally as Mainline, meaning it runs the current retail codebase while declaring the older Classic-style interface number. Neither retail testing nor Classic Era testing fully covers it.',
    source: 'Sataana',
  },
  {
    id: 'v2420-login-error',
    date: '2026-10-17',
    status: 'reported',
    text: 'v2.4.20 stopped at a Lua error at every Forever login because two spec functions it calls are gone from that client, so the settings panel, sending and receiving sequences, and the tracker never loaded. v2.4.21 fixes it. We have not tested v2.4.21 on the beta ourselves.',
    source: 'GRIP-EMS v2.4.21 changelog',
  },
  {
    id: 'unitname-target',
    date: '2026-09-18',
    status: 'unsettled',
    text: 'UnitName("player") returns your full name on Forever and UnitName("target") does not. The final behavior has not been settled.',
    source: 'Sataana',
  },
  {
    id: 'sequences-run',
    date: '2026-10-20',
    status: 'untested',
    text: 'Whether a sequence actually runs correctly once the addon has loaded. Loading and working are different claims, and so far only loading has been verified. No Forever sequence on this site has been validated.',
    source: 'Nothing has been run yet',
  },
]

// Launch date from the WoW: Forever guide page. The homepage entry point reads it so its wording
// flips from "Launches" to "Launched" on the day without anyone editing the page.
export const FOREVER_LAUNCH_DATE = '2026-11-04'

export function isForeverLaunched(now: Date = new Date()): boolean {
  return now.getTime() >= Date.parse(`${FOREVER_LAUNCH_DATE}T00:00:00Z`)
}

export function foreverLaunchLine(now: Date = new Date()): string {
  return isForeverLaunched(now) ? 'Launched Nov 4' : 'Launches Nov 4'
}
