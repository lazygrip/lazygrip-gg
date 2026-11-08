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
    id: 'blizzard-known-issues',
    date: '2026-11-07',
    status: 'reported',
    text: 'Blizzard\'s live Known Issues thread for Forever, as updated on November 5, has no entry about addons, macros, saved data or keybinds, and the Forever hotfix notes through November 6 list no addon changes.',
    source: 'Blizzard US forums and Blue Tracker, read November 7',
  },
  {
    id: 'v2423-changelog',
    date: '2026-11-05',
    status: 'reported',
    text: 'v2.4.23 is the current release, and its changelog fixes two v2.4.22 problems that showed up on Forever: the Regions must have a frame parent error when you open a second sequence, and two characters whose names share a first part sharing one record. We have not run v2.4.23 on the live client ourselves, so the changelog is the only evidence for those fixes.',
    source: 'GRIP-EMS v2.4.23 changelog',
  },
  {
    id: 'loads-on-live',
    date: '2026-11-04',
    status: 'confirmed',
    text: 'GRIP-EMS loaded on the live Forever client on launch night, build 1.60.1.70790, with no Lua errors at login or at any point after it. The copy tested was the development build that follows v2.4.22, not the v2.4.22 download.',
    source: 'Sataana, on the live client on launch night',
  },
  {
    id: 'saves-survive-reload',
    date: '2026-11-04',
    status: 'confirmed',
    text: 'Saving works on the live client. GRIP-EMS wrote its saved data at a UI reload and read it back, and all three saved sequences came back, so the beta-era save bug did not show up at launch.',
    source: 'Sataana, on the live client on launch night',
  },
  {
    id: 'cvar-health-left-out',
    date: '2026-11-04',
    status: 'confirmed',
    text: 'The CVar health check leaves out the three encounter timeline settings Forever does not have, and /gems status says so, as the v2.4.22 changelog describes.',
    source: 'Sataana, on the live client on launch night',
  },
  {
    id: 'spell-picker-class-tab',
    date: '2026-11-04',
    status: 'confirmed',
    text: 'The spell picker opens on its Class tab and lists the class spells there, Fireball and Frost Armor on a level 1 Mage, as the v2.4.22 changelog describes.',
    source: 'Sataana, on the live client on launch night',
  },
  {
    id: 'unitname-two-values',
    date: '2026-11-04',
    status: 'confirmed',
    text: 'UnitName("player") returns a two-part name as two separate values, the first name and then the surname, and GetUnitName("player", true) returns the two joined. An addon that keeps only the first value of UnitName sees the first name alone.',
    source: 'Sataana, on the live client on launch night',
  },
  {
    id: 'sequences-run',
    date: '2026-11-04',
    status: 'untested',
    text: 'Whether a sequence actually runs correctly once the addon has loaded. Loading and working are different claims. On launch night three imported sequences loaded and came back after a UI reload, but none was run in a fight, and no Forever sequence on this site has been validated.',
    source: 'Sataana, on the live client on launch night',
  },
  {
    id: 'loads-on-beta',
    date: '2026-09-18',
    status: 'confirmed',
    text: 'GRIP-EMS loaded on the Forever beta without any changes. Forever declares interface 16001, which GRIP-EMS added to its .toc in v2.4.18 on September 17, so the addon passed the interface check exactly as it shipped at the time.',
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

// The interface number Forever declares, shown in the /forever stat tiles. It was read from a shipped
// addon under the Forever flavor and from the live client on launch night, so change it only when
// Blizzard changes it, and never carry one over from retail. The other two tiles are not typed in
// here: the release comes from the changelog archive and the sequence count from the database.
export const FOREVER_FACTS = {
  interfaceNumber: '16001',
}

export const FOREVER_RAIDS_DATE = '2026-12-09'

export type ForeverTimelineEntry = {
  date: string
  title: string
  detail: string
  kind: 'game' | 'addon'
}

export const FOREVER_TIMELINE: ForeverTimelineEntry[] = [
  { date: '2026-09-17', title: 'Beta opens', detail: 'GRIP-EMS adds Forever\'s interface number to its .toc in v2.4.18, the same day.', kind: 'game' },
  { date: '2026-10-17', title: 'v2.4.21', detail: 'Fixes the Lua error v2.4.20 threw at every Forever login.', kind: 'addon' },
  { date: '2026-10-23', title: 'Beta closes', detail: 'Blizzard shuts the beta at 10:00 a.m. Pacific.', kind: 'game' },
  { date: '2026-11-01', title: 'v2.4.22', detail: 'More Forever fixes, including a Class tab that lists your spells.', kind: 'addon' },
  { date: '2026-11-04', title: 'Forever goes live', detail: 'Sataana loads GRIP-EMS on the live client and logs the first launch-night readings.', kind: 'game' },
  { date: '2026-11-05', title: 'v2.4.23', detail: 'Fixes two v2.4.22 problems seen on Forever.', kind: 'addon' },
  { date: FOREVER_RAIDS_DATE, title: 'Raids open', detail: 'Barrow Deeps, Hyjal Summit and Onyxia\'s Lair, per Blizzard\'s launch posts. Blizzard can move it.', kind: 'game' },
]

// Whole days from today to an ISO date, negative once it has passed. "Today" is the calendar day in
// Pacific time, which is the clock Blizzard's own dates run on, so the count drops by one at Pacific
// midnight and not at 5 p.m. in Tulsa the evening before. The page calls this on every render, so the
// number moves by itself as the days go by and nobody edits it.
export function daysUntil(iso: string, now: Date = new Date()): number {
  const [y, m, d] = iso.split('-').map(Number)
  const [ty, tm, td] = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' })
    .format(now)
    .split('-')
    .map(Number)
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(ty, tm - 1, td)) / 86_400_000)
}
