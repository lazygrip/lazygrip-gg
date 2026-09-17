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
// The alias is deliberately the ONLY thing configured. vitest's defaults already
// discover src/**/*.test.ts, which is what `npm test` has always run; narrowing
// `include` here would silently change which tests execute, and a config added
// to fix an import path should not also be the thing that stops a suite running.
// tsconfig.json declares the same mapping for the compiler -- this is its
// runtime counterpart, and the two have to agree.
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
