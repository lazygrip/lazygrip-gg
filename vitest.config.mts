import { defineConfig } from "vitest/config";

// The converter is plain TypeScript that reads its catalog off disk through
// node:fs, so it needs the node environment rather than a DOM one, and it needs
// process.cwd() to be the project root -- spellCatalog.ts resolves
// src/lib/data/ from cwd on purpose, because __dirname is unreliable inside
// Next's bundled server output. Vitest already runs from the root, so nothing
// has to be configured for that; it is stated here because it is the thing that
// would break first if this config grew a root or an alias.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"]
  }
});
