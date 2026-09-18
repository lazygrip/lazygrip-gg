// src/lib/profiles-embed-grants.test.ts
//
// Migration 034_profiles_select_grants.sql has a CODE PRECONDITION, stated in
// its own header: it replaces the table-level SELECT on public.profiles with a
// column-scoped grant, and `select=*` expands to every column AT PARSE TIME, so
// any surviving `profiles(*)` embed starts returning
// `permission denied for table profiles` the moment the migration is applied.
//
// WHY THIS FILE EXISTS, dated, because a gate that cannot name its incident was
// built on a hunch:
//
//   2026-09-17  034 shipped alongside the narrowing pass that satisfies it. Its
//               header lists seven reads as narrowed and cites
//               SequencePageClient.tsx:308 and :319 among them.
//   2026-09-18  034 was still unapplied and the file was re-read against main.
//               Neither line number held a select any more, and TWO
//               `profiles(*)` embeds had survived the pass, both inside
//               fetchSequence() in that same file, at lines 231 and 242.
//               `fetchSequence` runs from a useEffect keyed on [slug] with no
//               auth guard, so applying 034 against that code would have broken
//               comments and versions for every signed-out visitor -- silently
//               on a cache-seeded load, where the server content renders and
//               only the background reconcile fails.
//
// The precondition was asserted by quoting line numbers in a comment. Line
// numbers move; a grep over the whole tree does not. That is the whole argument
// for this file.
//
// SCOPE, and its limits, stated rather than implied:
//
//   * EMBEDS (`author:profiles(...)` inside a .select string) are checked
//     column-by-column against 034's anon grant list, because every embed in
//     src today runs on a public client, a browser client or a session client --
//     none on the admin client. An embed added on an admin client would be
//     legitimate and would fail this test; that is the point at which this scope
//     note should be revisited rather than the assertion weakened.
//   * DIRECT selects (`from('profiles').select(...)`) are checked for `*` only.
//     service_role keeps the whole table and the Discord relay routes read
//     discord_bridge_opted_out through it on purpose, so checking those against
//     the anon list would report a fault where there is none.
//
// The grant list is PARSED OUT OF THE MIGRATION, never restated here. Two copies
// of a column list drift, and the copy in the test would go stale in exactly the
// direction that makes it pass while production breaks.

import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const ROOT = process.cwd();
const SRC = join(ROOT, "src");
const MIGRATION = join(
  ROOT,
  "supabase",
  "migrations",
  "034_profiles_select_grants.sql",
);

// ---------------------------------------------------------------------------
// The anon grant, read from 034 itself.
// ---------------------------------------------------------------------------
function anonGrantedColumns(): string[] {
  const sql = readFileSync(MIGRATION, "utf8");
  const block = /v_public\s+text\[\]\s*:=\s*array\[([\s\S]*?)\]\s*;/.exec(sql);
  if (!block) {
    throw new Error(
      "034_profiles_select_grants.sql: could not find `v_public text[] := array[...]`. " +
        "Refusing to check the code against a list this test could not read -- an " +
        "unparsed list would silently become an empty one, and every column would pass.",
    );
  }
  const cols = Array.from(block[1].matchAll(/'([a-z0-9_]+)'/gi)).map(m => m[1]);
  if (cols.length === 0) {
    throw new Error(
      "034_profiles_select_grants.sql: v_public parsed to zero columns. Same reason as above.",
    );
  }
  return cols;
}

// ---------------------------------------------------------------------------
// Comment-stripped source. A handful of files carry the OLD `author:profiles(*)`
// form inside explanatory comments, on purpose, saying what it used to be and
// why it changed. A naive grep reports every one of those as a live violation,
// so the scan runs over code only.
// ---------------------------------------------------------------------------
function stripComments(src: string): string {
  let out = "";
  let i = 0;
  let quote: string | null = null;

  while (i < src.length) {
    const c = src[i];
    const next = src[i + 1];

    if (quote) {
      if (c === "\\") {
        out += c + (next ?? "");
        i += 2;
        continue;
      }
      if (c === quote) quote = null;
      out += c;
      i += 1;
      continue;
    }

    if (c === "'" || c === '"' || c === "`") {
      quote = c;
      out += c;
      i += 1;
      continue;
    }

    if (c === "/" && next === "/") {
      while (i < src.length && src[i] !== "\n") i += 1;
      continue;
    }

    if (c === "/" && next === "*") {
      i += 2;
      while (i < src.length && !(src[i] === "*" && src[i + 1] === "/")) i += 1;
      i += 2;
      continue;
    }

    out += c;
    i += 1;
  }

  return out;
}

function sourceFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      found.push(...sourceFiles(full));
      continue;
    }
    // .test.ts files are excluded: this one quotes `profiles(*)` in its own
    // patterns and messages, and a test that matches itself is noise.
    if (/\.test\.tsx?$/.test(entry)) continue;
    if (/\.tsx?$/.test(entry)) found.push(full);
  }
  return found;
}

