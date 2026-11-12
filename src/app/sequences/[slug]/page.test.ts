// src/app/sequences/[slug]/page.test.ts
//
// generateMetadata of a sequence page, run against the REAL page module with
// only the public Supabase client stubbed, the way src/app/sitemap.test.ts
// tests its route. The title is what a search result shows, so the test goes
// through the query and the metadata object rather than an extracted helper.

import { describe, expect, it, vi, beforeEach } from "vitest";

interface SeqRow {
  title: string;
  description: string | null;
  class_name: string;
  spec_name: string | null;
  hero_talent: string | null;
  content_type: string;
  patch_version: string | null;
  game_version: string;
  author: { username: string } | null;
}

let sequenceRow: SeqRow | null = null;
let aliasRow: { sequences: { slug: string; status: string } } | null = null;
let sequenceSelect = "";

// A chainable stub shaped like the two query chains page.tsx builds:
//   .from('sequences').select(...).eq(...).eq(...).single()          -> awaited
//   .from('slug_aliases').select(...).eq(...).eq(...).maybeSingle()  -> awaited
function makeClient() {
  const build = (table: string) => {
    const result = () => ({
      data: table === "sequences" ? sequenceRow : aliasRow,
      error: null,
    });
    const chain: Record<string, unknown> = {
      select: (cols: string) => {
        if (table === "sequences") sequenceSelect = cols;
        return chain;
      },
      eq: () => chain,
      single: () => Promise.resolve(result()),
      maybeSingle: () => Promise.resolve(result()),
    };
    return chain;
  };
  return { from: (table: string) => build(table) };
}

vi.mock("@/lib/supabase/public", () => ({
  createPublicClient: () => makeClient(),
}));

const row = (over: Partial<SeqRow> = {}): SeqRow => ({
  title: "mfdoom affliction warlock",
  description: null,
  class_name: "Warlock",
  spec_name: "Affliction",
  hero_talent: null,
  content_type: "mythic_plus",
  patch_version: "12.1.5",
  game_version: "retail",
  author: { username: "mfdoom" },
  ...over,
});

async function metadataFor(slug: string) {
  const mod = await import("./page");
  return mod.generateMetadata({ params: Promise.resolve({ slug }) });
}

beforeEach(() => {
  vi.resetModules();
  sequenceRow = null;
  aliasRow = null;
  sequenceSelect = "";
});

describe("generateMetadata, found sequence", () => {
  it("titles the page with the spec, class, one-button macro, patch and author title", async () => {
    sequenceRow = row();
    const md = await metadataFor("mfdoom-affliction-warlock");
    const expected = "Affliction Warlock one-button macro, 12.1.5: mfdoom affliction warlock";
    expect(md.title).toBe(expected);
    expect(md.openGraph?.title).toBe(expected);
    expect(md.twitter?.title).toBe(expected);
  });

  it("selects game_version and names WoW Forever in the title", async () => {
    sequenceRow = row({ class_name: "Mage", spec_name: "Fire", game_version: "forever", title: "leveling fire" });
    const md = await metadataFor("leveling-fire");
    expect(sequenceSelect).toContain("game_version");
    expect(md.title).toBe("Fire Mage one-button macro, WoW Forever: leveling fire");
  });

  it("keeps the author's own description", async () => {
    sequenceRow = row({ description: "<p>My <b>rotation</b> for keys.</p>" });
    const md = await metadataFor("mfdoom-affliction-warlock");
    expect(md.description).toBe("My rotation for keys.");
    expect(md.openGraph?.description).toBe("My rotation for keys.");
  });

  it("falls back to the one-button macro sentence when the author wrote none", async () => {
    sequenceRow = row();
    const md = await metadataFor("mfdoom-affliction-warlock");
    const expected =
      "Affliction Warlock one-button macro for Mythic+ by mfdoom | 12.1.5. A free GRIP-EMS sequence to import on LazyGrip.net.";
    expect(md.description).toBe(expected);
    expect(md.twitter?.description).toBe(expected);
  });

  it("keeps the hero talent part in the fallback where it sits today", async () => {
    sequenceRow = row({ spec_name: null, hero_talent: "Hellcaller", patch_version: null, author: null });
    const md = await metadataFor("x");
    expect(md.description).toBe(
      "Warlock — Hellcaller one-button macro for Mythic+. A free GRIP-EMS sequence to import on LazyGrip.net.",
    );
  });

  it("adds one-button macro and the lead macro to keywords right after GRIP-EMS", async () => {
    sequenceRow = row();
    const md = await metadataFor("mfdoom-affliction-warlock");
    expect(String(md.keywords).startsWith("GRIP-EMS, one-button macro, Affliction Warlock macro, WoW macro")).toBe(true);
  });
});

describe("generateMetadata, unchanged branches", () => {
  it("returns only the canonical for a slug that resolves through slug_aliases", async () => {
    aliasRow = { sequences: { slug: "the-real-slug", status: "published" } };
    const md = await metadataFor("old-slug");
    expect(md).toEqual({ alternates: { canonical: "https://lazygrip.net/sequences/the-real-slug" } });
  });

  it("returns Sequence Not Found for a slug that resolves nowhere", async () => {
    const md = await metadataFor("nothing-here");
    expect(md).toEqual({ title: "Sequence Not Found", description: "This sequence could not be found." });
  });
});
