import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'

// Flat config. Replaces .eslintrc.json and .eslintignore, neither of which
// ESLint 9 reads any more.
//
// eslint-config-next 16 brings eslint-plugin-react-hooks 6, which adds the
// React Compiler rule family. On arrival it reported 21 findings against
// unchanged code -- immutability 11, set-state-in-effect 9, purity 1, across 13
// files. As of 2026-09-17 the count is:
//
//     react-hooks/immutability          0
//     react-hooks/set-state-in-effect   5
//     react-hooks/purity                0
//
// THE 21 WAS AN UNDERCOUNT OF set-state-in-effect, AND CLEARING immutability IS
// WHAT REVEALED IT. The analyser stops at the first error it finds in a function,
// so an "accessed before it is declared" report masked every setState inside the
// loaders that effect called. Moving four declarations above their effects took
// immutability from 11 to 0 and moved set-state-in-effect from 4 to 8 in the same
// run. Read a drop in one rule of this family as possibly moving work rather than
// finishing it.
//
// THE FIVE THAT REMAIN ARE ALL ONE SHAPE: an effect that calls a named async
// loader which eventually sets state. SequencePageClient:336, update/page:240,
// PostingEligibilityChecklist:85, BrowseContent:197 and :211.
//
// The rule cannot see through the call, and reports them whether or not a
// synchronous setState exists. Measured 2026-09-17 with a four-case probe: an
// async IIFE whose setState comes after the first await is clean, and the SAME
// BODY called by name from the effect is reported. Two of the five do set a
// loading flag before their first await; three set no state synchronously at all
// and are reported anyway. Wrapping the calls in async IIFEs would clear all five
// without changing what React does, so it is not done here -- that is silencing
// with extra steps, and it is the same thing as setting the rule to 'off'.
//
// The change that genuinely removes them is moving these five data loads to the
// server, which is already half-built: BrowseContent takes initialCurrentPatch,
// initialAvailablePatches and displayedKey from a server render, and
// SequencePageClient takes `seeded`. Finishing that removes the effects rather
// than reshaping them. Ship target and the per-file list are in
// hub/Projects/Hub/Backlog.md.
//
// They stay at 'warn', never 'off': every remaining finding prints on every run
// and in every CI job, and the counts above are what makes drift upward visible.
// Update them here when the number moves.
const reactCompilerRules = {
  'react-hooks/immutability': 'warn',
  'react-hooks/set-state-in-effect': 'warn',
  'react-hooks/purity': 'warn',
}

const config = [
  {
    ignores: [
      '.next/**',
      'out/**',
      'next-env.d.ts',
      // Standalone generators, run by hand, not part of the app build.
      'src/lib/workshop/scripts/**',
    ],
  },
  ...nextCoreWebVitals,
  {
    rules: {
      // Apostrophes in copy. Predates this config.
      'react/no-unescaped-entities': 'off',
      ...reactCompilerRules,
    },
  },
]

export default config