type Found = { file: string; line: number; text: string; select: string };

// Single-line select strings only. That is not a simplification, it is what
// keeps a COMMENT from being read as code: SequencePageClient.tsx's header
// comment breaks the string `.select('*, author:` across a line ending, and a
// pattern allowing newlines matches straight through it.
const SELECT_STRING = /\.select\(\s*(['"])([^'"\n]*)\1/g;
const PROFILES_EMBED = /profiles(?:![A-Za-z0-9_]+)?\(([^()]*)\)/g;
const PROFILES_EMBED_NESTED = /profiles(?:![A-Za-z0-9_]+)?\([^()]*\(/;

function scan(): { embeds: Found[]; direct: Found[]; nested: Found[] } {
  const embeds: Found[] = [];
  const direct: Found[] = [];
  const nested: Found[] = [];

  for (const file of sourceFiles(SRC)) {
    const raw = readFileSync(file, "utf8");
    const code = stripComments(raw);
    const rel = relative(ROOT, file).split(sep).join("/");

    for (const m of code.matchAll(SELECT_STRING)) {
      const select = m[2];
      // Line number from the stripped text is not the line number in the file.
      // Find the select string in the original instead, which is what a reader
      // has to open.
      const at = raw.indexOf(select);
      const line = at === -1 ? 0 : raw.slice(0, at).split("\n").length;
      const hit = { file: rel, line, text: select, select };

      if (PROFILES_EMBED_NESTED.test(select)) {
        nested.push(hit);
        continue;
      }
      for (const e of select.matchAll(PROFILES_EMBED)) {
        embeds.push({ ...hit, text: e[1] });
      }
    }

    // Direct reads: from('profiles') ... .select('...'), star ban only.
    for (const m of code.matchAll(/from\(\s*['"]profiles['"]\s*\)([\s\S]{0,400}?)\.select\(\s*(['"])([^'"\n]*)\2/g)) {
      const select = m[3];
      const at = raw.indexOf(select);
      const line = at === -1 ? 0 : raw.slice(0, at).split("\n").length;
      direct.push({ file: rel, line, text: select, select });
    }
  }

  return { embeds, direct, nested };
}

describe("migration 034's code precondition", () => {
  const granted = anonGrantedColumns();
  const { embeds, direct, nested } = scan();

  it("reads a non-empty anon grant list out of the migration", () => {
    expect(granted).toContain("username");
    expect(granted).not.toContain("terms_accepted_at");
    expect(granted).not.toContain("discord_bridge_opted_out");
    expect(granted).not.toContain("updated_at");
  });

  it("finds the profiles embeds it is supposed to be checking", () => {
    // A scan that silently matches nothing passes every assertion below it.
    // 2026-09-18: six embeds in src. The floor is deliberately lower than the
    // count so that removing one read is not a test failure, but losing the
    // scan is.
    expect(embeds.length).toBeGreaterThanOrEqual(4);
  });

  it("has no profiles embed that selects every column", () => {
    const stars = embeds.filter(e => e.text.trim() === "*" || e.text.split(",").some(c => c.trim() === "*"));
    expect(
      stars.map(s => `${s.file}:${s.line}  ${s.select}`),
      "`select=*` on profiles expands at parse time and needs SELECT on every column, " +
        "so each of these returns `permission denied for table profiles` under 034's " +
        "column-scoped grant. Narrow it to the columns its consumers actually read.",
    ).toEqual([]);
  });

  it("names only columns anon holds SELECT on in every profiles embed", () => {
    const offenders: string[] = [];
    for (const e of embeds) {
      for (const col of e.text.split(",").map(c => c.trim()).filter(Boolean)) {
        // `alias:column` -- PostgREST renames the field, the privilege is still
        // on the column, so it is the right-hand side that has to be granted.
        const name = col.replace(/^[^:]*:/, "").trim();
        if (!granted.includes(name)) offenders.push(`${e.file}:${e.line}  ${name}  in  ${e.select}`);
      }
    }
    expect(
      offenders,
      "034 grants anon SELECT on exactly these columns: " +
        granted.join(", ") +
        ". A column outside that list in an anon-reachable embed is a 42501 waiting " +
        "to happen, not a missing grant -- check the consumer before widening the grant.",
    ).toEqual([]);
  });

  it("has no direct profiles read that selects every column", () => {
    const stars = direct.filter(d => d.select.split(",").some(c => c.trim() === "*"));
    expect(stars.map(s => `${s.file}:${s.line}  ${s.select}`)).toEqual([]);
  });

  it("has no profiles embed this scan cannot parse", () => {
    expect(
      nested.map(n => `${n.file}:${n.line}  ${n.select}`),
      "A nested embed inside profiles(...) is not parsed by this test rather than " +
        "being waved through. Read it by hand and extend the scan.",
    ).toEqual([]);
  });
});
