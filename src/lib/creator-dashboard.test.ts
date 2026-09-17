// src/lib/creator-dashboard.test.ts
//
// Audit F7.6: both helpers took an identity from their caller and never checked
// it against the session, so their safety lived entirely outside them. The
// module's own header said so. These fixtures are the check that it now lives
// inside.
//
// The shape of the test is the shape of the finding: hand each function a
// client that has NO session (which is what createAdminClient() is) and a
// userId that is not the caller's, and assert it returns nothing. Against the
// code before this change both returned the rows, because nothing looked.
//
// Red run against main at 28ac505, quoted in the pull request:
//   4 failed | 5 passed (9)

import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import { fetchCreatorActivity, fetchCreatorViewTrend } from "./creator-dashboard";

const OWNER = "11111111-1111-1111-1111-111111111111";
const SOMEONE_ELSE = "22222222-2222-2222-2222-222222222222";
const SEQ_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const SEQ_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

const today = () => new Date().toISOString().slice(0, 10);

interface StubOptions {
  /** null models an admin client: a real client with no signed-in user. */
  sessionUser: string | null;
  rows: Record<string, unknown>[];
  /** Filters the stub applied, so a test can assert the query was constrained. */
  seen?: { eq: [string, unknown][]; in: [string, unknown[]][]; select: string[] };
}

// Deliberately does NOT model RLS. The point of F7.6 is what happens when the
// database is not the thing stopping you, so this stub always returns its rows
// and the assertions are about whether the function asked for them at all.
function stubClient(opts: StubOptions): SupabaseClient {
  const seen = opts.seen ?? { eq: [], in: [], select: [] };
  const chain: Record<string, unknown> = {
    select: (s: string) => {
      seen.select.push(s);
      return chain;
    },
    eq: (col: string, val: unknown) => {
      seen.eq.push([col, val]);
      return chain;
    },
    in: (col: string, vals: unknown[]) => {
      seen.in.push([col, vals]);
      return chain;
    },
    gte: () => chain,
    order: () => chain,
    limit: () => chain,
    then: (resolve: (v: unknown) => unknown) =>
      Promise.resolve({ data: opts.rows, error: null }).then(resolve),
  };
  return {
    auth: {
      getUser: async () => ({
        data: { user: opts.sessionUser ? { id: opts.sessionUser } : null },
        error: null,
      }),
    },
    from: () => chain,
  } as unknown as SupabaseClient;
}

describe("fetchCreatorActivity -- F7.6", () => {
  const rows = [
    {
      id: "n1",
      type: "comment",
      message: "someone commented",
      created_at: "2026-09-01T00:00:00.000Z",
      is_read: false,
      sequence: { slug: "s", title: "T" },
    },
  ];

  it("returns the feed for the session user's own id", async () => {
    const client = stubClient({ sessionUser: OWNER, rows });
    expect(await fetchCreatorActivity(client, OWNER)).toHaveLength(1);
  });

  // THE FINDING. An admin client has no session, so this is the exact call the
  // module header warned about: fetchCreatorActivity(admin, anyUserId).
  it("returns nothing when the client has no session at all", async () => {
    const client = stubClient({ sessionUser: null, rows });
    expect(await fetchCreatorActivity(client, OWNER)).toEqual([]);
  });

  it("returns nothing when the caller asks for someone else's feed", async () => {
    const client = stubClient({ sessionUser: OWNER, rows });
    expect(await fetchCreatorActivity(client, SOMEONE_ELSE)).toEqual([]);
  });

  it("queries on the session-derived id, not the argument", async () => {
    const seen = { eq: [] as [string, unknown][], in: [] as [string, unknown[]][], select: [] as string[] };
    const client = stubClient({ sessionUser: OWNER, rows, seen });
    await fetchCreatorActivity(client, OWNER);
    expect(seen.eq).toContainEqual(["user_id", OWNER]);
  });
});

describe("fetchCreatorViewTrend -- F7.6 and the F7.7 unbounded IN", () => {
  const rows = [{ day: today(), views: 7, sequence_id: SEQ_A }];

  it("returns a zero-filled series for the session user", async () => {
    const client = stubClient({ sessionUser: OWNER, rows });
    const out = await fetchCreatorViewTrend(client, [SEQ_A], 3);
    expect(out).toHaveLength(3);
    expect(out[out.length - 1]).toEqual({ day: today(), views: 7 });
  });

  it("returns nothing when the client has no session at all", async () => {
    const client = stubClient({ sessionUser: null, rows });
    expect(await fetchCreatorViewTrend(client, [SEQ_A], 3)).toEqual([]);
  });

  // The author filter is what makes this safe against a client that is not the
  // per-request one, so it has to actually be on the query.
  it("constrains the query to the session user's own sequences", async () => {
    const seen = { eq: [] as [string, unknown][], in: [] as [string, unknown[]][], select: [] as string[] };
    const client = stubClient({ sessionUser: OWNER, rows, seen });
    await fetchCreatorViewTrend(client, [SEQ_A], 3);
    expect(seen.eq).toContainEqual(["sequences.author_id", OWNER]);
    expect(seen.select.join(" ")).toContain("sequences!inner(author_id)");
  });

  // F7.7's first leftover: one uuid per sequence in the GET query string grew
  // the URL until PostgREST or Vercel refused it, for exactly one user -- the
  // most prolific one.
  it("sends no per-sequence IN list, however many sequences the creator has", async () => {
    const seen = { eq: [] as [string, unknown][], in: [] as [string, unknown[]][], select: [] as string[] };
    const many = Array.from({ length: 500 }, (_, i) => `${i}`.padStart(8, "0") + "-0000-0000-0000-000000000000");
    const client = stubClient({ sessionUser: OWNER, rows: [], seen });
    await fetchCreatorViewTrend(client, many, 3);
    expect(seen.in).toEqual([]);
  });

  // The in-memory filter replaces the IN list, so the published-only scope the
  // caller passes still holds: a sequence made private after the fact must not
  // reappear in the trend.
  it("still excludes a sequence the caller did not ask for", async () => {
    const client = stubClient({
      sessionUser: OWNER,
      rows: [
        { day: today(), views: 7, sequence_id: SEQ_A },
        { day: today(), views: 99, sequence_id: SEQ_B },
      ],
    });
    const out = await fetchCreatorViewTrend(client, [SEQ_A], 3);
    expect(out[out.length - 1]).toEqual({ day: today(), views: 7 });
  });
});
