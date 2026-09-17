import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'

// Flat config. Replaces .eslintrc.json and .eslintignore, neither of which
// ESLint 9 reads any more.
//
// eslint-config-next 16 brings eslint-plugin-react-hooks 6, which adds the
// React Compiler rule family. Against unchanged code it reports:
//
//     react-hooks/immutability         11
//     react-hooks/set-state-in-effect   9
//     react-hooks/purity                1
//
// These are new rules, not new code, and every one of them asks for an effect
// or a render path to be restructured. Clearing them is a behavioural refactor
// of the whole client surface across 14 files, which is a different change from
// a lint upgrade and carries a different risk.
//
// They are set to 'warn', not 'off': all 21 print on every run and on every CI
// job, so the count is visible and drift upward is visible with it. Ship target
// for clearing them is named in hub/Projects/Hub/Backlog.md, one row per rule,
// because the three rules want three different kinds of fix.
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
