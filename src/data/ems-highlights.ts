// Hand-written highlights for a release, shown above the full list. They are LazyGrip's own
// summary of facts stated in the author's release notes, never a copy of anything he posted
// elsewhere, and a release without an entry here simply has no highlights block. Every claim
// below can be found in that release's entries in the archive.
export type Highlight = {
  id: string
  tone: 'added' | 'changed' | 'removed' | 'fixed'
  icon: 'keyboard' | 'rotate' | 'map' | 'trash' | 'save'
  title: string
  // Inline markdown: `code` becomes a key cap when it is a key name, a code chip otherwise.
  text: string
  diff?: { before: string[]; after: string[] }
  table?: { head: [string, string]; rows: [string, string][] }
  // Names to show as chips under the text.
  chips?: { label: string; names: string[] }
}

export const EMS_HIGHLIGHTS: Record<string, Highlight[]> = {
  '2.4.21': [
    {
      id: 'toggle-key',
      tone: 'added',
      icon: 'keyboard',
      title: 'Give any step its own on and off key',
      text: 'Right-click a step, choose **Set Toggle Key** and press the key you want. Out of combat that key turns the step off or back on straight away and chat names the step and its sequence. In combat it changes nothing and tells you so. `/gems stepkey` sets, clears and lists them, and each character keeps its own. A key that is already bound to something is refused.',
    },
    {
      id: 'reset-modifiers',
      tone: 'fixed',
      icon: 'rotate',
      title: 'Reset modifiers and reset timers work',
      text: 'Both went through a button attribute the game does not let a sequence read or write, so neither could ever fire. The attribute now has a name the game accepts, and the idle gap is measured before the press instead of after it. A pause that runs out mid-fight is held until combat ends, and pressing again during the fight drops it.',
      diff: {
        before: ['Hold a reset modifier: nothing cast, the step never moved', 'Reset timer: never fired'],
        after: ['Hold a reset modifier: back to step 1', 'Return after a long pause: step 1 on the first press'],
      },
    },
    {
      id: 'map-ticks',
      tone: 'fixed',
      icon: 'map',
      title: 'Arena and battleground map ticks pick the right map',
      text: 'In the Conditions tab, most map rows were matched to a different map. Each tick now picks the map it names. Map ticks still apply only in unrated arenas and battlegrounds.',
      table: {
        head: ['You ticked', 'It used to run in'],
        rows: [
          ["Tol'Viron Arena", "Tiger's Peak"],
          ["Tiger's Peak", "Tol'Viron Arena"],
          ["Ashamane's Fall", "Blade's Edge Arena"],
          ['Hook Point', 'The Robodrome'],
          ['Mugambala', 'Empyrean Domain'],
          ['Empyrean Domain', 'Maldraxxus Coliseum'],
          ["Blade's Edge Arena, Nagrand Arena, Maldraxxus Coliseum, The Robodrome", 'Nothing'],
          ['Silvershard Mines', 'Warsong Gulch'],
          ['Seething Shore', 'Arathi Basin'],
          ['Wintergrasp', 'Deepwind Gorge'],
          ['Warsong Gulch, Arathi Basin, Deepwind Gorge', 'Nothing'],
        ],
      },
    },
    {
      id: 'saving-disabled',
      tone: 'fixed',
      icon: 'save',
      title: 'Saving a disabled sequence keeps your changes',
      text: 'Saving from the editor, the popup editor or the raw tab used to throw the save away, and the sequence kept its old steps. Quick changes such as the reset timer did stick, which is why it was easy to miss. A save made in combat on a sequence for another class was lost the same way. A disabled sequence also stays disabled when you save it.',
    },
    {
      id: 'unit-health',
      tone: 'removed',
      icon: 'trash',
      title: '`UnitHealthPercent` is gone',
      text: 'The game no longer lets an addon read your health as a number. The helper had been returning 0 instead of failing, so a variable built on it gave a wrong answer and nothing said so. A variable that used it now comes out empty, and with debug output on, EMS names the missing helper in the log. There is no replacement.',
      chips: { label: 'Helpers that still work in combat', names: ['HasBuff', 'HasDebuff', 'SpellReady', 'SpellOnCooldown', 'SpellEnabled', 'IsRestricted'] },
    },
  ],
}

// The author's own P.S. from a release announcement, word for word. These are never written or
// edited by LazyGrip. A release with no entry here shows no note, because the notes file itself
// does not contain them and an invented one would be putting words in his mouth.
export const EMS_AUTHOR_NOTES: Record<string, string> = {
  '2.4.21':
    "P.S. Release at max, the third Hold While Channeling option, still ends an empower at the first rank on at least one tester's client. If yours end early, set that version back to Hold cursor. All 137 changes are in the changelog attached below.",
}
