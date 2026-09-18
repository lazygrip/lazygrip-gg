import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

// The repo had no vitest config until 2026-09-17, because every test until then
// imported its subject with a relative path and never needed one.
// src/app/sitemap.test.ts is the first test of a module that uses the `@/`
// alias, and without this it fails at import with
//
//     Error: Cannot find package '@/lib/wow-data' imported from src/app/sitemap.ts
//
// which reads like a missing dependency rather than a missing alias.
//
// `include` is deliberately NOT set. vitest's defaults already discover
// src/**/*.test.ts, which is what `npm test` has always run; narrowing `include`
// here would silently change which tests execute, and a config added to fix an
// import path should not also be the thing that stops a suite running.
// tsconfig.json declares the same mapping for the compiler -- this is its
// runtime counterpart, and the two have to agree.
//
// 2026-09-18: `vitest.config.mts` used to sit beside this file and NEVER RAN.
// Vite loads one config file, and every run in this repo prints
// `ESM syntax in a file loaded as CommonJS (vitest.config.ts:1:1)`, which names
// the file it loaded; `sitemap.test.ts` also resolves `@/lib/wow-data`, which the
// `.mts` alone could not do because it declared no alias. So the `.mts` was dead,
// and it was the copy carrying `include: ["src/**/*.test.ts"]` -- a list that
// would have EXCLUDED a `.test.tsx` file, which the defaults do discover. A
// reader trusting the dead config would have concluded a new `.test.tsx` was not
// being run. It is deleted rather than kept as documentation, and its one live
// intention is carried below.
//
// `environment: 'node'` restates vitest's own default, and is written out because
// it is load-bearing rather than incidental: the workshop converter is plain
// TypeScript that reads its catalog off disk through node:fs, so it needs a node
// environment and needs process.cwd() to be the project root -- spellCatalog.ts
// resolves src/lib/data/ from cwd on purpose, because __dirname is unreliable
// inside Next's bundled server output. Vitest already runs from the root, so
// nothing has to be configured for that; the line exists so that a future switch
// to `jsdom` for a component test is a visible change to a stated value rather
// than a silent change to a default.
export default defineConfig({
  test: {
    environment: 'node',
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
