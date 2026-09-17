import { describe, expect, it } from "vitest";

import { mapBlockToAction } from "./absoluteUnitOfANonIssue";
import { getSpellIdByName, getSpellName, resolveSpellIdsInMacrotext, tagMacrotextToSpellIds } from "./spellCatalog";

// Converter parity with the addon. Two defects, one catalog.
//
// INTERVALS. The addon floors an interleave at Data/Defaults.lua
// ACTION_INTERLEAVE_MIN, which is 1, and falls back to ACTION_INTERLEAVE_DEFAULT,
// which is 2, only when the value does not parse. This file used a single
// constant for both jobs, set to 2, so a legitimate interval of 1 was silently
// promoted to 2 on every conversion.
//
// SPELL IDS. The decode and export legs run independently over a plain macro
// string with no carrier for the source id. The decode leg turned an id into a
// name; the export leg had only the name and asked an index that maps one
// lowercased name to ONE id. For a name carried by several ids, the id that came
// out was not the id that went in.

const warnings: string[] = [];

function repeatBlock(interval: unknown) {
  return mapBlockToAction({ kind: "Repeat", text: "/cast Judgment", interval }, warnings, "test");
}

/** The full round trip: decode leg, then export leg, exactly as the converter runs them. */
function roundTrip(macroText: string): string {
  return tagMacrotextToSpellIds(resolveSpellIdsInMacrotext(macroText));
}

// The backlog row's own exhibit, re-verified against the refreshed 12.1.0.69587
// catalog rather than trusted from the 2026-07-30 report. Judgment is carried by
// five ids; the name index keeps the last one it sees, which is the highest.
const SHARED_NAME = "Judgment";
const SHARED_NAME_LOW_ID = 20271;
const SHARED_NAME_INDEX_ID = 327977;

describe("catalog fixture", () => {
  // If the catalog moves and this pair stops being ambiguous, the round-trip
  // tests below would still pass while measuring nothing. Assert the premise.
  it("the fixture pair is genuinely ambiguous in the shipped catalog", () => {
    expect(getSpellName(SHARED_NAME_LOW_ID)).toBe(SHARED_NAME);
    expect(getSpellName(SHARED_NAME_INDEX_ID)).toBe(SHARED_NAME);
    expect(getSpellIdByName(SHARED_NAME)).toBe(SHARED_NAME_INDEX_ID);
    expect(SHARED_NAME_INDEX_ID).not.toBe(SHARED_NAME_LOW_ID);
  });
});

describe("interval floor", () => {
  it("an interval of 1 survives as 1, not 2", () => {
    expect(repeatBlock(1)?.interval).toBe(1);
  });

  it("an interval of 1 given as a string also survives", () => {
    expect(repeatBlock("1")?.interval).toBe(1);
  });

  it("0 clamps up to the floor of 1", () => {
    expect(repeatBlock(0)?.interval).toBe(1);
  });

  it("a negative clamps up to the floor of 1", () => {
    expect(repeatBlock(-5)?.interval).toBe(1);
  });

  it("an unparseable interval falls back to 2, matching the addon's import path", () => {
    // Deliberately NOT 1. The addon reads `tonumber(...) or 2` and only then
    // clamps to MIN, so a missing interval is the DEFAULT, not the floor.
    expect(repeatBlock("not a number")?.interval).toBe(2);
    expect(repeatBlock(undefined)?.interval).toBe(2);
  });

  it("an interval above the max still clamps down to 50", () => {
    expect(repeatBlock(9999)?.interval).toBe(50);
  });
});

describe("spell id round trip", () => {
  it("a numeric id whose name is shared by another id comes back as the SAME id", () => {
    const out = roundTrip(`/cast [combat] ${SHARED_NAME_LOW_ID}`);
    expect(out).toContain(`{spell:${SHARED_NAME_LOW_ID}}`);
    expect(out).not.toContain(`{spell:${SHARED_NAME_INDEX_ID}}`);
  });

  it("the conditions on that line are preserved", () => {
    expect(roundTrip(`/cast [combat] ${SHARED_NAME_LOW_ID}`)).toBe(`/cast [combat] {spell:${SHARED_NAME_LOW_ID}}`);
  });

  it("a {spell:NNN} token round-trips unchanged", () => {
    expect(roundTrip(`/cast {spell:${SHARED_NAME_LOW_ID}}`)).toBe(`/cast {spell:${SHARED_NAME_LOW_ID}}`);
  });

  it("an unambiguous spell name still resolves both ways as it does today", () => {
    // Cobra Shot is carried by exactly one id, so substituting the name is
    // lossless and the readable form is kept.
    const cobraShot = getSpellIdByName("Cobra Shot");
    expect(cobraShot).toBeTruthy();
    expect(getSpellName(cobraShot as number)).toBe("Cobra Shot");
    expect(resolveSpellIdsInMacrotext(`/cast ${cobraShot}`)).toBe("/cast Cobra Shot");
    expect(roundTrip(`/cast ${cobraShot}`)).toBe(`/cast {spell:${cobraShot}}`);
  });

  it("a spell name absent from the catalog is passed through untouched, not dropped", () => {
    const unknown = "Definitely Not A Real Spell Name";
    expect(getSpellIdByName(unknown)).toBeNull();
    expect(roundTrip(`/cast ${unknown}`)).toBe(`/cast ${unknown}`);
  });

  it("an id absent from the catalog is passed through untouched", () => {
    // The decode leg has no name to substitute, so the bare number stays as the
    // user typed it rather than becoming a token.
    expect(getSpellName(999999999)).toBeNull();
    expect(resolveSpellIdsInMacrotext("/cast 999999999")).toBe("/cast 999999999");
  });
});
