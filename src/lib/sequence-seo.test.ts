// src/lib/sequence-seo.test.ts
//
// The search-facing wording of a sequence page. Every example the task names
// is pinned here word for word.

import { describe, expect, it } from "vitest";
import type { Sequence } from "@/types";
import {
  sequenceLead,
  sequenceSeoTitle,
  sequenceTagline,
  sequenceVersionLabel,
  type SequenceSeoFields,
} from "./sequence-seo";

const seq = (over: Partial<SequenceSeoFields> = {}): SequenceSeoFields => ({
  title: "mfdoom affliction warlock",
  class_name: "Warlock",
  spec_name: "Affliction",
  patch_version: "12.1.5",
  game_version: "retail",
  ...over,
});

describe("sequenceLead", () => {
  it("joins spec and class with one space", () => {
    expect(sequenceLead(seq())).toBe("Affliction Warlock");
  });
  it("is the class alone when spec_name is null", () => {
    expect(sequenceLead(seq({ spec_name: null }))).toBe("Warlock");
  });
  it("is the class alone when spec_name is an empty string", () => {
    expect(sequenceLead(seq({ spec_name: "" }))).toBe("Warlock");
  });
});

describe("sequenceVersionLabel", () => {
  it("is the patch version on retail", () => {
    expect(sequenceVersionLabel(seq())).toBe("12.1.5");
  });
  it("is WoW Forever on forever, even with a patch version set", () => {
    expect(sequenceVersionLabel(seq({ game_version: "forever", patch_version: "1.15.2" }))).toBe("WoW Forever");
  });
  it("is null with neither", () => {
    expect(sequenceVersionLabel(seq({ patch_version: null }))).toBeNull();
  });
});

describe("sequenceSeoTitle", () => {
  it("builds the spec, class, version and author title", () => {
    expect(sequenceSeoTitle(seq())).toBe("Affliction Warlock one-button macro, 12.1.5: mfdoom affliction warlock");
  });
  it("drops the spec and the version when there are none", () => {
    expect(sequenceSeoTitle(seq({ spec_name: null, patch_version: null, title: "my warlock" }))).toBe(
      "Warlock one-button macro: my warlock",
    );
  });
  it("names WoW Forever on forever", () => {
    expect(
      sequenceSeoTitle(
        seq({ class_name: "Mage", spec_name: "Fire", game_version: "forever", patch_version: null, title: "leveling fire" }),
      ),
    ).toBe("Fire Mage one-button macro, WoW Forever: leveling fire");
  });
  it("WoW Forever wins over a patch version", () => {
    expect(
      sequenceSeoTitle(
        seq({ class_name: "Mage", spec_name: "Fire", game_version: "forever", patch_version: "1.15.2", title: "leveling fire" }),
      ),
    ).toBe("Fire Mage one-button macro, WoW Forever: leveling fire");
  });
  it("treats an empty spec_name as no spec", () => {
    expect(sequenceSeoTitle(seq({ spec_name: "", patch_version: null, title: "my warlock" }))).toBe(
      "Warlock one-button macro: my warlock",
    );
  });
  it("trims spaces at both ends of the author's title", () => {
    expect(sequenceSeoTitle(seq({ title: "   mfdoom affliction warlock  " }))).toBe(
      "Affliction Warlock one-button macro, 12.1.5: mfdoom affliction warlock",
    );
  });
});

describe("sequenceTagline", () => {
  it("names content, version and author", () => {
    expect(sequenceTagline(seq(), "Mythic+", "mfdoom")).toBe(
      "Affliction Warlock one-button macro for Mythic+, 12.1.5. A GRIP-EMS sequence by mfdoom.",
    );
  });
  it("ends on A GRIP-EMS sequence. when the author name is empty", () => {
    expect(sequenceTagline(seq(), "Mythic+", "")).toBe(
      "Affliction Warlock one-button macro for Mythic+, 12.1.5. A GRIP-EMS sequence.",
    );
  });
  it("drops the version part when there is none", () => {
    expect(sequenceTagline(seq({ spec_name: null, patch_version: null }), "Raid", "mfdoom")).toBe(
      "Warlock one-button macro for Raid. A GRIP-EMS sequence by mfdoom.",
    );
  });
  it("takes a client Sequence row whose author join came back empty", () => {
    // The shape SequencePageClient passes: the whole Sequence row, extra
    // fields included, with author absent, through its exact expression.
    const sequence = {
      ...seq({ spec_name: null, patch_version: null }),
      id: "00000000-0000-0000-0000-000000000000",
      slug: "my-warlock",
      author: undefined,
    } as unknown as Sequence;
    expect(sequenceTagline(sequence, "Raid", sequence.author?.username ?? "")).toBe(
      "Warlock one-button macro for Raid. A GRIP-EMS sequence.",
    );
  });
  it("names WoW Forever over a patch version", () => {
    expect(sequenceTagline(seq({ game_version: "forever", patch_version: "1.15.2" }), "Solo", "mfdoom")).toBe(
      "Affliction Warlock one-button macro for Solo, WoW Forever. A GRIP-EMS sequence by mfdoom.",
    );
  });
});
