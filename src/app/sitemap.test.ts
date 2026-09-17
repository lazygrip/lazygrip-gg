// src/app/sitemap.test.ts
//
// Audit F2: /browse/pvp was submitted for indexing with zero sequences behind
// it. LIVE-VERIFIED 2026-09-17 -- 87 published sequences, mythic_plus 82,
// raid 4, solo 1, pvp 0, and /browse/pvp was one of the 143 URLs in the live
// sitemap.xml.
//
// These run against the REAL sitemap module rather than an extracted helper,
// with only the Supabase client stubbed. The gate is a filter on a query
// result, so a test that does not go through the query is not testing the gate.
//
// RED before the fix: every "excludes" case below failed, because CONTENT_TYPES
// and WOW_CLASSES were mapped unconditionally. The red run is quoted in the
// pull request that introduced this file.

import { describe, expect, it, vi, beforeEach } from "vitest";

interface SeqRow {
  slug: string;
  updated_at: string | null;
  class_id: number | null;
  content_type: string | null;
  author_id: string | null;
}

let sequenceRows: SeqRow[] = [];
let profileRows: { id: string; username: string }[] = [];

// A chainable stub shaped like the two query chains sitemap.ts actually builds:
//   .from('sequences').select(...).eq(...).order(...)        -> awaited
//   .from('profiles').select(...).in(...)                    -> awaited
// Every builder method returns the same thenable, so the chain resolves
// whenever it is awaited regardless of how many links it has.
function makeClient() {
  const build = (table: string) => {
    const result = () => ({
      data: table === "sequences" ? sequenceRows : profileRows,
      error: null,
    });
    const chain: Record<string, unknown> = {
      select: () => chain,
      eq: () => chain,
      in: () => chain,
      order: () => chain,
      then: (resolve: (v: unknown) => unknown) => Promise.resolve(result()).then(resolve),
    };
    return chain;
  };
  return { from: (table: string) => build(table) };
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => makeClient(),
}));

const seq = (over: Partial<SeqRow> = {}): SeqRow => ({
  slug: "a-sequence",
  updated_at: "2026-09-01T00:00:00.000Z",
  class_id: 11,
  content_type: "mythic_plus",
  author_id: "11111111-1111-1111-1111-111111111111",
  ...over,
});

async function urls() {
  const mod = await import("./sitemap");
  const entries = await mod.default();
  return entries.map((e) => e.url);
}

beforeEach(() => {
  vi.resetModules();
  profileRows = [{ id: "11111111-1111-1111-1111-111111111111", username: "someone" }];
});

describe("content-type hubs are gated on a non-zero count -- F2", () => {
  it("excludes /browse/pvp when no published sequence is pvp", async () => {
    // The live distribution, reduced: everything but pvp has content.
    sequenceRows = [
      seq({ slug: "a", content_type: "mythic_plus" }),
      seq({ slug: "b", content_type: "raid" }),
      seq({ slug: "c", content_type: "solo" }),
    ];
    const list = await urls();
    expect(list).not.toContain("https://lazygrip.net/browse/pvp");
    expect(list).toContain("https://lazygrip.net/browse/mythic-plus");
    expect(list).toContain("https://lazygrip.net/browse/raid");
    expect(list).toContain("https://lazygrip.net/browse/solo");
  });

  it("includes /browse/pvp again as soon as one pvp sequence is published", async () => {
    sequenceRows = [
      seq({ slug: "a", content_type: "mythic_plus" }),
      seq({ slug: "d", content_type: "pvp" }),
    ];
    expect(await urls()).toContain("https://lazygrip.net/browse/pvp");
  });

  it("excludes every content-type hub when nothing is published at all", async () => {
    sequenceRows = [];
    profileRows = [];
    const list = await urls();
    for (const slug of ["pvp", "raid", "solo", "mythic-plus"]) {
      expect(list).not.toContain(`https://lazygrip.net/browse/${slug}`);
    }
    // The static pages still ship -- an empty corpus is not an empty sitemap.
    expect(list).toContain("https://lazygrip.net");
    expect(list).toContain("https://lazygrip.net/browse");
  });
});

describe("class hubs get the identical gate", () => {
  it("lists only the classes that have a published sequence", async () => {
    // 11 = Druid, 7 = Shaman (src/lib/wow-data.ts).
    sequenceRows = [seq({ slug: "a", class_id: 11 }), seq({ slug: "b", class_id: 7 })];
    const list = await urls();
    expect(list).toContain("https://lazygrip.net/browse/druid");
    expect(list).toContain("https://lazygrip.net/browse/shaman");
    expect(list).not.toContain("https://lazygrip.net/browse/warrior");
    expect(list).not.toContain("https://lazygrip.net/browse/evoker");
  });
});

// The population sets are counted separately from the newestBy* maps precisely
// so an unparseable timestamp cannot drop a populated hub. This is the case
// that would have been silently wrong had the gate reused
// `newestByContentType.has(...)`, since trackNewest skips such rows.
describe("an unusable updated_at does not empty a populated hub", () => {
  it("keeps the hub when every row's timestamp fails to parse", async () => {
    sequenceRows = [
      seq({ slug: "a", content_type: "raid", class_id: 1, updated_at: "not-a-date" }),
      seq({ slug: "b", content_type: "raid", class_id: 1, updated_at: null }),
    ];
    const list = await urls();
    expect(list).toContain("https://lazygrip.net/browse/raid");
    expect(list).toContain("https://lazygrip.net/browse/warrior");
  });

  it("still emits a usable lastModified for that hub rather than throwing", async () => {
    sequenceRows = [seq({ slug: "a", content_type: "raid", updated_at: "not-a-date" })];
    const mod = await import("./sitemap");
    const entries = await mod.default();
    const hub = entries.find((e) => e.url === "https://lazygrip.net/browse/raid");
    expect(hub).toBeDefined();
    // Next calls toISOString() on this; a RangeError here 500s the whole route.
    expect(() => new Date(hub!.lastModified as Date).toISOString()).not.toThrow();
  });
});

describe("/creators is submitted -- audit PART 7.8", () => {
  it("is present", async () => {
    sequenceRows = [seq()];
    expect(await urls()).toContain("https://lazygrip.net/creators");
  });

  it("is present even with an empty corpus, since it is a real page", async () => {
    sequenceRows = [];
    profileRows = [];
    expect(await urls()).toContain("https://lazygrip.net/creators");
  });
});

describe("no URL is emitted twice", () => {
  it("holds across the whole document", async () => {
    sequenceRows = [
      seq({ slug: "a", class_id: 11, content_type: "mythic_plus" }),
      seq({ slug: "b", class_id: 11, content_type: "raid" }),
      seq({ slug: "c", class_id: 7, content_type: "mythic_plus" }),
    ];
    const list = await urls();
    expect(new Set(list).size).toBe(list.length);
  });
});
